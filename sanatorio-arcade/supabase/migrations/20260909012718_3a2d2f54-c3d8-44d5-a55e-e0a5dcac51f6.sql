CREATE TABLE public.botao_panico (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliques integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.botao_panico TO anon, authenticated;
GRANT ALL ON public.botao_panico TO service_role;

ALTER TABLE public.botao_panico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contador visivel para todos"
ON public.botao_panico FOR SELECT
TO anon, authenticated
USING (true);

INSERT INTO public.botao_panico (cliques) VALUES (0);

CREATE OR REPLACE FUNCTION public.incrementar_panico(_qtd integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _novo integer;
BEGIN
  IF _qtd IS NULL OR _qtd < 1 OR _qtd > 10 THEN
    _qtd := 1;
  END IF;

  UPDATE public.botao_panico
  SET cliques = cliques + _qtd, updated_at = now()
  WHERE id = (SELECT id FROM public.botao_panico ORDER BY created_at LIMIT 1)
  RETURNING cliques INTO _novo;

  RETURN _novo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.incrementar_panico(integer) TO anon, authenticated, service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.botao_panico;