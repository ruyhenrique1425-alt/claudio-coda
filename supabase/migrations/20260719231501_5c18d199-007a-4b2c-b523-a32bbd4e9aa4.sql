
CREATE TABLE public.bar_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  to_bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  photo_url text,
  notes text,
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bar_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES public.bar_transfers(id) ON DELETE CASCADE,
  brand text NOT NULL,
  quantidade integer NOT NULL CHECK (quantidade > 0)
);

CREATE INDEX ON public.bar_transfers(from_bar_id, performed_at DESC);
CREATE INDEX ON public.bar_transfers(to_bar_id, performed_at DESC);
CREATE INDEX ON public.bar_transfer_items(transfer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_transfers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_transfer_items TO authenticated;
GRANT ALL ON public.bar_transfers TO service_role;
GRANT ALL ON public.bar_transfer_items TO service_role;

ALTER TABLE public.bar_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read transfers" ON public.bar_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert transfers" ON public.bar_transfers FOR INSERT TO authenticated WITH CHECK (auth.uid() = performed_by);
CREATE POLICY "gestor update transfers" ON public.bar_transfers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'))
  WITH CHECK (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'));
CREATE POLICY "gestor delete transfers" ON public.bar_transfers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'));

CREATE POLICY "auth read transfer items" ON public.bar_transfer_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert transfer items" ON public.bar_transfer_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "gestor update transfer items" ON public.bar_transfer_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'))
  WITH CHECK (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'));
CREATE POLICY "gestor delete transfer items" ON public.bar_transfer_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'));
