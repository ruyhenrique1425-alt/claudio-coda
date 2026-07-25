ALTER TABLE public.bars ADD COLUMN IF NOT EXISTS cartao_meep text;
CREATE INDEX IF NOT EXISTS idx_bars_cartao_meep ON public.bars(cartao_meep);

CREATE TABLE IF NOT EXISTS public.meep_vendas_bar (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id     uuid REFERENCES public.bars(id) ON DELETE SET NULL,
  cartao     text,
  data       date NOT NULL,
  categoria  text,
  produto    text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  valor      numeric NOT NULL DEFAULT 0,
  is_chopp   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_meep_vendas_cartao_data_produto
  ON public.meep_vendas_bar(cartao, data, produto);
CREATE INDEX IF NOT EXISTS idx_meep_vendas_bar_data ON public.meep_vendas_bar(bar_id, data);

GRANT SELECT, INSERT, UPDATE ON public.meep_vendas_bar TO authenticated;
GRANT ALL ON public.meep_vendas_bar TO service_role;
ALTER TABLE public.meep_vendas_bar ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meep_vendas_bar' AND policyname='MEEP vendas readable') THEN
    CREATE POLICY "MEEP vendas readable" ON public.meep_vendas_bar
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meep_vendas_bar' AND policyname='Gestor manutencao manage meep vendas') THEN
    CREATE POLICY "Gestor manutencao manage meep vendas" ON public.meep_vendas_bar
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'))
      WITH CHECK (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'));
  END IF;
END $$;