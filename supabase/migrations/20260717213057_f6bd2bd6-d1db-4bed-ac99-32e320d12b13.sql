
CREATE TABLE public.bar_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL UNIQUE REFERENCES public.bars(id) ON DELETE CASCADE,
  brand public.chopp_brand,
  bicos int,
  manometro_qtd int NOT NULL DEFAULT 0,
  cilindro_qtd int NOT NULL DEFAULT 0,
  responsavel_nome text,
  responsavel_telefone text,
  contrato_photo_url text,
  valores text,
  informacoes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_installations TO authenticated;
GRANT ALL ON public.bar_installations TO service_role;
ALTER TABLE public.bar_installations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read installations" ON public.bar_installations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write installations" ON public.bar_installations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update installations" ON public.bar_installations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "gestor delete installations" ON public.bar_installations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'gestor'));
CREATE TRIGGER bar_installations_updated_at BEFORE UPDATE ON public.bar_installations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bar_maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  description text NOT NULL,
  photo_url text,
  performed_at timestamptz NOT NULL DEFAULT now(),
  performed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_maintenance_logs TO authenticated;
GRANT ALL ON public.bar_maintenance_logs TO service_role;
ALTER TABLE public.bar_maintenance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read maint" ON public.bar_maintenance_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write maint" ON public.bar_maintenance_logs FOR INSERT TO authenticated WITH CHECK (performed_by = auth.uid());
CREATE POLICY "author update maint" ON public.bar_maintenance_logs FOR UPDATE TO authenticated USING (performed_by = auth.uid()) WITH CHECK (performed_by = auth.uid());
CREATE POLICY "gestor delete maint" ON public.bar_maintenance_logs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'gestor'));
CREATE INDEX ON public.bar_maintenance_logs(bar_id, performed_at DESC);
