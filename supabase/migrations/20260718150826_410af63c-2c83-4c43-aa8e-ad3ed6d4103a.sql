DROP POLICY IF EXISTS "Gestor manages bars" ON public.bars;
CREATE POLICY "Gestor and manutencao manage bars"
ON public.bars
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'manutencao'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'manutencao'::public.app_role)
);

DROP POLICY IF EXISTS "qr_tokens gestor update" ON public.qr_tokens;
CREATE POLICY "qr_tokens gestor manutencao update"
ON public.qr_tokens
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'manutencao'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'manutencao'::public.app_role)
);