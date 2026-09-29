-- ============================================================================
-- Oficina de personagens.
--
-- Os 6 bonecos do catálogo (interno, enfermeira, coringa, seguranca, dj,
-- doutor) nascem fixos no código (`personagens.ts`). Esta migration guarda,
-- por cima, uma customização opcional por personagem — nome, frase, cabeça,
-- corpo, cores, acessório e item padrão — visível para todos os convidados.
-- Só quem sabe a senha da oficina consegue salvar ou restaurar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.oficina_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  senha text NOT NULL
);

-- Senha padrão: troque com
--   UPDATE public.oficina_config SET senha = 'sua-senha-nova';
INSERT INTO public.oficina_config (id, senha)
VALUES (true, 'sanatorio2026')
ON CONFLICT (id) DO NOTHING;

REVOKE ALL ON public.oficina_config FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.personagens_customizados (
  personagem_id text PRIMARY KEY,
  nome text,
  tagline text,
  head text,
  body text,
  cabelo text,
  roupa text,
  acessorio text,
  item text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.personagens_customizados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personagens_customizados_select ON public.personagens_customizados;
CREATE POLICY personagens_customizados_select ON public.personagens_customizados
  FOR SELECT TO anon, authenticated USING (true);

-- Nenhuma policy de escrita: toda alteração passa pelas funções abaixo.

CREATE OR REPLACE FUNCTION public.salvar_personagem_customizado(
  _senha text,
  _personagem_id text,
  _nome text,
  _tagline text,
  _head text,
  _body text,
  _cabelo text,
  _roupa text,
  _acessorio text,
  _item text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.oficina_config WHERE senha = _senha) THEN
    RAISE EXCEPTION 'Senha da oficina incorreta.';
  END IF;

  IF _personagem_id NOT IN ('interno', 'enfermeira', 'coringa', 'seguranca', 'dj', 'doutor') THEN
    RAISE EXCEPTION 'Personagem desconhecido.';
  END IF;

  INSERT INTO public.personagens_customizados
    (personagem_id, nome, tagline, head, body, cabelo, roupa, acessorio, item, atualizado_em)
  VALUES
    (_personagem_id, _nome, _tagline, _head, _body, _cabelo, _roupa, _acessorio, _item, now())
  ON CONFLICT (personagem_id) DO UPDATE SET
    nome = excluded.nome,
    tagline = excluded.tagline,
    head = excluded.head,
    body = excluded.body,
    cabelo = excluded.cabelo,
    roupa = excluded.roupa,
    acessorio = excluded.acessorio,
    item = excluded.item,
    atualizado_em = now();
END $$;

GRANT EXECUTE ON FUNCTION public.salvar_personagem_customizado(
  text, text, text, text, text, text, text, text, text, text
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.restaurar_personagem_customizado(
  _senha text,
  _personagem_id text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.oficina_config WHERE senha = _senha) THEN
    RAISE EXCEPTION 'Senha da oficina incorreta.';
  END IF;

  DELETE FROM public.personagens_customizados WHERE personagem_id = _personagem_id;
END $$;

GRANT EXECUTE ON FUNCTION public.restaurar_personagem_customizado(text, text)
  TO anon, authenticated;
