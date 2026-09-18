CREATE OR REPLACE FUNCTION public.equipar_item(
  _paciente uuid, _token uuid, _slot text, _item text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _novo jsonb;
BEGIN
  PERFORM public.exigir_paciente(_paciente, _token);

  IF _slot NOT IN ('moldura', 'adereco', 'nome') THEN
    RAISE EXCEPTION 'Slot desconhecido.';
  END IF;

  IF _item IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gastos WHERE paciente_id = _paciente AND item = _item) THEN
    RAISE EXCEPTION 'Item não comprado.';
  END IF;

  UPDATE public.pacientes
  SET itens = jsonb_set(itens, ARRAY['equipados', _slot],
        CASE WHEN _item IS NULL THEN 'null'::jsonb ELSE to_jsonb(_item) END, true)
  WHERE id = _paciente
  RETURNING itens INTO _novo;

  RETURN _novo;
END $$;

GRANT EXECUTE ON FUNCTION public.equipar_item(uuid, uuid, text, text)
  TO anon, authenticated, service_role;