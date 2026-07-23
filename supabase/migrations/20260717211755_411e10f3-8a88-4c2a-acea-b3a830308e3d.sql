
CREATE TYPE public.temp_slot AS ENUM ('t_11', 't_17', 't_22');

CREATE TABLE public.bar_temperature_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  slot public.temp_slot NOT NULL,
  temperatura numeric(4,1) NOT NULL,
  photo_url text NOT NULL,
  notes text,
  performed_by uuid NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_temperature_checks TO authenticated;
GRANT ALL ON public.bar_temperature_checks TO service_role;
ALTER TABLE public.bar_temperature_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read temp" ON public.bar_temperature_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert temp" ON public.bar_temperature_checks FOR INSERT TO authenticated WITH CHECK (auth.uid() = performed_by);
CREATE POLICY "owner or gestor update temp" ON public.bar_temperature_checks FOR UPDATE TO authenticated USING (auth.uid() = performed_by OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "owner or gestor delete temp" ON public.bar_temperature_checks FOR DELETE TO authenticated USING (auth.uid() = performed_by OR public.has_role(auth.uid(),'gestor'));
CREATE INDEX ON public.bar_temperature_checks (bar_id, performed_at DESC);

CREATE TABLE public.bar_organization_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  copo_ok boolean NOT NULL DEFAULT false,
  meninas_ok boolean NOT NULL DEFAULT false,
  limpo_ok boolean NOT NULL DEFAULT false,
  sem_fila_ok boolean NOT NULL DEFAULT false,
  notes text,
  performed_by uuid NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_organization_checks TO authenticated;
GRANT ALL ON public.bar_organization_checks TO service_role;
ALTER TABLE public.bar_organization_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read org" ON public.bar_organization_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert org" ON public.bar_organization_checks FOR INSERT TO authenticated WITH CHECK (auth.uid() = performed_by);
CREATE POLICY "owner or gestor update org" ON public.bar_organization_checks FOR UPDATE TO authenticated USING (auth.uid() = performed_by OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "owner or gestor delete org" ON public.bar_organization_checks FOR DELETE TO authenticated USING (auth.uid() = performed_by OR public.has_role(auth.uid(),'gestor'));
CREATE INDEX ON public.bar_organization_checks (bar_id, performed_at DESC);
