-- 1. Backup runs table
CREATE TABLE public.backup_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  status TEXT NOT NULL DEFAULT 'success',
  storage_path TEXT,
  signed_url TEXT,
  size_bytes BIGINT,
  tables_count INTEGER,
  rows_total INTEGER,
  error TEXT,
  triggered_by TEXT NOT NULL DEFAULT 'cron',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores e manutenção podem ver backups"
  ON public.backup_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'manutencao'));

CREATE POLICY "Gestores podem gerenciar backups"
  ON public.backup_runs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER update_backup_runs_updated_at
  BEFORE UPDATE ON public.backup_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_backup_runs_date ON public.backup_runs (run_date DESC);

-- 2. client_op_id for offline idempotency
ALTER TABLE public.inventories ADD COLUMN IF NOT EXISTS client_op_id UUID;
ALTER TABLE public.refills ADD COLUMN IF NOT EXISTS client_op_id UUID;
ALTER TABLE public.empties_removed ADD COLUMN IF NOT EXISTS client_op_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventories_client_op_id
  ON public.inventories (client_op_id) WHERE client_op_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_refills_client_op_id
  ON public.refills (client_op_id) WHERE client_op_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_empties_client_op_id
  ON public.empties_removed (client_op_id) WHERE client_op_id IS NOT NULL;