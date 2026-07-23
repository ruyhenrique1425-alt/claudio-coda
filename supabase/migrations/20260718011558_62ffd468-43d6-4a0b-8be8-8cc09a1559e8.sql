
-- Warehouses (fixed: dispel, allstar)
CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Warehouses readable" ON public.warehouses FOR SELECT TO authenticated USING (true);

-- Stock levels per warehouse/brand
CREATE TABLE public.warehouse_stock (
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  brand chopp_brand NOT NULL,
  barrels integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (warehouse_id, brand)
);
GRANT SELECT ON public.warehouse_stock TO authenticated;
GRANT ALL ON public.warehouse_stock TO service_role;
ALTER TABLE public.warehouse_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stock readable" ON public.warehouse_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestor manutencao update stock" ON public.warehouse_stock FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'))
  WITH CHECK (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'));

-- Movement type enum
CREATE TYPE warehouse_move_type AS ENUM ('entrada','transferencia','abastecimento_bar','ajuste');

-- Movements ledger
CREATE TABLE public.warehouse_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  target_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  bar_id uuid REFERENCES public.bars(id) ON DELETE SET NULL,
  refill_id uuid REFERENCES public.refills(id) ON DELETE SET NULL,
  move_type warehouse_move_type NOT NULL,
  brand chopp_brand NOT NULL,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  direction smallint NOT NULL CHECK (direction IN (-1, 1)),
  photo_url text,
  notes text,
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wm_wh_time ON public.warehouse_movements(warehouse_id, performed_at DESC);
GRANT SELECT, INSERT ON public.warehouse_movements TO authenticated;
GRANT ALL ON public.warehouse_movements TO service_role;
ALTER TABLE public.warehouse_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Movements readable" ON public.warehouse_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestor manutencao insert movements" ON public.warehouse_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'manutencao'));

-- Apply movement to stock automatically
CREATE OR REPLACE FUNCTION public.apply_warehouse_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.warehouse_stock(warehouse_id, brand, barrels, updated_at)
  VALUES (NEW.warehouse_id, NEW.brand, NEW.direction * NEW.quantidade, now())
  ON CONFLICT (warehouse_id, brand) DO UPDATE
    SET barrels = warehouse_stock.barrels + NEW.direction * NEW.quantidade,
        updated_at = now();

  IF NEW.move_type = 'transferencia' AND NEW.target_warehouse_id IS NOT NULL AND NEW.direction = -1 THEN
    INSERT INTO public.warehouse_stock(warehouse_id, brand, barrels, updated_at)
    VALUES (NEW.target_warehouse_id, NEW.brand, NEW.quantidade, now())
    ON CONFLICT (warehouse_id, brand) DO UPDATE
      SET barrels = warehouse_stock.barrels + NEW.quantidade,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_apply_warehouse_movement
AFTER INSERT ON public.warehouse_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_warehouse_movement();

-- Auto-decrement Dispel when refill_items are inserted
CREATE OR REPLACE FUNCTION public.deduct_dispel_on_refill()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dispel uuid;
  v_bar uuid;
  v_user uuid;
BEGIN
  IF NEW.quantidade <= 0 THEN RETURN NEW; END IF;
  SELECT id INTO v_dispel FROM public.warehouses WHERE code = 'dispel' LIMIT 1;
  SELECT bar_id, performed_by INTO v_bar, v_user FROM public.refills WHERE id = NEW.refill_id;
  IF v_dispel IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.warehouse_movements(
    warehouse_id, bar_id, refill_id, move_type, brand, quantidade, direction, performed_by, notes
  ) VALUES (
    v_dispel, v_bar, NEW.refill_id, 'abastecimento_bar', NEW.brand, NEW.quantidade, -1, v_user, 'Baixa automática por reposição'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_deduct_dispel_on_refill
AFTER INSERT ON public.refill_items
FOR EACH ROW EXECUTE FUNCTION public.deduct_dispel_on_refill();

-- Seed warehouses + zero stock
INSERT INTO public.warehouses(code, name) VALUES
  ('dispel','ESTOQUE DISPEL'),
  ('allstar','ESTOQUE ALL STAR');

INSERT INTO public.warehouse_stock(warehouse_id, brand, barrels)
SELECT w.id, b.brand, 0
FROM public.warehouses w
CROSS JOIN (VALUES ('heineken'::chopp_brand), ('amstel'::chopp_brand)) AS b(brand);
