
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('gestor', 'operador');
CREATE TYPE public.bar_type AS ENUM ('camarote', 'stand', 'haras', 'bar_venda');
CREATE TYPE public.shift_slot AS ENUM ('t_07_19', 't_10_22', 't_13_01');
CREATE TYPE public.chopp_brand AS ENUM ('heineken', 'amstel');
CREATE TYPE public.barrel_status AS ENUM ('plugado', 'fechado', 'vazio');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Gestor manages roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- BARS
CREATE TABLE public.bars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bar_type public.bar_type NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  apoio_responsavel TEXT,
  cilindros_qtd INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bars TO authenticated;
GRANT ALL ON public.bars TO service_role;
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bars readable" ON public.bars FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestor manages bars" ON public.bars FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'gestor'));
CREATE TRIGGER trg_bars_updated BEFORE UPDATE ON public.bars FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BAR MACHINES
CREATE TABLE public.bar_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  brand public.chopp_brand NOT NULL,
  bicos INTEGER NOT NULL CHECK (bicos IN (1,2)),
  quantidade INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_machines TO authenticated;
GRANT ALL ON public.bar_machines TO service_role;
ALTER TABLE public.bar_machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bar machines readable" ON public.bar_machines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestor manages machines" ON public.bar_machines FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- CARD READERS
CREATE TABLE public.bar_card_readers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL UNIQUE REFERENCES public.bars(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_card_readers TO authenticated;
GRANT ALL ON public.bar_card_readers TO service_role;
ALTER TABLE public.bar_card_readers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Card readers readable" ON public.bar_card_readers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestor manages card readers" ON public.bar_card_readers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- SHIFTS
CREATE TABLE public.bar_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  shift public.shift_slot NOT NULL,
  meninas_qtd INTEGER NOT NULL DEFAULT 0,
  UNIQUE (bar_id, shift)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_shifts TO authenticated;
GRANT ALL ON public.bar_shifts TO service_role;
ALTER TABLE public.bar_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shifts readable" ON public.bar_shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestor manages shifts" ON public.bar_shifts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- STOCK STANDARD
CREATE TABLE public.bar_stock_standard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  brand public.chopp_brand NOT NULL,
  barris_padrao INTEGER NOT NULL DEFAULT 0,
  UNIQUE (bar_id, brand)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bar_stock_standard TO authenticated;
GRANT ALL ON public.bar_stock_standard TO service_role;
ALTER TABLE public.bar_stock_standard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stock std readable" ON public.bar_stock_standard FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestor manages stock std" ON public.bar_stock_standard FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'gestor')) WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- INVENTORIES
CREATE TABLE public.inventories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  photo_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inventories_bar_time ON public.inventories(bar_id, performed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventories TO authenticated;
GRANT ALL ON public.inventories TO service_role;
ALTER TABLE public.inventories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inventories readable" ON public.inventories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert inventories" ON public.inventories FOR INSERT TO authenticated WITH CHECK (auth.uid() = performed_by);
CREATE POLICY "Gestor updates inventories" ON public.inventories FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestor deletes inventories" ON public.inventories FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'gestor'));

CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES public.inventories(id) ON DELETE CASCADE,
  brand public.chopp_brand NOT NULL,
  status public.barrel_status NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  UNIQUE (inventory_id, brand, status)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inv items readable" ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manages inv items" ON public.inventory_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventories i WHERE i.id = inventory_id AND (i.performed_by = auth.uid() OR public.has_role(auth.uid(),'gestor'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.inventories i WHERE i.id = inventory_id AND (i.performed_by = auth.uid() OR public.has_role(auth.uid(),'gestor'))));

-- REFILLS
CREATE TABLE public.refills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  photo_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refills_bar_time ON public.refills(bar_id, performed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.refills TO authenticated;
GRANT ALL ON public.refills TO service_role;
ALTER TABLE public.refills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Refills readable" ON public.refills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert refills" ON public.refills FOR INSERT TO authenticated WITH CHECK (auth.uid() = performed_by);
CREATE POLICY "Gestor updates refills" ON public.refills FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'gestor'));
CREATE POLICY "Gestor deletes refills" ON public.refills FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'gestor'));

CREATE TABLE public.refill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refill_id UUID NOT NULL REFERENCES public.refills(id) ON DELETE CASCADE,
  brand public.chopp_brand NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  UNIQUE (refill_id, brand)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.refill_items TO authenticated;
GRANT ALL ON public.refill_items TO service_role;
ALTER TABLE public.refill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Refill items readable" ON public.refill_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manages refill items" ON public.refill_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.refills r WHERE r.id = refill_id AND (r.performed_by = auth.uid() OR public.has_role(auth.uid(),'gestor'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.refills r WHERE r.id = refill_id AND (r.performed_by = auth.uid() OR public.has_role(auth.uid(),'gestor'))));

-- EMPTIES REMOVED
CREATE TABLE public.empties_removed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id UUID NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  brand public.chopp_brand NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  refill_id UUID REFERENCES public.refills(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_empties_bar_time ON public.empties_removed(bar_id, performed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empties_removed TO authenticated;
GRANT ALL ON public.empties_removed TO service_role;
ALTER TABLE public.empties_removed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empties readable" ON public.empties_removed FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert empties" ON public.empties_removed FOR INSERT TO authenticated WITH CHECK (auth.uid() = performed_by);
CREATE POLICY "Gestor updates empties" ON public.empties_removed FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'gestor'));
CREATE POLICY "Gestor deletes empties" ON public.empties_removed FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'gestor'));

-- AUTO PROFILE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- STORAGE POLICIES (bucket já existe: operacao-fotos, privado)
CREATE POLICY "Fotos operacao auth read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'operacao-fotos');
CREATE POLICY "Auth upload fotos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'operacao-fotos');
CREATE POLICY "Auth update own fotos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'operacao-fotos' AND owner = auth.uid());
CREATE POLICY "Gestor delete fotos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'operacao-fotos' AND public.has_role(auth.uid(),'gestor'));
