CREATE OR REPLACE FUNCTION public.apply_heineken_carga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispel uuid;
  v_note text;
BEGIN
  SELECT id INTO v_dispel FROM public.warehouses WHERE code = 'dispel' LIMIT 1;
  IF v_dispel IS NULL THEN RETURN NEW; END IF;

  v_note := 'Carga Heineken' || CASE WHEN NEW.invoice_number IS NOT NULL AND NEW.invoice_number <> '' THEN ' NF ' || NEW.invoice_number ELSE '' END;

  IF NEW.heineken_barris > 0 THEN
    INSERT INTO public.warehouse_movements(warehouse_id, move_type, brand, quantidade, direction, performed_by, notes, photo_url)
    VALUES (v_dispel, 'recebimento_heineken', 'heineken', NEW.heineken_barris, 1, NEW.performed_by, v_note, NEW.invoice_photo_url);
  END IF;
  IF NEW.amstel_barris > 0 THEN
    INSERT INTO public.warehouse_movements(warehouse_id, move_type, brand, quantidade, direction, performed_by, notes, photo_url)
    VALUES (v_dispel, 'recebimento_heineken', 'amstel', NEW.amstel_barris, 1, NEW.performed_by, v_note, NEW.invoice_photo_url);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_heineken_carga ON public.heineken_cargas;
CREATE TRIGGER trg_apply_heineken_carga
AFTER INSERT ON public.heineken_cargas
FOR EACH ROW EXECUTE FUNCTION public.apply_heineken_carga();