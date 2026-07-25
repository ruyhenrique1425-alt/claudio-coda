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