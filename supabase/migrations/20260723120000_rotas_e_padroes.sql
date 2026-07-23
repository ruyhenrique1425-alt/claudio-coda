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
--    EDITE apenas a 1ª coluna (nome_no_app) se o nome no banco for diferente.
DO $$
DECLARE
  m        RECORD;
  v_bar    uuid;
  v_rota   uuid;
  faltando text := '';
BEGIN
  FOR m IN
    SELECT * FROM (VALUES
      -- nome_no_app,   rota,     padrao_H, padrao_A
      ('Fundo',        'Rota 1',   6,  6),
      ('Meio',         'Rota 1',   6,  6),
      ('Entrada',      'Rota 2',  10, 10),
      ('Nova',         'Rota 2',   6,  6),
      ('Vila 1',       'Rota 3',  16, 16),
      ('Choperia 1',   'Rota 3',   6,  6),
      ('Choperia 2',   'Rota 3',   6,  6),
      ('Vila 2 ma',    'Rota 4',  10, 10),
      ('Vila 2 me',    'Rota 4',   6,  6),
      ('Vila 3 ma',    'Rota 4',  10, 10),
      ('Vila 3 me',    'Rota 4',   6,  6),
      ('Núcleos',      'Rota 5',  10, 10),
      ('Chopperia',    'Rota 5',   6,  6)
    ) AS t(nome, rota, ph, pa)
  LOOP
    -- resolve o bar por match EXATO (sem caixa/espaços). Sem fuzzy, para
    -- nunca atribuir ao bar errado. Nomes não encontrados são reportados.
    SELECT id INTO v_bar FROM public.bars
      WHERE btrim(lower(name)) = btrim(lower(m.nome)) LIMIT 1;

    IF v_bar IS NULL THEN
      faltando := faltando || m.nome || ', ';
      RAISE NOTICE 'BAR NÃO ENCONTRADO (padrão/rota não aplicados): %', m.nome;
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
