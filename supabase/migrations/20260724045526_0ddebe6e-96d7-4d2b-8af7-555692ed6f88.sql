-- ============ 140000: refills.photo_url opcional ============
ALTER TABLE public.refills ALTER COLUMN photo_url DROP NOT NULL;

-- ============ 150000: fix move_type inválido ============
CREATE OR REPLACE FUNCTION public.apply_heineken_carga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispel uuid;
  v_note text;
BEGIN
  SELECT id INTO v_dispel FROM public.warehouses WHERE code = 'dispel' LIMIT 1;
  IF v_dispel IS NULL THEN RETURN NEW; END IF;

  v_note := 'Carga Heineken' || CASE WHEN NEW.invoice_number IS NOT NULL AND NEW.invoice_number <> '' THEN ' NF ' || NEW.invoice_number ELSE '' END;

  IF NEW.heineken_barris > 0 THEN
    INSERT INTO public.warehouse_movements(warehouse_id, move_type, brand, quantidade, direction, performed_by, notes, photo_url)
    VALUES (v_dispel, 'entrada', 'heineken', NEW.heineken_barris, 1, NEW.performed_by, v_note, NEW.invoice_photo_url);
  END IF;
  IF NEW.amstel_barris > 0 THEN
    INSERT INTO public.warehouse_movements(warehouse_id, move_type, brand, quantidade, direction, performed_by, notes, photo_url)
    VALUES (v_dispel, 'entrada', 'amstel', NEW.amstel_barris, 1, NEW.performed_by, v_note, NEW.invoice_photo_url);
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'conciliar_nota_fiscal'
   LIMIT 1;

  IF v_src IS NULL THEN
    RAISE NOTICE 'conciliar_nota_fiscal não encontrada — nada a corrigir.';
  ELSIF position('recebimento_heineken' in v_src) = 0 THEN
    RAISE NOTICE 'conciliar_nota_fiscal já está correta.';
  ELSE
    v_src := replace(v_src, '''recebimento_heineken''', '''entrada''');
    EXECUTE v_src;
    RAISE NOTICE 'conciliar_nota_fiscal corrigida.';
  END IF;
END $$;

-- ============ 160000: nomes oficiais / rotas / padrões ============
DO $$
DECLARE
  m        RECORD;
  v_bar    uuid;
  v_rota   uuid;
  faltando text := '';
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      ('Fundo Arquibancada',      'Rota 1',   6,  6),
      ('Meio Arquibancada',       'Rota 1',   6,  6),
      ('Entrada Arquibancada',    'Rota 2',  10, 10),
      ('Nova Arquibancada',       'Rota 2',   6,  6),
      ('Vila 1',                  'Rota 3',  20, 20),
      ('Choperia 1',              'Rota 3',   6,  6),
      ('Choperia 2',              'Rota 3',   6,  6),
      ('Vila 2 Maior',            'Rota 4',  20, 20),
      ('Vila 2 Menor',            'Rota 4',   6,  6),
      ('Vila 3 Maior',            'Rota 4',  10, 10),
      ('Vila 3 Menor',            'Rota 4',   6,  6),
      ('Núcleos',                 'Rota 5',  10, 10),
      ('Churrascaria',            'Rota 5',   6,  6)
    ) AS t(nome, rota, ph, pa)
  LOOP
    SELECT id INTO v_bar FROM public.bars
     WHERE btrim(lower(name)) = btrim(lower(m.nome)) LIMIT 1;

    IF v_bar IS NULL THEN
      faltando := faltando || m.nome || ', ';
      RAISE NOTICE 'BAR NÃO ENCONTRADO: %', m.nome;
      CONTINUE;
    END IF;

    SELECT id INTO v_rota FROM public.rotas WHERE nome = m.rota;
    UPDATE public.bars SET rota_id = v_rota WHERE id = v_bar;

    INSERT INTO public.bar_stock_standard (bar_id, brand, barris_padrao)
      VALUES (v_bar, 'heineken', m.ph)
      ON CONFLICT (bar_id, brand) DO UPDATE SET barris_padrao = EXCLUDED.barris_padrao;
    INSERT INTO public.bar_stock_standard (bar_id, brand, barris_padrao)
      VALUES (v_bar, 'amstel', m.pa)
      ON CONFLICT (bar_id, brand) DO UPDATE SET barris_padrao = EXCLUDED.barris_padrao;
  END LOOP;

  IF faltando <> '' THEN
    RAISE NOTICE '>>> Confira estes nomes em bars.name: %', faltando;
  END IF;
END $$;

DO $$
DECLARE v_bar uuid; v_rota uuid;
BEGIN
  SELECT id INTO v_bar FROM public.bars
   WHERE btrim(lower(name)) IN ('bar da pista','pista') LIMIT 1;
  SELECT id INTO v_rota FROM public.rotas WHERE nome = 'Rota 2';
  IF v_bar IS NULL THEN
    RAISE NOTICE 'BAR NÃO ENCONTRADO: Bar da Pista';
  ELSE
    UPDATE public.bars SET rota_id = v_rota WHERE id = v_bar;
  END IF;
END $$;

UPDATE public.bars SET rota_id = NULL
 WHERE btrim(lower(name)) IN ('zel café','zel cafe');

-- ============ 170000: fundir Choperia 1+2 ============
DO $$
DECLARE
  v_keep uuid;
  v_drop uuid;
