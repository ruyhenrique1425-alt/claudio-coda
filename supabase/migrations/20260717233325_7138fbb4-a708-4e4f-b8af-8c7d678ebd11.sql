
CREATE TABLE public.qr_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  bar_id uuid REFERENCES public.bars(id) ON DELETE SET NULL,
  label text,
  assigned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qr_tokens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_tokens TO authenticated;
GRANT ALL ON public.qr_tokens TO service_role;

ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_tokens public read" ON public.qr_tokens FOR SELECT TO anon USING (true);
CREATE POLICY "qr_tokens auth read" ON public.qr_tokens FOR SELECT TO authenticated USING (true);
CREATE POLICY "qr_tokens gestor insert" ON public.qr_tokens FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "qr_tokens gestor update" ON public.qr_tokens FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "qr_tokens gestor delete" ON public.qr_tokens FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER update_qr_tokens_updated_at BEFORE UPDATE ON public.qr_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed 70 codes: DSP-0001 .. DSP-0070
INSERT INTO public.qr_tokens (code, label)
SELECT 'DSP-' || LPAD(gs::text, 4, '0'), 'Etiqueta #' || LPAD(gs::text, 4, '0')
FROM generate_series(1, 70) AS gs;
