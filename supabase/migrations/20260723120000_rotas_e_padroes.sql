-- =====================================================================
-- FASE 1 — Fundação: ROTAS de reabastecimento + PADRÕES por bar
-- 100% ADITIVO e NÃO DESTRUTIVO:
--   • cria a tabela public.rotas (os 5 pontos de reabastecimento)
--   • adiciona bars.rota_id (nullable) para agrupar os bares por rota
--   • aplica o PADRÃO (barris_padrao) informado pelo gestor, por bar/marca
--
-- ⚠️ AJUSTE O MAPEAMENTO: a coluna `nome_no_app` precisa BATER com o
--    `name` real de cada bar no banco. Bares não encontrados são apenas
--    reportados (RAISE NOTICE) — nada é apagado.
-- =====================================================================

-- 1) Tabela de rotas -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rotas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL UNIQUE,
  ordem      int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rotas TO authenticated;
GRANT ALL    ON public.rotas TO service_role;
ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rotas' AND policyname = 'Rotas readable') THEN
    CREATE POLICY "Rotas readable" ON public.rotas FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rotas' AND policyname = 'Gestor manage rotas') THEN
    CREATE POLICY "Gestor manage rotas" ON public.rotas FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'gestor'))
      WITH CHECK (public.has_role(auth.uid(),'gestor'));
  END IF;
END $$;

-- 2) Coluna de rota no bar (nullable, seguro) ---------------------------
ALTER TABLE public.bars
  ADD COLUMN IF NOT EXISTS rota_id uuid REFERENCES public.rotas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bars_rota_id ON public.bars(rota_id);

-- 3) Os 5 pontos de reabastecimento -------------------------------------
INSERT INTO public.rotas (nome, ordem) VALUES
  ('Rota 1', 1),
  ('Rota 2', 2),
  ('Rota 3', 3),
  ('Rota 4', 4),
  ('Rota 5', 5)
ON CONFLICT (nome) DO NOTHING;

-- 4) Mapeamento bar → rota + padrão (H = heineken, A = amstel) -----------
--    ⚠️ Cada bar tem uma LISTA de nomes candidatos (array), não um nome só.
--    Motivo: a migration 20260724130000_seed_consumo_meep.sql (gerada dos
--    relatórios reais da MEEP, mapeamento confirmado pelo gestor) usa uma
--    convenção diferente da que este arquivo usava originalmente:
--      'Fundo'      vs 'Fundo (arquibancada)'
--      'Meio'       vs 'Meio (arquibancada)'
--      'Entrada'    vs 'Entrada (arquibancada)'
--      'Nova'       vs 'Nova (arquibancada)'
--      'Choperia 1'+'Choperia 2' vs 'Choperia (1+2)' (ponto único no seed)
--      'Vila 2 ma'/'me' vs 'Vila 2 maior'/'menor'
--      'Vila 3 ma'/'me' vs 'Vila 3 maior'/'menor'
--    Sem saber qual convenção está de fato em `bars.name`, tentamos as duas
--    (primeiro candidato que casar exato vence — sem fuzzy). Se `bars.name`
--    usa uma terceira variação, edite os arrays abaixo.
--    ⚠️ Caso especial Choperia: se no banco só existe UM bar "Choperia
--    (1+2)" (não dois pontos separados), as duas linhas abaixo resolvem
--    para o MESMO bar_id e o padrão final gravado será o da última que
--    rodar (Choperia 2: 6/6) — sem problema aqui pois os dois têm o mesmo
--    valor (6/6), mas CONFIRME com o gestor se Choperia é 1 ou 2 pontos
--    físicos antes de usar esse padrão para reposição real.
DO $$
DECLARE
  m        RECORD;
  cand     text;
  v_bar    uuid;
  v_rota   uuid;
  faltando text := '';
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      -- nomes_candidatos (array),                          rota,     padrao_H, padrao_A
      (ARRAY['Fundo','Fundo (arquibancada)'],                'Rota 1',   6,  6),
      (ARRAY['Meio','Meio (arquibancada)'],                  'Rota 1',   6,  6),
      (ARRAY['Entrada','Entrada (arquibancada)'],             'Rota 2',  10, 10),
      (ARRAY['Nova','Nova (arquibancada)'],                   'Rota 2',   6,  6),
      (ARRAY['Vila 1'],                                       'Rota 3',  20, 20),
      (ARRAY['Choperia 1','Choperia (1+2)'],                  'Rota 3',   6,  6),
      (ARRAY['Choperia 2','Choperia (1+2)'],                  'Rota 3',   6,  6),
      (ARRAY['Vila 2 ma','Vila 2 maior'],                     'Rota 4',  20, 20),
      (ARRAY['Vila 2 me','Vila 2 menor'],                     'Rota 4',   6,  6),
      (ARRAY['Vila 3 ma','Vila 3 maior'],                     'Rota 4',  10, 10),
      (ARRAY['Vila 3 me','Vila 3 menor'],                     'Rota 4',   6,  6),
      (ARRAY['Núcleos'],                                      'Rota 5',  10, 10),
      (ARRAY['Churrascaria'],                                 'Rota 5',   6,  6)
    ) AS t(nomes, rota, ph, pa)
  LOOP
    v_bar := NULL;
    FOREACH cand IN ARRAY m.nomes LOOP
      SELECT id INTO v_bar FROM public.bars
        WHERE btrim(lower(name)) = btrim(lower(cand)) LIMIT 1;
      EXIT WHEN v_bar IS NOT NULL;
    END LOOP;

    IF v_bar IS NULL THEN
      faltando := faltando || array_to_string(m.nomes, '/') || ', ';
      RAISE NOTICE 'BAR NÃO ENCONTRADO (padrão/rota não aplicados): %', array_to_string(m.nomes, ' / ');
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
    RAISE NOTICE '>>> Revise estes nomes no mapeamento: %', faltando;
  END IF;
END $$;
