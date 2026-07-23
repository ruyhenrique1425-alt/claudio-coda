CREATE TABLE public.heineken_cargas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  heineken_barris integer NOT NULL DEFAULT 0,
  amstel_barris integer NOT NULL DEFAULT 0,
  barris_comodato integer NOT NULL DEFAULT 0,
  vasilhames_recolhidos integer NOT NULL DEFAULT 0,
  invoice_number text,
  invoice_photo_url text,
  notes text,
  performed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.heineken_cargas TO authenticated;
GRANT ALL ON public.heineken_cargas TO service_role;

ALTER TABLE public.heineken_cargas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read cargas" ON public.heineken_cargas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert cargas" ON public.heineken_cargas FOR INSERT TO authenticated WITH CHECK (auth.uid() = performed_by OR performed_by IS NULL);
CREATE POLICY "auth update cargas" ON public.heineken_cargas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete cargas" ON public.heineken_cargas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER update_heineken_cargas_updated_at BEFORE UPDATE ON public.heineken_cargas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();