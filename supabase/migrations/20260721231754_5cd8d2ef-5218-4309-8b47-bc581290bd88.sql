
DO $$
BEGIN
  PERFORM cron.unschedule('dispel-backup-diario');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'dispel-backup-10h',
  '0 13 * * *',
  $CRON$ SELECT net.http_post(
    url:='https://project--ff1926fb-9370-4675-8d49-1789dec058e1.lovable.app/api/public/hooks/backup',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oYWdrcXd0ZnZyZGp0eGtlaWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMTYxNDYsImV4cCI6MjA5OTg5MjE0Nn0.SBvNZHDAsHv3o0AVDQozZTFvIdoQ2UAUOMgZOWUDuZo"}'::jsonb,
    body:='{}'::jsonb
  ) $CRON$
);

SELECT cron.schedule(
  'dispel-backup-22h',
  '0 1 * * *',
  $CRON$ SELECT net.http_post(
    url:='https://project--ff1926fb-9370-4675-8d49-1789dec058e1.lovable.app/api/public/hooks/backup',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oYWdrcXd0ZnZyZGp0eGtlaWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMTYxNDYsImV4cCI6MjA5OTg5MjE0Nn0.SBvNZHDAsHv3o0AVDQozZTFvIdoQ2UAUOMgZOWUDuZo"}'::jsonb,
    body:='{}'::jsonb
  ) $CRON$
);

CREATE TABLE public.logs_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acao text NOT NULL,
  tabela_afetada text NOT NULL,
  registro_id text,
  detalhe_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.logs_auditoria TO authenticated;
GRANT ALL ON public.logs_auditoria TO service_role;

ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios registram suas proprias acoes"
  ON public.logs_auditoria FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin e gestor visualizam auditoria"
  ON public.logs_auditoria FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_logs_auditoria_created_at ON public.logs_auditoria (created_at DESC);
CREATE INDEX idx_logs_auditoria_tabela ON public.logs_auditoria (tabela_afetada, created_at DESC);
