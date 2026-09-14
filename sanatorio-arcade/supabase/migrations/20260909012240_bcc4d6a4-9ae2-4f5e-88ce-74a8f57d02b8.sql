CREATE TABLE public.fotos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  autor text NOT NULL CHECK (char_length(btrim(autor)) BETWEEN 1 AND 40),
  legenda text CHECK (legenda IS NULL OR char_length(legenda) <= 140),
  path text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.fotos TO anon;
GRANT SELECT, INSERT ON public.fotos TO authenticated;
GRANT ALL ON public.fotos TO service_role;

ALTER TABLE public.fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Galeria visivel para todos" ON public.fotos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Qualquer um pode enviar foto" ON public.fotos FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX fotos_created_at_idx ON public.fotos (created_at DESC);

CREATE POLICY "Enviar fotos na galeria" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'galeria');
CREATE POLICY "Ler fotos da galeria" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'galeria');