-- ============================================================
-- DISPEL OPERAÇÃO · RBAC HARDENING (pós-evento)
-- ============================================================
-- ATENÇÃO: revise e aplique em janela de manutenção.
-- Substitui todas as policies USING(true) por policies escopadas
-- a auth.uid() + roles via public.has_role().
--
-- Aplicar via: supabase--migration
-- ============================================================

-- 1) BARS — leitura autenticada, escrita apenas gestor
DROP POLICY IF EXISTS "public read" ON public.bars;
DROP POLICY IF EXISTS "auth write" ON public.bars;
CREATE POLICY "bars_select_auth" ON public.bars FOR SELECT TO authenticated USING (true);
CREATE POLICY "bars_write_gestor" ON public.bars FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- 2) INVENTORIES / REFILLS / EMPTIES — leitura autenticada, escrita autor
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['inventories','refills','empties_removed',
    'bar_temperature_checks','bar_organization_checks',
    'bar_maintenance_logs','bar_transfers','heineken_cargas']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "public rw" ON public.%I', t);
    EXECUTE format('CREATE POLICY "%1$s_select_auth" ON public.%1$s FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "%1$s_insert_own" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (performed_by = auth.uid() OR public.has_role(auth.uid(), ''gestor''))', t);
    EXECUTE format('CREATE POLICY "%1$s_update_own" ON public.%1$s FOR UPDATE TO authenticated USING (performed_by = auth.uid() OR public.has_role(auth.uid(), ''gestor''))', t);
    EXECUTE format('CREATE POLICY "%1$s_delete_gestor" ON public.%1$s FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''gestor''))', t);
  END LOOP;
END $$;

-- 3) WAREHOUSE — apenas gestor/manutenção
DROP POLICY IF EXISTS "public rw" ON public.warehouse_movements;
DROP POLICY IF EXISTS "public rw" ON public.warehouse_stock;
CREATE POLICY "wm_select_auth" ON public.warehouse_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "wm_write_priv" ON public.warehouse_movements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'))
  WITH CHECK (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'));
CREATE POLICY "ws_select_auth" ON public.warehouse_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "ws_write_priv" ON public.warehouse_stock FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'))
  WITH CHECK (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'));

-- 4) PUBLIC MAINTENANCE REQUESTS (QR code) — mantém INSERT anônimo
--    mas leitura restrita a autenticados.
DROP POLICY IF EXISTS "public rw" ON public.public_maintenance_requests;
CREATE POLICY "pmr_insert_anon" ON public.public_maintenance_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "pmr_select_auth" ON public.public_maintenance_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "pmr_update_priv" ON public.public_maintenance_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'));
