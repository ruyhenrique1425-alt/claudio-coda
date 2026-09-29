-- ============================================================================
-- Códigos do bar, cadastrados pela administração.
--
-- As cinco conquistas originais (bemvindo, van, bar, xeque, privada) continuam
-- fixas no código (`lib/conquistas.ts`). Esta tabela é onde a administração
-- soma NOVOS códigos e conquistas — pelo app, sem editar código nem depender
-- de parâmetro na URL. Reaproveita a mesma senha da oficina de personagens
-- (tabela `oficina_config`, criada em 20260923010000_oficina_personagens.sql).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conquistas_bar (
  codigo text PRIMARY KEY,
  titulo text NOT NULL,
  onde_fica text NOT NULL,
  legenda text NOT NULL,
  fichas integer NOT NULL DEFAULT 30 CHECK (fichas > 0 AND fichas <= 100),
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conquistas_bar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conquistas_bar_select ON public.conquistas_bar;
CREATE POLICY conquistas_bar_select ON public.conquistas_bar
  FOR SELECT TO anon, authenticated USING (true);

-- Nenhuma policy de escrita: toda alteração passa pelas funções abaixo.

CREATE OR REPLACE FUNCTION public.salvar_conquista_bar(
  _senha text,
  _codigo text,
  _titulo text,
  _onde_fica text,
  _legenda text,
  _fichas integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.oficina_config WHERE senha = _senha) THEN
    RAISE EXCEPTION 'Senha incorreta.';
  END IF;

  IF _codigo !~ '^[a-z0-9][a-z0-9-]{1,31}$' THEN
    RAISE EXCEPTION 'Código inválido: use letras minúsculas, números e hífen, de 2 a 32 caracteres.';
  END IF;

  IF _codigo IN ('bemvindo', 'van', 'bar', 'xeque', 'privada') THEN
    RAISE EXCEPTION 'Este código já é uma das cinco conquistas originais.';
  END IF;

  IF length(trim(_titulo)) = 0 OR length(trim(_legenda)) = 0 THEN
    RAISE EXCEPTION 'Título e legenda não podem ficar em branco.';
  END IF;

  INSERT INTO public.conquistas_bar (codigo, titulo, onde_fica, legenda, fichas)
  VALUES (_codigo, _titulo, _onde_fica, _legenda, _fichas)
  ON CONFLICT (codigo) DO UPDATE SET
    titulo = excluded.titulo,
    onde_fica = excluded.onde_fica,
    legenda = excluded.legenda,
    fichas = excluded.fichas;
END $$;

GRANT EXECUTE ON FUNCTION public.salvar_conquista_bar(text, text, text, text, text, integer)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.apagar_conquista_bar(
  _senha text,
  _codigo text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.oficina_config WHERE senha = _senha) THEN
    RAISE EXCEPTION 'Senha incorreta.';
  END IF;

  DELETE FROM public.conquistas_bar WHERE codigo = _codigo;
END $$;

GRANT EXECUTE ON FUNCTION public.apagar_conquista_bar(text, text) TO anon, authenticated;

-- As cinco conquistas originais entram como registro (não editável pela tela
-- de administração — ver a checagem de código reservado acima), só para o
-- crédito de fichas abaixo ter uma fonte confiável também para elas.
INSERT INTO public.conquistas_bar (codigo, titulo, onde_fica, legenda, fichas) VALUES
  ('bemvindo', 'Internação Antecipada', 'Instagram da Sanatório, um dia antes',
   'O Coringa abriu o portão do hospício e já separou o seu leito. Chegou antes de todo mundo.', 40),
  ('van', 'Transporte de Pacientes', 'Dentro da van que leva os convidados',
   'Ninguém devia ter deixado ele dirigir. A van chegou, que é o que importa.', 30),
  ('bar', 'Medicação Líquida', 'No bar',
   'Prescrição do doutor: um copo, virado até o fim. Repetir conforme necessário.', 30),
  ('xeque', 'Xeque-Mate', 'Na mesa do xadrez',
   'Ele não sabe jogar, mas ganha sempre. Ninguém nunca entendeu como.', 30),
  ('privada', 'Sala de Meditação', 'No banheiro',
   'O único lugar do sanatório onde ele pensa na vida. Dura uns quatro minutos.', 30)
ON CONFLICT (codigo) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Fecha um buraco real: creditar_pontos aceitava qualquer `_pontos` que o
-- cliente mandasse para motivo 'qrcode', sem checar se a referência era um
-- código de verdade. Um chamado direto à função (fora do app) forjava
-- qualquer valor até 100. Agora o valor de fichas vem sempre do servidor,
-- lido de conquistas_bar — o que o cliente manda em `_pontos` é ignorado
-- para este motivo.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.creditar_pontos(
  _paciente uuid, _token uuid, _pontos integer, _motivo text,
  _referencia text DEFAULT NULL, _chave text DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pontos_reais integer;
BEGIN
  PERFORM public.exigir_paciente(_paciente, _token);

  IF _chave IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.transacoes WHERE chave_idempotencia = _chave
  ) THEN
    RETURN public.saldo_de(_paciente);
  END IF;

  IF _motivo NOT IN ('jogo', 'qrcode') THEN
    RAISE EXCEPTION 'Motivo inválido para crédito direto.';
  END IF;

  _pontos_reais := _pontos;

  IF _motivo = 'qrcode' THEN
    IF _referencia IS NULL THEN
      RAISE EXCEPTION 'QR code sem referência.';
    END IF;
    SELECT fichas INTO _pontos_reais FROM public.conquistas_bar WHERE codigo = _referencia;
    IF _pontos_reais IS NULL THEN
      RAISE EXCEPTION 'Código de conquista desconhecido.';
    END IF;
  END IF;

  IF _pontos_reais < 1 OR _pontos_reais > 100 THEN
    RAISE EXCEPTION 'Crédito fora da faixa permitida.';
  END IF;

  IF _motivo = 'jogo' AND (
    SELECT COALESCE(sum(pontos), 0) FROM public.transacoes
    WHERE para_paciente = _paciente AND motivo = 'jogo'
      AND referencia IS NOT DISTINCT FROM _referencia
      AND created_at > now() - interval '1 hour') >= 300 THEN
    RAISE EXCEPTION 'Teto de pontos deste jogo atingido. Volte em uma hora.';
  END IF;

  INSERT INTO public.transacoes
    (de_paciente, para_paciente, pontos, motivo, referencia, chave_idempotencia)
  VALUES (NULL, _paciente, _pontos_reais, _motivo, _referencia, _chave)
  ON CONFLICT DO NOTHING;

  RETURN public.saldo_de(_paciente);
END $$;
