
-- 1) bar_card_machine_sessions
DROP POLICY IF EXISTS "auth delete card machine sessions" ON public.bar_card_machine_sessions;
DROP POLICY IF EXISTS "auth insert card machine sessions" ON public.bar_card_machine_sessions;
DROP POLICY IF EXISTS "auth update card machine sessions" ON public.bar_card_machine_sessions;

CREATE POLICY "cms insert own" ON public.bar_card_machine_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = picked_up_by
    OR public.has_role(auth.uid(),'gestor')
    OR public.has_role(auth.uid(),'manutencao')
  );
CREATE POLICY "cms update own or gestor" ON public.bar_card_machine_sessions
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = picked_up_by OR auth.uid() = returned_by
    OR public.has_role(auth.uid(),'gestor')
    OR public.has_role(auth.uid(),'manutencao')
  )
  WITH CHECK (
    auth.uid() = picked_up_by OR auth.uid() = returned_by
    OR public.has_role(auth.uid(),'gestor')
    OR public.has_role(auth.uid(),'manutencao')
  );
CREATE POLICY "cms delete gestor" ON public.bar_card_machine_sessions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'gestor'));

-- 2) bar_installations
DROP POLICY IF EXISTS "auth write installations" ON public.bar_installations;
DROP POLICY IF EXISTS "auth update installations" ON public.bar_installations;

CREATE POLICY "inst insert priv" ON public.bar_installations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'));
CREATE POLICY "inst update priv" ON public.bar_installations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'))
  WITH CHECK (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'));

-- 3) bar_transfer_items — inserção só via transferência-pai própria
DROP POLICY IF EXISTS "auth insert transfer items" ON public.bar_transfer_items;

CREATE POLICY "bti insert via own transfer" ON public.bar_transfer_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bar_transfers t
      WHERE t.id = bar_transfer_items.transfer_id
        AND (t.performed_by = auth.uid()
             OR public.has_role(auth.uid(),'gestor')
             OR public.has_role(auth.uid(),'manutencao'))
    )
  );

-- 4) heineken_cargas
DROP POLICY IF EXISTS "auth update cargas" ON public.heineken_cargas;

CREATE POLICY "cargas update own or gestor" ON public.heineken_cargas
  FOR UPDATE TO authenticated
  USING (auth.uid() = performed_by OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (auth.uid() = performed_by OR public.has_role(auth.uid(),'gestor'));

-- 5) public_maintenance_requests
DROP POLICY IF EXISTS "Authenticated update requests" ON public.public_maintenance_requests;

CREATE POLICY "pmr update priv" ON public.public_maintenance_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'))
  WITH CHECK (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'));
