
ALTER TABLE public.bars
  ADD COLUMN IF NOT EXISTS manometros_qtd integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pre_resfriadores_qtd integer NOT NULL DEFAULT 0;

-- Deduplicate existing bar_machines rows before adding the unique constraint
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY bar_id, brand, bicos ORDER BY created_at) AS rn
  FROM public.bar_machines
)
DELETE FROM public.bar_machines WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

ALTER TABLE public.bar_machines
  DROP CONSTRAINT IF EXISTS bar_machines_bar_brand_bicos_key;
ALTER TABLE public.bar_machines
  ADD CONSTRAINT bar_machines_bar_brand_bicos_key UNIQUE (bar_id, brand, bicos);
