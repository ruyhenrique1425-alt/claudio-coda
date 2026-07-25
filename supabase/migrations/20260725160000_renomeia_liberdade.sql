-- =====================================================================
-- RENOMEIA "Churrascaria (liberdade)" → "Liberdade" (novo nome oficial).
-- Padrão/rota seguem por bar_id (não mudam). Corrige o CONSUMO da Liberdade
-- com a exportação nova (cartão ab253e8e), removendo o registro antigo de
-- churrascaria. Append-only e idempotente.
-- =====================================================================

-- 1) Renomeia o bar.
UPDATE public.bars SET name = 'Liberdade'
 WHERE translate(lower(btrim(name)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
       IN ('churrascaria liberdade','churrascaria');

-- 2) Reafirma rota (Rota 5) + padrão (6/6) na Liberdade — idempotente.
DO $$
DECLARE v_bar uuid; v_rota uuid;
BEGIN
  SELECT id INTO v_bar FROM public.bars WHERE lower(btrim(name)) = 'liberdade' LIMIT 1;
  IF v_bar IS NULL THEN RAISE NOTICE 'Liberdade não encontrada.'; RETURN; END IF;
  SELECT id INTO v_rota FROM public.rotas WHERE nome = 'Rota 5';
  UPDATE public.bars SET rota_id = v_rota WHERE id = v_bar;
  INSERT INTO public.bar_stock_standard (bar_id,brand,barris_padrao) VALUES (v_bar,'heineken',6)
    ON CONFLICT (bar_id,brand) DO UPDATE SET barris_padrao = EXCLUDED.barris_padrao;
  INSERT INTO public.bar_stock_standard (bar_id,brand,barris_padrao) VALUES (v_bar,'amstel',6)
    ON CONFLICT (bar_id,brand) DO UPDATE SET barris_padrao = EXCLUDED.barris_padrao;
END $$;

-- 3) Consumo: remove registros antigos de churrascaria e grava o consumo real
--    da Liberdade (exportação nova, cartão correto). Idempotente.
DELETE FROM public.meep_consumo_bar
 WHERE translate(lower(btrim(bar_nome)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
       IN ('churrascaria liberdade','churrascaria');

INSERT INTO public.meep_consumo_bar (bar_id, bar_nome, data, marca, barris)
SELECT (SELECT id FROM public.bars WHERE lower(btrim(name)) = 'liberdade' LIMIT 1),
       'Liberdade', t.d::date, t.m, t.q
  FROM (VALUES
    ('2026-07-19','heineken',6), ('2026-07-19','amstel',6),
    ('2026-07-21','heineken',3), ('2026-07-21','amstel',3),
    ('2026-07-22','heineken',4), ('2026-07-22','amstel',4),
    ('2026-07-24','heineken',10),('2026-07-24','amstel',10)
  ) AS t(d,m,q)
ON CONFLICT (bar_nome,data,marca) DO UPDATE SET barris = EXCLUDED.barris;
