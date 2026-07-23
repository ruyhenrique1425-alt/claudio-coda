
-- 1) Central de Notas Fiscais
CREATE TABLE public.notas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_nf text NOT NULL,
  fornecedor text NOT NULL DEFAULT 'HEINEKEN',
  data_emissao date,
  arquivo_url text,
  status text NOT NULL DEFAULT 'pendente_revisao' CHECK (status IN ('pendente_revisao','conciliado','rejeitado')),
  barris_cheios_solicitados integer NOT NULL DEFAULT 0,
  barris_vazios_devolvidos integer NOT NULL DEFAULT 0,
  heineken_cheios integer NOT NULL DEFAULT 0,
  amstel_cheios integer NOT NULL DEFAULT 0,
  heineken_vazios integer NOT NULL DEFAULT 0,
  amstel_vazios integer NOT NULL DEFAULT 0,
  status_comodato text NOT NULL DEFAULT 'pendente_cascos' CHECK (status_comodato IN ('quitado','pendente_cascos')),
  notes text,
  created_by uuid,
  conciliado_by uuid,
  conciliado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais TO authenticated;
GRANT ALL ON public.notas_fiscais TO service_role;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nf_read_auth" ON public.notas_fiscais FOR SELECT TO authenticated USING (true);
CREATE POLICY "nf_insert_gestor" ON public.notas_fiscais FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manutencao'));
CREATE POLICY "nf_update_gestor" ON public.notas_fiscais FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manutencao'));
CREATE POLICY "nf_delete_admin" ON public.notas_fiscais FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_nf_updated BEFORE UPDATE ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Controle de comodato global (saldo de cascos por marca)
CREATE TABLE public.controle_comodato_global (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marca text NOT NULL UNIQUE CHECK (marca IN ('heineken','amstel')),
  vazios_disponiveis integer NOT NULL DEFAULT 0,
  cheios_recebidos_acumulados integer NOT NULL DEFAULT 0,
  vazios_devolvidos_acumulados integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.controle_comodato_global TO authenticated;
GRANT ALL ON public.controle_comodato_global TO service_role;
ALTER TABLE public.controle_comodato_global ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comodato_read_auth" ON public.controle_comodato_global FOR SELECT TO authenticated USING (true);

INSERT INTO public.controle_comodato_global (marca) VALUES ('heineken'), ('amstel');

-- 3) Auditoria de movimentações (mirror aditivo)
CREATE TABLE public.movimentacoes_barris (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem text,
  destino text,
  marca text,
  quantidade integer NOT NULL,
  move_type text,
  refill_id uuid,
  nf_id uuid REFERENCES public.notas_fiscais(id) ON DELETE SET NULL,
  user_id uuid,
  "timestamp" timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.movimentacoes_barris TO authenticated;
GRANT ALL ON public.movimentacoes_barris TO service_role;
ALTER TABLE public.movimentacoes_barris ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mov_read_auth" ON public.movimentacoes_barris FOR SELECT TO authenticated USING (true);

-- Trigger: mirror warehouse_movements -> movimentacoes_barris
CREATE OR REPLACE FUNCTION public.mirror_warehouse_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_origem text; v_destino text; v_wh_name text; v_target_name text; v_bar_name text;
BEGIN
  SELECT name INTO v_wh_name FROM public.warehouses WHERE id = NEW.warehouse_id;
  IF NEW.bar_id IS NOT NULL THEN
    SELECT name INTO v_bar_name FROM public.bars WHERE id = NEW.bar_id;
  END IF;
  IF NEW.target_warehouse_id IS NOT NULL THEN
    SELECT name INTO v_target_name FROM public.warehouses WHERE id = NEW.target_warehouse_id;
  END IF;

  IF NEW.direction = 1 THEN
    v_origem := COALESCE(v_target_name, 'Entrada externa');
    v_destino := v_wh_name;
  ELSE
    v_origem := v_wh_name;
    v_destino := COALESCE(v_bar_name, v_target_name, 'Saída');
  END IF;

  INSERT INTO public.movimentacoes_barris(origem, destino, marca, quantidade, move_type, refill_id, user_id, "timestamp")
  VALUES (v_origem, v_destino, NEW.brand::text, NEW.quantidade, NEW.move_type::text, NEW.refill_id, NEW.performed_by, NEW.performed_at);

  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_mirror_wh_mov AFTER INSERT ON public.warehouse_movements
  FOR EACH ROW EXECUTE FUNCTION public.mirror_warehouse_movement();

-- 4) Comodato: cada vazio recolhido aumenta o saldo de vazios_disponiveis
CREATE OR REPLACE FUNCTION public.apply_empties_to_comodato()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.quantidade IS NULL OR NEW.quantidade <= 0 THEN RETURN NEW; END IF;
  IF NEW.brand::text NOT IN ('heineken','amstel') THEN RETURN NEW; END IF;
  UPDATE public.controle_comodato_global
     SET vazios_disponiveis = vazios_disponiveis + NEW.quantidade,
         updated_at = now()
   WHERE marca = NEW.brand::text;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_empties_to_comodato AFTER INSERT ON public.empties_removed
  FOR EACH ROW EXECUTE FUNCTION public.apply_empties_to_comodato();

