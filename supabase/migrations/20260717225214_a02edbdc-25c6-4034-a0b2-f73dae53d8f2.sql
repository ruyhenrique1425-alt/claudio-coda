CREATE TABLE public.bar_staff_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  checkpoint smallint NOT NULL CHECK (checkpoint IN (1,2,3)),
  meninas_count integer NOT NULL DEFAULT 0,
  card_readers_count integer NOT NULL DEFAULT 0,
  meninas_ok boolean NOT NULL DEFAULT false,
  cards_ok boolean NOT NULL DEFAULT false,
  notes text,
  photo_url text,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bar_staff_checks_bar_time ON public.bar_staff_checks(bar_id, performed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_staff_checks TO authenticated;
GRANT ALL ON public.bar_staff_checks TO service_role;
ALTER TABLE public.bar_staff_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read staff checks" ON public.bar_staff_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert staff checks" ON public.bar_staff_checks FOR INSERT TO authenticated WITH CHECK (auth.uid() = performed_by);
CREATE POLICY "auth update staff checks" ON public.bar_staff_checks FOR UPDATE TO authenticated USING (auth.uid() = performed_by);
CREATE POLICY "auth delete staff checks" ON public.bar_staff_checks FOR DELETE TO authenticated USING (auth.uid() = performed_by);