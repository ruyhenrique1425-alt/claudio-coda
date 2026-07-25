-- =====================================================================
-- NOMES OFICIAIS, ROTAS E PADRÕES — confirmados pelo gestor (2026-07-24)
--
-- Substitui o mapeamento por "variantes de nome" da migration
-- 20260723120000, que era um chute entre duas convenções. Agora temos a
-- lista oficial. Abreviações usadas na operação: ma=maior, me=menor,
-- arq=arquibancada.
--
-- NOMES OFICIAIS (13 pontos da operação):
--   Vila 1 · Vila 2 Maior · Vila 2 Menor · Vila 3 Maior · Vila 3 Menor
--   Choperia 1 · Choperia 2  (→ fundidos em "Choperia", ver 20260724170000)
--   Fundo Arquibancada · Meio Arquibancada · Entrada Arquibancada
--   Nova Arquibancada · Núcleos · Churrascaria
-- Parceiros: Bar da Pista (entra na Rota 2) · Zel Café (NÃO entra em rota)
--
-- ⚠️ Atenção ao que mudou em relação ao que estava no código:
--   • "Fundo (arquibancada)" (com parênteses, usado no seed do consumo)
--     NÃO é o nome oficial. O oficial é "Fundo Arquibancada".
--     O match é case-insensitive, mas parênteses NÃO casam.
--   • "Vila 2 ma"/"me" eram abreviações internas, não nomes de cadastro.
--
-- 100% ADITIVO: só grava rota e padrão. Não renomeia nem apaga bar.
-- Bares não encontrados são reportados via RAISE NOTICE.
-- =====================================================================

DO $$
DECLARE
  m        RECORD;
  v_bar    uuid;
  v_rota   uuid;
  faltando text := '';
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      -- nome oficial,            rota,      padrão H, padrão A
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
      RAISE NOTICE 'BAR NÃO ENCONTRADO (rota/padrão não aplicados): %', m.nome;
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

-- ---------------------------------------------------------------------
-- Parceiros
-- ---------------------------------------------------------------------
-- Bar da Pista: ENTRA na Rota 2 (confirmado pelo gestor).
-- ⚠️ O gestor não informou o PADRÃO deste bar. A rota é gravada, mas o
--    padrão fica em aberto de propósito — sem padrão o app não calcula
--    reposição para ele (aparece em "bares sem padrão definido" nos
--    alertas, que é o comportamento correto até alguém definir o número).
DO $$
DECLARE v_bar uuid; v_rota uuid;
BEGIN
  SELECT id INTO v_bar FROM public.bars
   WHERE btrim(lower(name)) IN ('bar da pista','pista') LIMIT 1;
  SELECT id INTO v_rota FROM public.rotas WHERE nome = 'Rota 2';
  IF v_bar IS NULL THEN
    RAISE NOTICE 'BAR NÃO ENCONTRADO: Bar da Pista (rota não aplicada)';
  ELSE
    UPDATE public.bars SET rota_id = v_rota WHERE id = v_bar;
    RAISE NOTICE 'Bar da Pista vinculado à Rota 2. PADRÃO AINDA NÃO DEFINIDO.';
  END IF;
END $$;

-- Zel Café: bar parceiro, NÃO entra em rota (confirmado pelo gestor).
-- Garante rota_id nulo caso tenha sido preenchido por engano.
UPDATE public.bars SET rota_id = NULL
 WHERE btrim(lower(name)) IN ('zel café','zel cafe');
