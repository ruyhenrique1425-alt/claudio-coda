-- ============================================================================
-- Modo sítio: o app guarda o que o paciente fez sem sinal e reenvia depois.
--
-- Reenvio exige idempotência. Sem ela, um "timeout" que na verdade chegou ao
-- servidor vira ponto creditado duas vezes quando a fila tentar de novo.
-- A chave é gerada no celular, viaja junto e o banco recusa a repetição.
-- ============================================================================

ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS chave_idempotencia text;
ALTER TABLE public.mural ADD COLUMN IF NOT EXISTS chave_idempotencia text;
ALTER TABLE public.fotos ADD COLUMN IF NOT EXISTS chave_idempotencia text;

CREATE UNIQUE INDEX IF NOT EXISTS transacoes_chave_unica
  ON public.transacoes (chave_idempotencia) WHERE chave_idempotencia IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mural_chave_unica
  ON public.mural (chave_idempotencia) WHERE chave_idempotencia IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fotos_chave_unica
  ON public.fotos (chave_idempotencia) WHERE chave_idempotencia IS NOT NULL;

-- Crédito de jogo com chave. Repetir a mesma chave não soma de novo: devolve
-- o saldo atual como se tivesse funcionado, que é o que a fila precisa ouvir.
CREATE OR REPLACE FUNCTION public.creditar_pontos(
  _paciente uuid, _token uuid, _pontos integer, _motivo text,
  _referencia text DEFAULT NULL, _chave text DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF _pontos < 1 OR _pontos > 100 THEN
    RAISE EXCEPTION 'Crédito fora da faixa permitida.';
  END IF;
  IF _motivo = 'qrcode' AND _referencia IS NULL THEN
    RAISE EXCEPTION 'QR code sem referência.';
  END IF;

  -- Teto por jogo continua valendo, inclusive para o que chega atrasado.
  IF _motivo = 'jogo' AND (
    SELECT COALESCE(sum(pontos), 0) FROM public.transacoes
    WHERE para_paciente = _paciente AND motivo = 'jogo'
      AND referencia IS NOT DISTINCT FROM _referencia
      AND created_at > now() - interval '1 hour') >= 300 THEN
    RAISE EXCEPTION 'Teto de pontos deste jogo atingido. Volte em uma hora.';
  END IF;

  INSERT INTO public.transacoes
    (de_paciente, para_paciente, pontos, motivo, referencia, chave_idempotencia)
  VALUES (NULL, _paciente, _pontos, _motivo, _referencia, _chave)
  ON CONFLICT DO NOTHING;

  RETURN public.saldo_de(_paciente);
END $$;

-- Recado do mural com chave, para o reenvio não duplicar a mensagem.
CREATE OR REPLACE FUNCTION public.postar_recado(
  _destinatario text, _mensagem text, _autor text, _chave text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _destinatario NOT IN ('Camarão', 'Recruta', 'Canela') THEN
    RAISE EXCEPTION 'Destinatário desconhecido.';
  END IF;

  INSERT INTO public.mural (destinatario, mensagem, autor, chave_idempotencia)
  VALUES (_destinatario, btrim(_mensagem), btrim(_autor), _chave)
  ON CONFLICT DO NOTHING;

  RETURN true;
END $$;

-- Registro de foto com chave. O path do storage já era único; a chave cobre
-- o caso de o upload ter subido e só a linha ter se perdido no caminho.
CREATE OR REPLACE FUNCTION public.registrar_foto(
  _path text, _autor text, _legenda text DEFAULT NULL, _chave text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.fotos (path, autor, legenda, chave_idempotencia)
  VALUES (btrim(_path), btrim(_autor), _legenda, _chave)
  ON CONFLICT DO NOTHING;

  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION
  public.creditar_pontos(uuid, uuid, integer, text, text, text),
  public.postar_recado(text, text, text, text),
  public.registrar_foto(text, text, text, text)
TO anon, authenticated, service_role;

-- A versão antiga de creditar_pontos (cinco argumentos) sai de cena para não
-- existir caminho sem chave.
DROP FUNCTION IF EXISTS public.creditar_pontos(uuid, uuid, integer, text, text);

-- Escrita direta nessas tabelas passa a ser só pelas funções acima.
REVOKE INSERT ON public.mural FROM anon, authenticated;
REVOKE INSERT ON public.fotos FROM anon, authenticated;
DROP POLICY IF EXISTS "Qualquer um pode postar no mural" ON public.mural;
DROP POLICY IF EXISTS "Qualquer um pode enviar foto" ON public.fotos;
