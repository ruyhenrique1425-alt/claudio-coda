-- ============================================================================
-- Checagem de senha para telas de leitura da administração (ex: /admin-sanatorio).
--
-- Diferente de `salvar_personagem_customizado` e `salvar_conquista_bar`, que
-- alteram dado e por isso validam a senha por dentro, uma tela que só LÊ
-- tabelas já públicas (pacientes_publicos, fotos, mural) não tem nada a
-- proteger de verdade — a senha aqui é só a mesma barreira de conveniência
-- das outras telas de administração, não um controle de acesso a dado
-- sensível.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.checar_senha_administracao(_senha text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.oficina_config WHERE senha = _senha);
$$;

GRANT EXECUTE ON FUNCTION public.checar_senha_administracao(text) TO anon, authenticated;
