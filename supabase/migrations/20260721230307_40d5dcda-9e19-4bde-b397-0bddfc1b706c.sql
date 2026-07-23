ALTER TABLE public.bar_temperature_checks ADD COLUMN IF NOT EXISTS client_op_id uuid UNIQUE;
ALTER TABLE public.bar_organization_checks ADD COLUMN IF NOT EXISTS client_op_id uuid UNIQUE;
ALTER TABLE public.heineken_cargas ADD COLUMN IF NOT EXISTS client_op_id uuid UNIQUE;