
CREATE OR REPLACE FUNCTION public.deduct_dispel_on_refill()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dispel uuid;
  v_bar uuid;
  v_user uuid;
  v_notes text;
BEGIN
  IF NEW.quantidade <= 0 THEN RETURN NEW; END IF;
  SELECT bar_id, performed_by, notes INTO v_bar, v_user, v_notes FROM public.refills WHERE id = NEW.refill_id;
  -- Skip Dispel warehouse deduction for internal bar-to-bar transfers
  IF v_notes IS NOT NULL AND v_notes LIKE '__transfer__%' THEN RETURN NEW; END IF;
  SELECT id INTO v_dispel FROM public.warehouses WHERE code = 'dispel' LIMIT 1;
  IF v_dispel IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.warehouse_movements(
    warehouse_id, bar_id, refill_id, move_type, brand, quantidade, direction, performed_by, notes
  ) VALUES (
    v_dispel, v_bar, NEW.refill_id, 'abastecimento_bar', NEW.brand, NEW.quantidade, -1, v_user, 'Baixa automática por reposição'
  );
  RETURN NEW;
END;
$function$;
