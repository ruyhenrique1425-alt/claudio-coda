-- =====================================================================
-- DEFINITIVO: rotas + padrões pelos NOMES REAIS dos bares (backup de produção).
-- Corrige 20260724160000, que usava nomes que NÃO batiam com bars.name
-- (Vila≠Villa, Núcleos≠Nucleos, "Choperia 1"≠"Chopperia 1 andar",
-- Churrascaria≠"Churrascaria liberdade", "Vila 1"≠"Villa 1 autoatendimento"...),
-- deixando a maioria dos padrões SEM aplicar (BI/reposição zerados).
-- Match sem acento e sem caixa (translate). Idempotente e aditivo.
-- =====================================================================
DO $$
DECLARE
  m RECORD; v_bar uuid; v_rota uuid; faltando text := '';
BEGIN
  FOR m IN SELECT * FROM (VALUES
    ('fundo arquibancada',      'Rota 1',  6,  6),
    ('meio arquibancada',       'Rota 1',  6,  6),
    ('entrada arquibancada',    'Rota 2', 10, 10),
    ('nova arquibancada',       'Rota 2',  6,  6),
    ('villa 1 autoatendimento', 'Rota 3', 20, 20),
    ('chopperia 1 andar',       'Rota 3',  6,  6),
    ('chopperia 2 andar',       'Rota 3',  6,  6),
    ('villa 2 autoatendimento', 'Rota 4', 20, 20),
    ('villa 2 menor',           'Rota 4',  6,  6),
    ('vila 3 maior',            'Rota 4', 10, 10),
    ('villa 3 menor',           'Rota 4',  6,  6),
    ('nucleos',                 'Rota 5', 10, 10),
    ('churrascaria liberdade',  'Rota 5',  6,  6)
  ) AS t(nome, rota, ph, pa)
  LOOP
    SELECT id INTO v_bar FROM public.bars
     WHERE translate(lower(btrim(name)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc') = m.nome
     LIMIT 1;
    IF v_bar IS NULL THEN faltando := faltando || m.nome || ', '; CONTINUE; END IF;
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
    RAISE NOTICE 'Padrão NÃO aplicado (nome não encontrado em bars.name): %', faltando;
  END IF;
END $$;

-- Pista de areia (parceiro na Rota 2; gestor não definiu padrão — só rota).
UPDATE public.bars SET rota_id = (SELECT id FROM public.rotas WHERE nome = 'Rota 2')
 WHERE translate(lower(btrim(name)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
       IN ('pista de areia','bar da pista','pista');

-- Zel café (parceiro, NÃO entra em rota).
UPDATE public.bars SET rota_id = NULL
 WHERE translate(lower(btrim(name)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
       IN ('zel cafe','zelda cafe');
