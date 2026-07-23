ALTER TABLE public.empties_removed
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS notes text,
  ALTER COLUMN refill_id DROP NOT NULL;