BEGIN
  SELECT id INTO v_keep FROM public.bars
   WHERE btrim(lower(name)) = 'choperia 1' LIMIT 1;
  SELECT id INTO v_drop FROM public.bars
   WHERE btrim(lower(name)) = 'choperia 2' LIMIT 1;

  IF v_keep IS NULL AND v_drop IS NULL THEN
    RAISE NOTICE 'Choperia 1/2 não encontrados.';
    RETURN;
  END IF;

  IF v_keep IS NULL OR v_drop IS NULL THEN
    UPDATE public.bars SET name = 'Choperia'
     WHERE id = COALESCE(v_keep, v_drop);
    RETURN;
  END IF;

  UPDATE public.inventories                 SET bar_id = v_keep WHERE bar_id = v_drop;
  UPDATE public.refills                     SET bar_id = v_keep WHERE bar_id = v_drop;
  UPDATE public.empties_removed             SET bar_id = v_keep WHERE bar_id = v_drop;
  UPDATE public.bar_temperature_checks      SET bar_id = v_keep WHERE bar_id = v_drop;
  UPDATE public.bar_organization_checks     SET bar_id = v_keep WHERE bar_id = v_drop;
  UPDATE public.bar_machines                SET bar_id = v_keep WHERE bar_id = v_drop;
  UPDATE public.bar_maintenance_logs        SET bar_id = v_keep WHERE bar_id = v_drop;
  UPDATE public.bar_shifts                  SET bar_id = v_keep WHERE bar_id = v_drop;
  UPDATE public.bar_staff_checks            SET bar_id = v_keep WHERE bar_id = v_drop;
  UPDATE public.bar_card_machine_sessions   SET bar_id = v_keep WHERE bar_id = v_drop;
  UPDATE public.bar_machine_patrimonios     SET bar_id = v_keep WHERE bar_id = v_drop;
  UPDATE public.qr_tokens                   SET bar_id = v_keep WHERE bar_id = v_drop;
  UPDATE public.warehouse_movements         SET bar_id = v_keep WHERE bar_id = v_drop;
  UPDATE public.public_maintenance_requests SET bar_id = v_keep WHERE bar_id = v_drop;
  UPDATE public.meep_vendas_bar             SET bar_id = v_keep WHERE bar_id = v_drop;
  UPDATE public.meep_consumo_bar            SET bar_id = v_keep WHERE bar_id = v_drop;

  UPDATE public.bar_stock_standard k
     SET barris_padrao = k.barris_padrao + d.barris_padrao
    FROM public.bar_stock_standard d
   WHERE k.bar_id = v_keep AND d.bar_id = v_drop AND k.brand = d.brand;
  UPDATE public.bar_stock_standard SET bar_id = v_keep
   WHERE bar_id = v_drop
     AND brand NOT IN (SELECT brand FROM public.bar_stock_standard WHERE bar_id = v_keep);
  DELETE FROM public.bar_stock_standard WHERE bar_id = v_drop;

  UPDATE public.bar_card_readers k
     SET quantidade = k.quantidade + d.quantidade
    FROM public.bar_card_readers d
   WHERE k.bar_id = v_keep AND d.bar_id = v_drop;
  UPDATE public.bar_card_readers SET bar_id = v_keep
   WHERE bar_id = v_drop
     AND NOT EXISTS (SELECT 1 FROM public.bar_card_readers WHERE bar_id = v_keep);
  DELETE FROM public.bar_card_readers WHERE bar_id = v_drop;

  UPDATE public.bar_installations SET bar_id = v_keep
   WHERE bar_id = v_drop
     AND NOT EXISTS (SELECT 1 FROM public.bar_installations WHERE bar_id = v_keep);
  DELETE FROM public.bar_installations WHERE bar_id = v_drop;

  UPDATE public.bar_transfers SET from_bar_id = v_keep WHERE from_bar_id = v_drop;
  UPDATE public.bar_transfers SET to_bar_id   = v_keep WHERE to_bar_id   = v_drop;
  DELETE FROM public.bar_transfer_items
   WHERE transfer_id IN (SELECT id FROM public.bar_transfers WHERE from_bar_id = to_bar_id);
  DELETE FROM public.bar_transfers WHERE from_bar_id = to_bar_id;

  UPDATE public.bars SET name = 'Choperia' WHERE id = v_keep;
  DELETE FROM public.bars WHERE id = v_drop;
END $$;

UPDATE public.meep_consumo_bar SET bar_nome = 'Choperia'
 WHERE btrim(lower(bar_nome)) IN ('choperia (1+2)', 'choperia 1', 'choperia 2', 'chopperia');

UPDATE public.meep_consumo_bar c
   SET bar_id = b.id
  FROM public.bars b
 WHERE btrim(lower(b.name)) = 'choperia'
   AND btrim(lower(c.bar_nome)) = 'choperia'
   AND c.bar_id IS DISTINCT FROM b.id;

-- ============ 180000: view meep_abastecimento_bar ============
CREATE OR REPLACE VIEW public.meep_abastecimento_bar AS
  SELECT id, bar_id, cartao, data, categoria, produto, quantidade, valor, is_chopp, created_at
  FROM public.meep_vendas_bar;

COMMENT ON VIEW public.meep_abastecimento_bar IS
  'Barris de chopp ENTREGUES a cada bar (evento de ESTOQUE da MEEP). Alias correto de meep_vendas_bar.';
COMMENT ON TABLE public.meep_vendas_bar IS
  'ABASTECIMENTO por bar (barris entregues). Mantida por compatibilidade; prefira meep_abastecimento_bar.';
COMMENT ON TABLE public.meep_consumo_bar IS
  'CONSUMO real de venda por bar/dia/marca (evento de vendas da MEEP).';

GRANT SELECT, INSERT, UPDATE ON public.meep_abastecimento_bar TO authenticated;
GRANT ALL ON public.meep_abastecimento_bar TO service_role;