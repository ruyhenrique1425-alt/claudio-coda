-- =====================================================================
-- FUSÃO: Choperia 1 + Choperia 2 → "Choperia"
--
-- MOTIVO (confirmado pelo gestor): os dois pontos ficam um em cima do
-- outro e compartilham UM ÚNICO cartão da MEEP. Como o consumo não pode
-- ser separado na origem, tratá-los como dois bares no app produz
-- números que não têm como ser conferidos. Viram um ponto só.
--
-- ⚠️ ESTA MIGRATION ALTERA DADOS (repontua registros e apaga uma linha de
--    `bars`). NÃO É REVERSÍVEL. Rode o BACKUP antes (tela BACKUPS).
--
-- PADRÃO RESULTANTE: soma dos dois (6+6 = 12 Heineken, 6+6 = 12 Amstel).
--    Os dois pontos continuam existindo fisicamente e servindo chopp, só
--    são geridos como um. ⚠️ Se o gestor quiser outro número, ajuste aqui
--    antes de aplicar.
--
-- Idempotente: se já houver só "Choperia", não faz nada.
-- =====================================================================

DO $$
DECLARE
  v_keep uuid;   -- Choperia 1 (sobrevive, vira "Choperia")
  v_drop uuid;   -- Choperia 2 (some)
BEGIN
  SELECT id INTO v_keep FROM public.bars
   WHERE btrim(lower(name)) = 'choperia 1' LIMIT 1;
  SELECT id INTO v_drop FROM public.bars
   WHERE btrim(lower(name)) = 'choperia 2' LIMIT 1;

  IF v_keep IS NULL AND v_drop IS NULL THEN
    RAISE NOTICE 'Choperia 1/2 não encontrados — nada a fundir (já fundido?).';
    RETURN;
  END IF;

  -- Só existe um dos dois: apenas normaliza o nome.
  IF v_keep IS NULL OR v_drop IS NULL THEN
    UPDATE public.bars SET name = 'Choperia'
     WHERE id = COALESCE(v_keep, v_drop);
    RAISE NOTICE 'Só um ponto Choperia existia — renomeado para "Choperia".';
    RETURN;
  END IF;

  -- ---------- 1) Tabelas com bar_id simples (sem unicidade) ----------
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

  -- ---------- 2) bar_stock_standard: UNIQUE(bar_id, brand) → soma ----------
  UPDATE public.bar_stock_standard k
     SET barris_padrao = k.barris_padrao + d.barris_padrao
    FROM public.bar_stock_standard d
   WHERE k.bar_id = v_keep AND d.bar_id = v_drop AND k.brand = d.brand;
  -- marca que só existia no Choperia 2: migra a linha inteira
  UPDATE public.bar_stock_standard SET bar_id = v_keep
   WHERE bar_id = v_drop
     AND brand NOT IN (SELECT brand FROM public.bar_stock_standard WHERE bar_id = v_keep);
  DELETE FROM public.bar_stock_standard WHERE bar_id = v_drop;

  -- ---------- 3) UNIQUE(bar_id): soma quantidade e descarta a duplicada ----------
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

  -- ---------- 4) bar_transfers: duas FKs; some transferência interna ----------
  UPDATE public.bar_transfers SET from_bar_id = v_keep WHERE from_bar_id = v_drop;
  UPDATE public.bar_transfers SET to_bar_id   = v_keep WHERE to_bar_id   = v_drop;
  -- transferências que viraram "de si para si mesmo" deixam de fazer sentido
  DELETE FROM public.bar_transfer_items
   WHERE transfer_id IN (SELECT id FROM public.bar_transfers WHERE from_bar_id = to_bar_id);
  DELETE FROM public.bar_transfers WHERE from_bar_id = to_bar_id;

  -- ---------- 5) Consolida e remove ----------
  UPDATE public.bars SET name = 'Choperia' WHERE id = v_keep;
  DELETE FROM public.bars WHERE id = v_drop;

  RAISE NOTICE 'Choperia 1 + Choperia 2 fundidos em "Choperia" (padrão somado).';
END $$;

-- Alinha o histórico de consumo importado: o seed usava "Choperia (1+2)".
UPDATE public.meep_consumo_bar SET bar_nome = 'Choperia'
 WHERE btrim(lower(bar_nome)) IN ('choperia (1+2)', 'choperia 1', 'choperia 2', 'chopperia');

-- Reaponta o bar_id do consumo histórico para o bar consolidado.
UPDATE public.meep_consumo_bar c
   SET bar_id = b.id
  FROM public.bars b
 WHERE btrim(lower(b.name)) = 'choperia'
   AND btrim(lower(c.bar_nome)) = 'choperia'
   AND c.bar_id IS DISTINCT FROM b.id;
