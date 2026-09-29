-- ============================================================================
-- Reações (curtida simples) em fotos e recados do mural.
--
-- Um coração, sem escolha de emoji: o que importa é dar um jeito rápido de
-- interagir com o que os outros pacientes postam, sem abrir outra tela.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_item text NOT NULL CHECK (tipo_item IN ('foto', 'mural')),
  item_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo_item, item_id, paciente_id)
);

CREATE INDEX IF NOT EXISTS reacoes_item_idx ON public.reacoes (tipo_item, item_id);

ALTER TABLE public.reacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reacoes_select ON public.reacoes;
CREATE POLICY reacoes_select ON public.reacoes FOR SELECT TO anon, authenticated USING (true);

-- Nenhuma policy de escrita: toda reação passa pela função abaixo, que exige
-- o token do paciente (mesma trava de toda escrita direta do app).

CREATE OR REPLACE FUNCTION public.reagir(
  _tipo_item text,
  _item_id uuid,
  _paciente uuid,
  _token uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _removida boolean;
BEGIN
  PERFORM public.exigir_paciente(_paciente, _token);

  IF _tipo_item NOT IN ('foto', 'mural') THEN
    RAISE EXCEPTION 'Tipo de item inválido.';
  END IF;

  DELETE FROM public.reacoes
  WHERE tipo_item = _tipo_item AND item_id = _item_id AND paciente_id = _paciente
  RETURNING true INTO _removida;

  IF _removida THEN
    RETURN false;
  END IF;

  INSERT INTO public.reacoes (tipo_item, item_id, paciente_id)
  VALUES (_tipo_item, _item_id, _paciente);

  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.reagir(text, uuid, uuid, uuid) TO anon, authenticated;