-- 5) Proteção contábil: bloqueia saldo negativo em warehouse_stock
CREATE OR REPLACE FUNCTION public.prevent_negative_warehouse_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.barrels < 0 THEN
    RAISE EXCEPTION 'Estoque central insuficiente para % (saldo ficaria em %)', NEW.brand, NEW.barrels
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_prevent_neg_wh_stock BEFORE INSERT OR UPDATE ON public.warehouse_stock
  FOR EACH ROW EXECUTE FUNCTION public.prevent_negative_warehouse_stock();

-- 6) RPC atômica de conciliação da NF
CREATE OR REPLACE FUNCTION public.conciliar_nota_fiscal(
  _nf_id uuid,
  _heineken_cheios integer,
  _amstel_cheios integer,
  _heineken_vazios integer,
  _amstel_vazios integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dispel uuid;
  v_user uuid := auth.uid();
  v_nf record;
  v_saldo_hei integer;
  v_saldo_ams integer;
BEGIN
  IF NOT (public.has_role(v_user, 'gestor') OR public.has_role(v_user, 'admin') OR public.has_role(v_user, 'manutencao')) THEN
    RAISE EXCEPTION 'Sem permissão para conciliar notas fiscais';
  END IF;

  SELECT * INTO v_nf FROM public.notas_fiscais WHERE id = _nf_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NF não encontrada'; END IF;
  IF v_nf.status = 'conciliado' THEN RAISE EXCEPTION 'NF já conciliada'; END IF;

  SELECT id INTO v_dispel FROM public.warehouses WHERE code = 'dispel' LIMIT 1;
  IF v_dispel IS NULL THEN RAISE EXCEPTION 'Estoque Dispel não configurado'; END IF;

  -- Valida saldo de vazios disponíveis
  SELECT vazios_disponiveis INTO v_saldo_hei FROM public.controle_comodato_global WHERE marca='heineken';
  SELECT vazios_disponiveis INTO v_saldo_ams FROM public.controle_comodato_global WHERE marca='amstel';
  IF _heineken_vazios > v_saldo_hei THEN
    RAISE EXCEPTION 'Vazios de Heineken insuficientes (disponível: %, informado: %)', v_saldo_hei, _heineken_vazios;
  END IF;
  IF _amstel_vazios > v_saldo_ams THEN
    RAISE EXCEPTION 'Vazios de Amstel insuficientes (disponível: %, informado: %)', v_saldo_ams, _amstel_vazios;
  END IF;

  -- Entrada de cheios no Dispel via warehouse_movements (dispara apply_warehouse_movement)
  IF _heineken_cheios > 0 THEN
    INSERT INTO public.warehouse_movements(warehouse_id, move_type, brand, quantidade, direction, performed_by, notes)
    VALUES (v_dispel, 'recebimento_heineken', 'heineken', _heineken_cheios, 1, v_user, 'Conciliação NF ' || v_nf.numero_nf);
  END IF;
  IF _amstel_cheios > 0 THEN
    INSERT INTO public.warehouse_movements(warehouse_id, move_type, brand, quantidade, direction, performed_by, notes)
    VALUES (v_dispel, 'recebimento_heineken', 'amstel', _amstel_cheios, 1, v_user, 'Conciliação NF ' || v_nf.numero_nf);
  END IF;

  -- Atualiza comodato
  UPDATE public.controle_comodato_global
     SET vazios_disponiveis = vazios_disponiveis - _heineken_vazios,
         cheios_recebidos_acumulados = cheios_recebidos_acumulados + _heineken_cheios,
         vazios_devolvidos_acumulados = vazios_devolvidos_acumulados + _heineken_vazios,
         updated_at = now()
   WHERE marca = 'heineken';
  UPDATE public.controle_comodato_global
     SET vazios_disponiveis = vazios_disponiveis - _amstel_vazios,
         cheios_recebidos_acumulados = cheios_recebidos_acumulados + _amstel_cheios,
         vazios_devolvidos_acumulados = vazios_devolvidos_acumulados + _amstel_vazios,
         updated_at = now()
   WHERE marca = 'amstel';

  -- Atualiza NF
  UPDATE public.notas_fiscais
     SET status = 'conciliado',
         conciliado_by = v_user,
         conciliado_at = now(),
         heineken_cheios = _heineken_cheios,
         amstel_cheios = _amstel_cheios,
         heineken_vazios = _heineken_vazios,
         amstel_vazios = _amstel_vazios,
         barris_cheios_solicitados = _heineken_cheios + _amstel_cheios,
         barris_vazios_devolvidos = _heineken_vazios + _amstel_vazios,
         status_comodato = CASE
           WHEN (_heineken_vazios + _amstel_vazios) >= (_heineken_cheios + _amstel_cheios) THEN 'quitado'
           ELSE 'pendente_cascos'
         END
   WHERE id = _nf_id;

  -- Auditoria: registro adicional específico da NF
  INSERT INTO public.movimentacoes_barris(origem, destino, marca, quantidade, move_type, nf_id, user_id)
  SELECT 'Cervejaria', 'ESTOQUE DISPEL', 'heineken', _heineken_cheios, 'nf_conciliacao', _nf_id, v_user
  WHERE _heineken_cheios > 0;
  INSERT INTO public.movimentacoes_barris(origem, destino, marca, quantidade, move_type, nf_id, user_id)
  SELECT 'Cervejaria', 'ESTOQUE DISPEL', 'amstel', _amstel_cheios, 'nf_conciliacao', _nf_id, v_user
  WHERE _amstel_cheios > 0;
  INSERT INTO public.movimentacoes_barris(origem, destino, marca, quantidade, move_type, nf_id, user_id)
  SELECT 'Cascos comodato', 'Cervejaria', 'heineken', _heineken_vazios, 'nf_devolucao_vazios', _nf_id, v_user
  WHERE _heineken_vazios > 0;
  INSERT INTO public.movimentacoes_barris(origem, destino, marca, quantidade, move_type, nf_id, user_id)
  SELECT 'Cascos comodato', 'Cervejaria', 'amstel', _amstel_vazios, 'nf_devolucao_vazios', _nf_id, v_user
  WHERE _amstel_vazios > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.conciliar_nota_fiscal(uuid,integer,integer,integer,integer) TO authenticated;

-- Backfill comodato: vazios recolhidos historicamente somam ao saldo
UPDATE public.controle_comodato_global c
   SET vazios_disponiveis = COALESCE((
     SELECT SUM(e.quantidade) FROM public.empties_removed e WHERE e.brand::text = c.marca
   ), 0),
   updated_at = now();
