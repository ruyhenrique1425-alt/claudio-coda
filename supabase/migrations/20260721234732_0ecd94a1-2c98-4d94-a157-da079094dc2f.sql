
CREATE TABLE public.bar_machine_patrimonios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  patrimonio TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bar_id, patrimonio)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_machine_patrimonios TO authenticated;
GRANT ALL ON public.bar_machine_patrimonios TO service_role;
ALTER TABLE public.bar_machine_patrimonios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read patrimonios" ON public.bar_machine_patrimonios FOR SELECT TO authenticated USING (true);
CREATE POLICY "gestor manage patrimonios" ON public.bar_machine_patrimonios FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_bar_machine_patrimonios_updated BEFORE UPDATE ON public.bar_machine_patrimonios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
