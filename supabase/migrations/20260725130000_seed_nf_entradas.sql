-- =====================================================================
-- SEED NF — entradas de chopp no estoque DISPEL, VIA CÓDIGO (idempotente).
-- Insere warehouse_movements 'entrada'; o trigger trg_apply_warehouse_movement
-- atualiza warehouse_stock. Igual ao import manual do modo "Estoque", mas por
-- migration. Só insere linha que ainda não existe (nota+marca+qtd).
-- ⚠️ Aplicar SÓ depois de 20260724150000_fix_move_type_invalido.sql.
-- =====================================================================
DO $$
DECLARE v_dispel uuid;
BEGIN
  SELECT id INTO v_dispel FROM public.warehouses WHERE code='dispel' LIMIT 1;
  IF v_dispel IS NULL THEN RAISE NOTICE 'DISPEL nao encontrado; nada feito.'; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_movements WHERE notes='NF 001036767 (2026-07-14) CFOP 5403' AND brand='amstel' AND quantidade=48 AND direction=1) THEN
    INSERT INTO public.warehouse_movements (warehouse_id, brand, quantidade, direction, move_type, notes)
    VALUES (v_dispel, 'amstel', 48, 1, 'entrada', 'NF 001036767 (2026-07-14) CFOP 5403');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_movements WHERE notes='NF 001036767 (2026-07-14) CFOP 5403' AND brand='heineken' AND quantidade=48 AND direction=1) THEN
    INSERT INTO public.warehouse_movements (warehouse_id, brand, quantidade, direction, move_type, notes)
    VALUES (v_dispel, 'heineken', 48, 1, 'entrada', 'NF 001036767 (2026-07-14) CFOP 5403');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_movements WHERE notes='NF 001042364 (2026-07-20) CFOP 5403' AND brand='heineken' AND quantidade=30 AND direction=1) THEN
    INSERT INTO public.warehouse_movements (warehouse_id, brand, quantidade, direction, move_type, notes)
    VALUES (v_dispel, 'heineken', 30, 1, 'entrada', 'NF 001042364 (2026-07-20) CFOP 5403');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_movements WHERE notes='NF 001042364 (2026-07-20) CFOP 5403' AND brand='amstel' AND quantidade=30 AND direction=1) THEN
    INSERT INTO public.warehouse_movements (warehouse_id, brand, quantidade, direction, move_type, notes)
    VALUES (v_dispel, 'amstel', 30, 1, 'entrada', 'NF 001042364 (2026-07-20) CFOP 5403');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_movements WHERE notes='NF 001043518 (2026-07-21) CFOP 5403' AND brand='heineken' AND quantidade=30 AND direction=1) THEN
    INSERT INTO public.warehouse_movements (warehouse_id, brand, quantidade, direction, move_type, notes)
    VALUES (v_dispel, 'heineken', 30, 1, 'entrada', 'NF 001043518 (2026-07-21) CFOP 5403');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_movements WHERE notes='NF 001043518 (2026-07-21) CFOP 5403' AND brand='amstel' AND quantidade=20 AND direction=1) THEN
    INSERT INTO public.warehouse_movements (warehouse_id, brand, quantidade, direction, move_type, notes)
    VALUES (v_dispel, 'amstel', 20, 1, 'entrada', 'NF 001043518 (2026-07-21) CFOP 5403');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_movements WHERE notes='NF 001044368 (2026-07-21) CFOP 5403' AND brand='heineken' AND quantidade=30 AND direction=1) THEN
    INSERT INTO public.warehouse_movements (warehouse_id, brand, quantidade, direction, move_type, notes)
    VALUES (v_dispel, 'heineken', 30, 1, 'entrada', 'NF 001044368 (2026-07-21) CFOP 5403');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_movements WHERE notes='NF 001044368 (2026-07-21) CFOP 5403' AND brand='amstel' AND quantidade=30 AND direction=1) THEN
    INSERT INTO public.warehouse_movements (warehouse_id, brand, quantidade, direction, move_type, notes)
    VALUES (v_dispel, 'amstel', 30, 1, 'entrada', 'NF 001044368 (2026-07-21) CFOP 5403');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_movements WHERE notes='NF 001045254 (2026-07-22) CFOP 5403' AND brand='heineken' AND quantidade=45 AND direction=1) THEN
    INSERT INTO public.warehouse_movements (warehouse_id, brand, quantidade, direction, move_type, notes)
    VALUES (v_dispel, 'heineken', 45, 1, 'entrada', 'NF 001045254 (2026-07-22) CFOP 5403');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_movements WHERE notes='NF 001045254 (2026-07-22) CFOP 5910' AND brand='amstel' AND quantidade=46 AND direction=1) THEN
    INSERT INTO public.warehouse_movements (warehouse_id, brand, quantidade, direction, move_type, notes)
    VALUES (v_dispel, 'amstel', 46, 1, 'entrada', 'NF 001045254 (2026-07-22) CFOP 5910');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_movements WHERE notes='NF 001045256 (2026-07-22) CFOP 5403' AND brand='heineken' AND quantidade=25 AND direction=1) THEN
    INSERT INTO public.warehouse_movements (warehouse_id, brand, quantidade, direction, move_type, notes)
    VALUES (v_dispel, 'heineken', 25, 1, 'entrada', 'NF 001045256 (2026-07-22) CFOP 5403');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_movements WHERE notes='NF 001045256 (2026-07-22) CFOP 5403' AND brand='amstel' AND quantidade=25 AND direction=1) THEN
    INSERT INTO public.warehouse_movements (warehouse_id, brand, quantidade, direction, move_type, notes)
    VALUES (v_dispel, 'amstel', 25, 1, 'entrada', 'NF 001045256 (2026-07-22) CFOP 5403');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_movements WHERE notes='NF 001046581 (2026-07-23) CFOP 5403' AND brand='amstel' AND quantidade=20 AND direction=1) THEN
    INSERT INTO public.warehouse_movements (warehouse_id, brand, quantidade, direction, move_type, notes)
    VALUES (v_dispel, 'amstel', 20, 1, 'entrada', 'NF 001046581 (2026-07-23) CFOP 5403');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_movements WHERE notes='NF 001046581 (2026-07-23) CFOP 5403' AND brand='heineken' AND quantidade=20 AND direction=1) THEN
    INSERT INTO public.warehouse_movements (warehouse_id, brand, quantidade, direction, move_type, notes)
    VALUES (v_dispel, 'heineken', 20, 1, 'entrada', 'NF 001046581 (2026-07-23) CFOP 5403');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_movements WHERE notes='NF 001046581 (2026-07-23) CFOP 5910' AND brand='heineken' AND quantidade=6 AND direction=1) THEN
    INSERT INTO public.warehouse_movements (warehouse_id, brand, quantidade, direction, move_type, notes)
    VALUES (v_dispel, 'heineken', 6, 1, 'entrada', 'NF 001046581 (2026-07-23) CFOP 5910');
  END IF;
END $$;
