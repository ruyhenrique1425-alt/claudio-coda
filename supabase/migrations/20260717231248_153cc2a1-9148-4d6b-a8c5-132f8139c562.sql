
-- Public maintenance requests (QR code panel, no login required)
CREATE TABLE public.public_maintenance_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  requester_name TEXT,
  description TEXT NOT NULL,
  photo_path TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'pendente',
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_maintenance_requests TO authenticated;
GRANT INSERT ON public.public_maintenance_requests TO anon;
GRANT ALL ON public.public_maintenance_requests TO service_role;

ALTER TABLE public.public_maintenance_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or authenticated) can create a request via the public QR panel
CREATE POLICY "Anyone can submit maintenance requests"
  ON public.public_maintenance_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only authenticated app users can read/manage
CREATE POLICY "Authenticated read requests"
  ON public.public_maintenance_requests
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated update requests"
  ON public.public_maintenance_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Gestor delete requests"
  ON public.public_maintenance_requests
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_public_maintenance_requests_updated_at
  BEFORE UPDATE ON public.public_maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allow anon to read bar name for QR panel (id, name, bar_type only are sensitive-free)
CREATE POLICY "Anon can read bars for public panel"
  ON public.bars
  FOR SELECT
  TO anon
  USING (true);

GRANT SELECT ON public.bars TO anon;

-- Allow anon to upload photos under public-reports/ prefix in operacao-fotos bucket
CREATE POLICY "Anon can upload public maintenance photos"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'operacao-fotos'
    AND (storage.foldername(name))[1] = 'public-reports'
  );
