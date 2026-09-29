ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS personagem text NOT NULL DEFAULT 'interno',
  ADD COLUMN IF NOT EXISTS avatar jsonb NOT NULL DEFAULT '{}'::jsonb;