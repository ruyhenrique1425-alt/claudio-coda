ALTER TABLE public.bars
  ADD COLUMN IF NOT EXISTS rota_id uuid REFERENCES public.rotas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bars_rota_id ON public.bars(rota_id);

INSERT INTO public.rotas (nome, ordem) VALUES
  ('Rota 1', 1),
  ('Rota 2', 2),
  ('Rota 3', 3),
  ('Rota 4', 4),
  ('Rota 5', 5)
ON CONFLICT (nome) DO NOTHING;