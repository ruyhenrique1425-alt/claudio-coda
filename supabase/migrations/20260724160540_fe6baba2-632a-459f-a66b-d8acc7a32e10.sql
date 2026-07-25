-- =====================================================================
-- BLOCO 3+4 do APLICACAO.md — 5 migrations em ordem
-- =====================================================================

-- ============ 20260724190000_fluxo_barril_vazio ============
CREATE TABLE IF NOT EXISTS public.warehouse_empty_stock (
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  brand        chopp_brand NOT NULL,
  barrels      integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (warehouse_id, brand)
);
GRANT SELECT ON public.warehouse_empty_stock TO authenticated;
GRANT ALL    ON public.warehouse_empty_stock TO service_role;
ALTER TABLE public.warehouse_empty_stock ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='warehouse_empty_stock' AND policyname='Empty stock readable') THEN
    CREATE POLICY "Empty stock readable" ON public.warehouse_empty_stock FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_negative_empty_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.barrels < 0 THEN
    RAISE EXCEPTION 'Vazios insuficientes de % no estoque (saldo ficaria em %). Não é possível devolver mais vasilhames do que os recolhidos.',
      NEW.brand, NEW.barrels USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_prevent_neg_empty_stock ON public.warehouse_empty_stock;
CREATE TRIGGER trg_prevent_neg_empty_stock BEFORE INSERT OR UPDATE ON public.warehouse_empty_stock
  FOR EACH ROW EXECUTE FUNCTION public.prevent_negative_empty_stock();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'empty_move_origin') THEN
    CREATE TYPE public.empty_move_origin AS ENUM ('recolhimento_bar','devolucao_heineken','transferencia','ajuste');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.empty_movements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  brand        chopp_brand NOT NULL,
  quantidade   integer NOT NULL CHECK (quantidade > 0),
  direction    smallint NOT NULL CHECK (direction IN (-1, 1)),
  origem       public.empty_move_origin NOT NULL,
  bar_id       uuid REFERENCES public.bars(id) ON DELETE SET NULL,
  empties_id   uuid REFERENCES public.empties_removed(id) ON DELETE SET NULL,
  carga_id     uuid REFERENCES public.heineken_cargas(id) ON DELETE SET NULL,
  nf_id        uuid REFERENCES public.notas_fiscais(id) ON DELETE SET NULL,
  notes        text,
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_empty_mov_wh_time ON public.empty_movements(warehouse_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_empty_mov_origem ON public.empty_movements(origem, performed_at DESC);
GRANT SELECT, INSERT ON public.empty_movements TO authenticated;
GRANT ALL ON public.empty_movements TO service_role;
ALTER TABLE public.empty_movements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='empty_movements' AND policyname='Empty movements readable') THEN
    CREATE POLICY "Empty movements readable" ON public.empty_movements FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='empty_movements' AND policyname='Gestor manutencao insert empty movements') THEN
    CREATE POLICY "Gestor manutencao insert empty movements" ON public.empty_movements FOR INSERT TO authenticated
      WITH CHECK (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.apply_empty_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.warehouse_empty_stock(warehouse_id, brand, barrels, updated_at)
  VALUES (NEW.warehouse_id, NEW.brand, NEW.direction * NEW.quantidade, now())
  ON CONFLICT (warehouse_id, brand) DO UPDATE
    SET barrels = warehouse_empty_stock.barrels + NEW.direction * NEW.quantidade, updated_at = now();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_apply_empty_movement ON public.empty_movements;
CREATE TRIGGER trg_apply_empty_movement AFTER INSERT ON public.empty_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_empty_movement();

CREATE OR REPLACE FUNCTION public.apply_empties_to_comodato()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dispel uuid;
BEGIN
  IF NEW.quantidade IS NULL OR NEW.quantidade <= 0 THEN RETURN NEW; END IF;
  IF NEW.brand::text NOT IN ('heineken','amstel') THEN RETURN NEW; END IF;
  SELECT id INTO v_dispel FROM public.warehouses WHERE code = 'dispel' LIMIT 1;
  IF v_dispel IS NOT NULL THEN
    INSERT INTO public.empty_movements(warehouse_id, brand, quantidade, direction, origem, bar_id, empties_id, performed_by, notes)
    VALUES (v_dispel, NEW.brand, NEW.quantidade, 1, 'recolhimento_bar', NEW.bar_id, NEW.id, NEW.performed_by, 'Recolhido do bar');
  END IF;
  UPDATE public.controle_comodato_global
     SET vazios_disponiveis = vazios_disponiveis + NEW.quantidade, updated_at = now()
   WHERE marca = NEW.brand::text;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.apply_carga_vasilhames()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dispel uuid; v_total int; v_saldo_h int; v_saldo_a int; v_soma int; v_baixa_h int; v_baixa_a int;
BEGIN
  v_total := COALESCE(NEW.vasilhames_recolhidos, 0);
  IF v_total <= 0 THEN RETURN NEW; END IF;
  SELECT id INTO v_dispel FROM public.warehouses WHERE code = 'dispel' LIMIT 1;
  IF v_dispel IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(barrels,0) INTO v_saldo_h FROM public.warehouse_empty_stock WHERE warehouse_id = v_dispel AND brand = 'heineken';
  SELECT COALESCE(barrels,0) INTO v_saldo_a FROM public.warehouse_empty_stock WHERE warehouse_id = v_dispel AND brand = 'amstel';
  v_saldo_h := COALESCE(v_saldo_h, 0); v_saldo_a := COALESCE(v_saldo_a, 0); v_soma := v_saldo_h + v_saldo_a;
  IF v_soma <= 0 THEN RAISE NOTICE 'Sem vazios no estoque; nada baixado.'; RETURN NEW; END IF;
  IF v_total > v_soma THEN v_total := v_soma; END IF;
  v_baixa_h := LEAST(v_saldo_h, (v_total * v_saldo_h) / v_soma);
  v_baixa_a := v_total - v_baixa_h;
  IF v_baixa_a > v_saldo_a THEN v_baixa_a := v_saldo_a; v_baixa_h := v_total - v_baixa_a; END IF;
  IF v_baixa_h > 0 THEN
    INSERT INTO public.empty_movements(warehouse_id, brand, quantidade, direction, origem, carga_id, performed_by, notes)
    VALUES (v_dispel, 'heineken', v_baixa_h, -1, 'devolucao_heineken', NEW.id, NEW.performed_by, 'Vasilhames levados pela carga');
    UPDATE public.controle_comodato_global SET vazios_disponiveis = GREATEST(0, vazios_disponiveis - v_baixa_h),
      vazios_devolvidos_acumulados = vazios_devolvidos_acumulados + v_baixa_h, updated_at = now() WHERE marca = 'heineken';
  END IF;
  IF v_baixa_a > 0 THEN
    INSERT INTO public.empty_movements(warehouse_id, brand, quantidade, direction, origem, carga_id, performed_by, notes)
    VALUES (v_dispel, 'amstel', v_baixa_a, -1, 'devolucao_heineken', NEW.id, NEW.performed_by, 'Vasilhames levados pela carga');
    UPDATE public.controle_comodato_global SET vazios_disponiveis = GREATEST(0, vazios_disponiveis - v_baixa_a),
      vazios_devolvidos_acumulados = vazios_devolvidos_acumulados + v_baixa_a, updated_at = now() WHERE marca = 'amstel';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_apply_carga_vasilhames ON public.heineken_cargas;
CREATE TRIGGER trg_apply_carga_vasilhames AFTER INSERT ON public.heineken_cargas
  FOR EACH ROW EXECUTE FUNCTION public.apply_carga_vasilhames();

DO $$
DECLARE v_dispel uuid; v_qtd int;
BEGIN
  SELECT id INTO v_dispel FROM public.warehouses WHERE code = 'dispel' LIMIT 1;
  IF v_dispel IS NULL THEN RETURN; END IF;
  INSERT INTO public.empty_movements(warehouse_id, brand, quantidade, direction, origem, bar_id, empties_id, performed_by, performed_at, notes)
  SELECT v_dispel, e.brand, e.quantidade, 1, 'recolhimento_bar', e.bar_id, e.id, e.performed_by, e.performed_at, 'Backfill do histórico de recolhimentos'
    FROM public.empties_removed e
   WHERE e.quantidade > 0
     AND NOT EXISTS (SELECT 1 FROM public.empty_movements m WHERE m.empties_id = e.id);
  GET DIAGNOSTICS v_qtd = ROW_COUNT;
  RAISE NOTICE 'Backfill de vazios: % movimentos criados.', v_qtd;
END $$;

COMMENT ON TABLE public.warehouse_empty_stock IS 'Vasilhames VAZIOS parados no armazém, aguardando retirada pela cervejaria.';
COMMENT ON TABLE public.empty_movements IS 'Extrato do vasilhame vazio: entra por recolhimento no bar, sai por devolução à cervejaria.';

-- ============ 20260724200000_balanco_barris ============
INSERT INTO public.warehouse_empty_stock (warehouse_id, brand, barrels)
SELECT w.id, b.brand, 0
  FROM public.warehouses w
 CROSS JOIN (VALUES ('heineken'::chopp_brand), ('amstel'::chopp_brand)) AS b(brand)
ON CONFLICT (warehouse_id, brand) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.allstar_pontos_declaracao (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data         date NOT NULL DEFAULT CURRENT_DATE,
  brand        chopp_brand NOT NULL,
  cheios_nos_pontos integer NOT NULL DEFAULT 0 CHECK (cheios_nos_pontos >= 0),
  vazios_nos_pontos integer NOT NULL DEFAULT 0 CHECK (vazios_nos_pontos >= 0),
  notes        text,
  performed_by uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data, brand)
);
GRANT SELECT, INSERT, UPDATE ON public.allstar_pontos_declaracao TO authenticated;
GRANT ALL ON public.allstar_pontos_declaracao TO service_role;
ALTER TABLE public.allstar_pontos_declaracao ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='allstar_pontos_declaracao' AND policyname='Allstar decl readable') THEN
    CREATE POLICY "Allstar decl readable" ON public.allstar_pontos_declaracao FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='allstar_pontos_declaracao' AND policyname='Gestor manutencao manage allstar decl') THEN
    CREATE POLICY "Gestor manutencao manage allstar decl" ON public.allstar_pontos_declaracao FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'))
      WITH CHECK (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'));
  END IF;
END $$;

-- (balanco_barris v1 será substituída na próxima migration; pulamos direto para a v2 para evitar dupla criação)

-- ============ 20260724210000_vasilhames_sem_marca ============
CREATE TABLE IF NOT EXISTS public.warehouse_vasilhames (
  warehouse_id uuid PRIMARY KEY REFERENCES public.warehouses(id) ON DELETE CASCADE,
  barrels      integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.warehouse_vasilhames TO authenticated;
GRANT ALL ON public.warehouse_vasilhames TO service_role;
ALTER TABLE public.warehouse_vasilhames ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='warehouse_vasilhames' AND policyname='Vasilhames readable') THEN
    CREATE POLICY "Vasilhames readable" ON public.warehouse_vasilhames FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_negative_vasilhames()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.barrels < 0 THEN
    RAISE EXCEPTION 'Vasilhames insuficientes no estoque (saldo ficaria em %).', NEW.barrels USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_prevent_neg_vasilhames ON public.warehouse_vasilhames;
CREATE TRIGGER trg_prevent_neg_vasilhames BEFORE INSERT OR UPDATE ON public.warehouse_vasilhames
  FOR EACH ROW EXECUTE FUNCTION public.prevent_negative_vasilhames();

INSERT INTO public.warehouse_vasilhames (warehouse_id, barrels)
SELECT id, 0 FROM public.warehouses ON CONFLICT (warehouse_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.apply_empty_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text;
BEGIN
  SELECT code INTO v_code FROM public.warehouses WHERE id = NEW.warehouse_id;
  IF v_code = 'dispel' THEN
    INSERT INTO public.warehouse_vasilhames(warehouse_id, barrels, updated_at)
    VALUES (NEW.warehouse_id, NEW.direction * NEW.quantidade, now())
    ON CONFLICT (warehouse_id) DO UPDATE
      SET barrels = warehouse_vasilhames.barrels + NEW.direction * NEW.quantidade, updated_at = now();
  ELSE
    INSERT INTO public.warehouse_empty_stock(warehouse_id, brand, barrels, updated_at)
    VALUES (NEW.warehouse_id, NEW.brand, NEW.direction * NEW.quantidade, now())
    ON CONFLICT (warehouse_id, brand) DO UPDATE
      SET barrels = warehouse_empty_stock.barrels + NEW.direction * NEW.quantidade, updated_at = now();
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.apply_carga_vasilhames()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dispel uuid; v_total int; v_saldo int;
BEGIN
  v_total := COALESCE(NEW.vasilhames_recolhidos, 0);
  IF v_total <= 0 THEN RETURN NEW; END IF;
  SELECT id INTO v_dispel FROM public.warehouses WHERE code = 'dispel' LIMIT 1;
  IF v_dispel IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(barrels, 0) INTO v_saldo FROM public.warehouse_vasilhames WHERE warehouse_id = v_dispel;
  v_saldo := COALESCE(v_saldo, 0);
  IF v_saldo <= 0 THEN RAISE NOTICE 'Pool zerado; nada baixado.'; RETURN NEW; END IF;
  IF v_total > v_saldo THEN v_total := v_saldo; END IF;
  INSERT INTO public.empty_movements(warehouse_id, brand, quantidade, direction, origem, carga_id, performed_by, notes)
  VALUES (v_dispel, 'heineken', v_total, -1, 'devolucao_heineken', NEW.id, NEW.performed_by, 'Vasilhames levados pela carga (pool sem marca)');
  UPDATE public.controle_comodato_global
     SET vazios_devolvidos_acumulados = vazios_devolvidos_acumulados + v_total,
         vazios_disponiveis = GREATEST(0, vazios_disponiveis - v_total), updated_at = now()
   WHERE marca = 'heineken';
  RETURN NEW;
END; $$;

DO $$
DECLARE v_dispel uuid; v_soma int;
BEGIN
  SELECT id INTO v_dispel FROM public.warehouses WHERE code = 'dispel' LIMIT 1;
  IF v_dispel IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(barrels), 0) INTO v_soma FROM public.warehouse_empty_stock WHERE warehouse_id = v_dispel;
  IF v_soma > 0 THEN
    INSERT INTO public.warehouse_vasilhames(warehouse_id, barrels, updated_at)
    VALUES (v_dispel, v_soma, now())
    ON CONFLICT (warehouse_id) DO UPDATE SET barrels = v_soma, updated_at = now();
    DELETE FROM public.warehouse_empty_stock WHERE warehouse_id = v_dispel;
    RAISE NOTICE 'Vazios do DISPEL agrupados em % vasilhames.', v_soma;
  END IF;
END $$;

COMMENT ON TABLE public.warehouse_vasilhames IS 'Vasilhames VAZIOS agrupados (sem marca) no armazém.';

-- ============ 20260724220000_balanco_v2_vasilhames ============
DROP FUNCTION IF EXISTS public.balanco_barris();

CREATE OR REPLACE FUNCTION public.balanco_barris()
RETURNS TABLE (
  marca text, recebido int, devolvido int, disp_cheio int, vasilhames_dispel int,
  allstar_cheio int, allstar_vazio int, bar_plugado int, bar_fechado int, bar_vazio int,
  pontos_allstar_cheio int, pontos_allstar_vazio int, rastreavel int, em_maos int, quebra int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH
ent AS (
  SELECT m.brand::text AS marca, COALESCE(SUM(m.quantidade),0)::int AS qtd
    FROM public.warehouse_movements m
   WHERE m.direction = 1 AND m.move_type = 'entrada'
   GROUP BY 1
),
dev AS (SELECT COALESCE(SUM(vazios_devolvidos_acumulados),0)::int AS qtd FROM public.controle_comodato_global),
vas AS (
  SELECT COALESCE(SUM(v.barrels),0)::int AS qtd
    FROM public.warehouse_vasilhames v JOIN public.warehouses w ON w.id = v.warehouse_id
   WHERE w.code = 'dispel'
),
wh_cheio AS (
  SELECT s.brand::text AS marca, w.code, COALESCE(s.barrels,0)::int AS qtd
    FROM public.warehouse_stock s JOIN public.warehouses w ON w.id = s.warehouse_id
),
wh_vazio AS (
  SELECT s.brand::text AS marca, w.code, COALESCE(s.barrels,0)::int AS qtd
    FROM public.warehouse_empty_stock s JOIN public.warehouses w ON w.id = s.warehouse_id
   WHERE w.code <> 'dispel'
),
ult AS (
  SELECT DISTINCT ON (i.bar_id) i.id, i.bar_id, i.performed_at
    FROM public.inventories i JOIN public.bars b ON b.id = i.bar_id
   WHERE b.bar_type IN ('bar_venda','bar_parceiro')
   ORDER BY i.bar_id, i.performed_at DESC
),
inv AS (
  SELECT it.brand::text AS marca, it.status::text AS status, COALESCE(SUM(it.quantidade),0)::int AS qtd
    FROM public.inventory_items it JOIN ult ON ult.id = it.inventory_id
   GROUP BY 1,2
),
recolhido_apos AS (
  SELECT e.brand::text AS marca, COALESCE(SUM(e.quantidade),0)::int AS qtd
    FROM public.empties_removed e JOIN ult ON ult.bar_id = e.bar_id
   WHERE e.performed_at > ult.performed_at
   GROUP BY 1
),
alls AS (
  SELECT DISTINCT ON (d.brand) d.brand::text AS marca,
         d.cheios_nos_pontos::int AS cheios, d.vazios_nos_pontos::int AS vazios
    FROM public.allstar_pontos_declaracao d
   ORDER BY d.brand, d.data DESC
),
por_marca AS (
  SELECT
    mk.marca,
    COALESCE((SELECT qtd FROM ent WHERE ent.marca = mk.marca),0)                              AS recebido,
    COALESCE((SELECT qtd FROM wh_cheio WHERE wh_cheio.marca=mk.marca AND code='dispel'),0)    AS disp_cheio,
    COALESCE((SELECT qtd FROM wh_cheio WHERE wh_cheio.marca=mk.marca AND code='allstar'),0)   AS allstar_cheio,
    COALESCE((SELECT qtd FROM wh_vazio WHERE wh_vazio.marca=mk.marca AND code='allstar'),0)   AS allstar_vazio,
    COALESCE((SELECT qtd FROM inv WHERE inv.marca=mk.marca AND status='plugado'),0)           AS bar_plugado,
    COALESCE((SELECT qtd FROM inv WHERE inv.marca=mk.marca AND status='fechado'),0)           AS bar_fechado,
    GREATEST(0, COALESCE((SELECT qtd FROM inv WHERE inv.marca=mk.marca AND status='vazio'),0)
      - COALESCE((SELECT qtd FROM recolhido_apos WHERE recolhido_apos.marca=mk.marca),0))     AS bar_vazio,
    COALESCE((SELECT cheios FROM alls WHERE alls.marca=mk.marca),0)                           AS pt_cheio,
    COALESCE((SELECT vazios FROM alls WHERE alls.marca=mk.marca),0)                           AS pt_vazio
  FROM (SELECT unnest(ARRAY['heineken','amstel']) AS marca) mk
),
com_rastr AS (
  SELECT p.*, (p.disp_cheio + p.allstar_cheio + p.allstar_vazio
               + p.bar_plugado + p.bar_fechado + p.bar_vazio + p.pt_cheio + p.pt_vazio) AS rastreavel
    FROM por_marca p
)
SELECT r.marca, r.recebido, 0 AS devolvido, r.disp_cheio, 0 AS vasilhames_dispel,
       r.allstar_cheio, r.allstar_vazio, r.bar_plugado, r.bar_fechado, r.bar_vazio,
       r.pt_cheio, r.pt_vazio, r.rastreavel, r.rastreavel AS em_maos,
       (r.recebido - r.rastreavel) AS quebra
  FROM com_rastr r
UNION ALL
SELECT 'TOTAL',
       (SELECT SUM(recebido)::int FROM com_rastr),
       (SELECT qtd FROM dev),
       (SELECT SUM(disp_cheio)::int FROM com_rastr),
       (SELECT qtd FROM vas),
       (SELECT SUM(allstar_cheio)::int FROM com_rastr),
       (SELECT SUM(allstar_vazio)::int FROM com_rastr),
       (SELECT SUM(bar_plugado)::int FROM com_rastr),
       (SELECT SUM(bar_fechado)::int FROM com_rastr),
       (SELECT SUM(bar_vazio)::int FROM com_rastr),
       (SELECT SUM(pt_cheio)::int FROM com_rastr),
       (SELECT SUM(pt_vazio)::int FROM com_rastr),
       (SELECT SUM(rastreavel)::int FROM com_rastr),
       (SELECT SUM(rastreavel)::int FROM com_rastr) + (SELECT qtd FROM vas),
       (SELECT SUM(recebido)::int FROM com_rastr) - (SELECT qtd FROM dev)
         - ((SELECT SUM(rastreavel)::int FROM com_rastr) + (SELECT qtd FROM vas));
$$;
GRANT EXECUTE ON FUNCTION public.balanco_barris() TO authenticated;
COMMENT ON FUNCTION public.balanco_barris() IS 'Balanço do parque. Linha TOTAL fecha; linhas por marca são informativas.';

-- ============ 20260724230000_meep_e_abastecimento ============
CREATE OR REPLACE VIEW public.meep_entregue_bar AS
  SELECT id, bar_id, bar_nome, data, marca, barris AS barris_entregues, created_at
    FROM public.meep_consumo_bar;
COMMENT ON VIEW public.meep_entregue_bar IS 'Barris ENTREGUES a cada bar; renomeação semântica de meep_consumo_bar.';
COMMENT ON TABLE public.meep_consumo_bar IS '⚠️ NOME ENGANOSO: guarda ABASTECIMENTO, não consumo. Prefira meep_entregue_bar.';
GRANT SELECT ON public.meep_entregue_bar TO authenticated;
GRANT ALL ON public.meep_entregue_bar TO service_role;

CREATE OR REPLACE FUNCTION public.conferir_abastecimento_meep()
RETURNS TABLE (bar_nome text, marca text, meep int, app int, diferenca int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH m AS (
  SELECT COALESCE(b.name, c.bar_nome) AS bar_nome, c.marca::text AS marca, SUM(c.barris)::int AS qtd
    FROM public.meep_consumo_bar c LEFT JOIN public.bars b ON b.id = c.bar_id
   GROUP BY 1, 2
),
a AS (
  SELECT b.name AS bar_nome, ri.brand::text AS marca, SUM(ri.quantidade)::int AS qtd
    FROM public.refill_items ri
    JOIN public.refills r ON r.id = ri.refill_id
    JOIN public.bars b ON b.id = r.bar_id
   GROUP BY 1, 2
)
SELECT COALESCE(m.bar_nome, a.bar_nome), COALESCE(m.marca, a.marca),
       COALESCE(m.qtd, 0), COALESCE(a.qtd, 0), COALESCE(m.qtd, 0) - COALESCE(a.qtd, 0)
  FROM m FULL OUTER JOIN a ON a.bar_nome = m.bar_nome AND a.marca = m.marca
 ORDER BY abs(COALESCE(m.qtd,0) - COALESCE(a.qtd,0)) DESC;
$$;
GRANT EXECUTE ON FUNCTION public.conferir_abastecimento_meep() TO authenticated;
COMMENT ON FUNCTION public.conferir_abastecimento_meep() IS 'Cruza abastecimento bipado na MEEP contra reposições registradas no app.';