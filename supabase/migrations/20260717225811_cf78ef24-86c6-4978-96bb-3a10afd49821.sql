
CREATE TABLE public.bar_card_machine_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  patrimonio TEXT NOT NULL,
  event_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  picked_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_up_photo TEXT,
  picked_up_by UUID REFERENCES auth.users(id),
  returned_at TIMESTAMPTZ,
  returned_photo TEXT,
  returned_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bar_card_machine_sessions_bar_date_idx ON public.bar_card_machine_sessions (bar_id, event_date);
CREATE INDEX bar_card_machine_sessions_open_idx ON public.bar_card_machine_sessions (bar_id) WHERE returned_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_card_machine_sessions TO authenticated;
GRANT ALL ON public.bar_card_machine_sessions TO service_role;

ALTER TABLE public.bar_card_machine_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read card machine sessions" ON public.bar_card_machine_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert card machine sessions" ON public.bar_card_machine_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update card machine sessions" ON public.bar_card_machine_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete card machine sessions" ON public.bar_card_machine_sessions FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_bar_card_machine_sessions_updated_at
BEFORE UPDATE ON public.bar_card_machine_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
