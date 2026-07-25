CREATE TABLE IF NOT EXISTS public.meep_consumo_bar (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id     uuid REFERENCES public.bars(id) ON DELETE SET NULL,
  bar_nome   text NOT NULL,
  data       date NOT NULL,
  marca      text NOT NULL,
  barris     numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_meep_consumo_bar_dia_marca
  ON public.meep_consumo_bar(bar_nome, data, marca);
CREATE INDEX IF NOT EXISTS idx_meep_consumo_bar_data ON public.meep_consumo_bar(bar_id, data);

GRANT SELECT, INSERT, UPDATE ON public.meep_consumo_bar TO authenticated;
GRANT ALL ON public.meep_consumo_bar TO service_role;
ALTER TABLE public.meep_consumo_bar ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meep_consumo_bar' AND policyname='MEEP consumo readable') THEN
    CREATE POLICY "MEEP consumo readable" ON public.meep_consumo_bar
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meep_consumo_bar' AND policyname='Gestor manutencao manage meep consumo') THEN
    CREATE POLICY "Gestor manutencao manage meep consumo" ON public.meep_consumo_bar
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'))
      WITH CHECK (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'));
  END IF;
END $$;