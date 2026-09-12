-- ============================================================================
-- Economia do Sanatório: identidade, carteira de pontos, curtidas, desafios,
-- prendas e premiação.
--
-- Regra central: o cliente NUNCA escreve pontos. Toda movimentação passa por
-- uma função SECURITY DEFINER que valida o par (paciente_id, token).
-- ============================================================================

-- ---------------------------------------------------------------- identidade
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS itens jsonb NOT NULL DEFAULT '{"comprados":[],"equipados":{}}'::jsonb;

-- O token é a senha do paciente. Ninguém pode ler a tabela crua por causa dele.
REVOKE ALL ON public.pacientes FROM anon, authenticated;

DROP POLICY IF EXISTS "Fichas visiveis para todos" ON public.pacientes;
DROP POLICY IF EXISTS "Qualquer um pode se internar" ON public.pacientes;

-- Leitura pública passa a ser por esta view, que não expõe o token.
CREATE OR REPLACE VIEW public.pacientes_publicos AS
SELECT id, nome, fator_coringa, imunidade_etilica, inimigo_do_fim,
       aptidao_audio, amnesia_anterograda, personagem, avatar, itens, created_at
FROM public.pacientes;

GRANT SELECT ON public.pacientes_publicos TO anon, authenticated;

-- --------------------------------------------------------------- transações
CREATE TABLE IF NOT EXISTS public.transacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  de_paciente uuid REFERENCES public.pacientes (id) ON DELETE SET NULL,
  para_paciente uuid NOT NULL REFERENCES public.pacientes (id) ON DELETE CASCADE,
  pontos integer NOT NULL CHECK (pontos > 0),
  motivo text NOT NULL CHECK (motivo IN ('jogo', 'qrcode', 'aposta', 'doacao', 'prenda')),
  referencia text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transacoes_para_idx ON public.transacoes (para_paciente, created_at DESC);
CREATE INDEX IF NOT EXISTS transacoes_de_idx ON public.transacoes (de_paciente, created_at DESC);
-- Um QR code do bar só pontua uma vez por paciente.
CREATE UNIQUE INDEX IF NOT EXISTS transacoes_qrcode_unico
  ON public.transacoes (para_paciente, referencia)
  WHERE motivo = 'qrcode';

CREATE TABLE IF NOT EXISTS public.gastos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id uuid NOT NULL REFERENCES public.pacientes (id) ON DELETE CASCADE,
  pontos integer NOT NULL CHECK (pontos > 0),
  item text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gastos_paciente_idx ON public.gastos (paciente_id);

-- Os dois números da carteira:
--   ganhos_total  só sobe. Vale para o ranking e para o prêmio das 3:33.
--   saldo         sobe e desce. É o que dá para apostar, doar e gastar.
-- Doação recebida não conta como ganho, senão bastaria concentrar pontos
-- num jogador só para ganhar o prêmio.
CREATE OR REPLACE VIEW public.saldo_pacientes AS
SELECT
  p.id AS paciente_id,
  p.nome,
  p.personagem,
  p.avatar,
  p.itens,
  p.created_at,
  COALESCE(g.ganhos, 0) AS ganhos_total,
  COALESCE(e.recebido, 0) - COALESCE(s.enviado, 0) - COALESCE(x.gasto, 0) AS saldo
FROM public.pacientes p
LEFT JOIN LATERAL (
  SELECT sum(t.pontos) AS ganhos FROM public.transacoes t
  WHERE t.para_paciente = p.id AND (t.de_paciente IS NULL OR t.motivo = 'aposta')
) g ON true
LEFT JOIN LATERAL (
  SELECT sum(t.pontos) AS recebido FROM public.transacoes t WHERE t.para_paciente = p.id
) e ON true
LEFT JOIN LATERAL (
  SELECT sum(t.pontos) AS enviado FROM public.transacoes t WHERE t.de_paciente = p.id
) s ON true
LEFT JOIN LATERAL (
  SELECT sum(ga.pontos) AS gasto FROM public.gastos ga WHERE ga.paciente_id = p.id
) x ON true;

GRANT SELECT ON public.saldo_pacientes TO anon, authenticated;

-- ----------------------------------------------------------------- curtidas
CREATE TABLE IF NOT EXISTS public.curtidas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  de_paciente uuid NOT NULL REFERENCES public.pacientes (id) ON DELETE CASCADE,
  para_paciente uuid NOT NULL REFERENCES public.pacientes (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curtidas_unicas UNIQUE (de_paciente, para_paciente),
  CONSTRAINT curtidas_sem_narcisismo CHECK (de_paciente <> para_paciente)
);

CREATE INDEX IF NOT EXISTS curtidas_para_idx ON public.curtidas (para_paciente, created_at DESC);

-- ----------------------------------------------------------------- desafios
CREATE TABLE IF NOT EXISTS public.desafios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  de_paciente uuid NOT NULL REFERENCES public.pacientes (id) ON DELETE CASCADE,
  para_paciente uuid NOT NULL REFERENCES public.pacientes (id) ON DELETE CASCADE,
  pontos integer NOT NULL CHECK (pontos IN (10, 25, 50)),
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aceito', 'resolvido', 'recusado', 'expirado')),
  escolha_de integer CHECK (escolha_de BETWEEN 0 AND 5),
  escolha_para integer CHECK (escolha_para BETWEEN 0 AND 5),
  vencedor uuid REFERENCES public.pacientes (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  CONSTRAINT desafios_sem_autodesafio CHECK (de_paciente <> para_paciente)
);

CREATE INDEX IF NOT EXISTS desafios_para_idx ON public.desafios (para_paciente, status, created_at DESC);
CREATE INDEX IF NOT EXISTS desafios_de_idx ON public.desafios (de_paciente, status, created_at DESC);

-- ------------------------------------------------------------------ prendas
CREATE TABLE IF NOT EXISTS public.prendas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  de_paciente uuid NOT NULL REFERENCES public.pacientes (id) ON DELETE CASCADE,
  para_paciente uuid NOT NULL REFERENCES public.pacientes (id) ON DELETE CASCADE,
  -- O dado tem 6 faces: 1, 1, 2, 2, 3, 3. Nunca mais que 3 segundos.
  segundos integer NOT NULL CHECK (segundos BETWEEN 1 AND 3),
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'cumprida', 'passou')),
  created_at timestamptz NOT NULL DEFAULT now(),
  respondida_em timestamptz,
  CONSTRAINT prendas_sem_autoprenda CHECK (de_paciente <> para_paciente)
);

CREATE INDEX IF NOT EXISTS prendas_para_idx ON public.prendas (para_paciente, status, created_at DESC);
CREATE INDEX IF NOT EXISTS prendas_cooldown_idx ON public.prendas (de_paciente, para_paciente, created_at DESC);

-- ---------------------------------------------------------------- premiação
CREATE TABLE IF NOT EXISTS public.premiacao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id uuid NOT NULL REFERENCES public.pacientes (id) ON DELETE CASCADE,
  nome text NOT NULL,
  ganhos_total integer NOT NULL,
  posicao integer NOT NULL,
  apurado_em timestamptz NOT NULL DEFAULT now()
);

-- =========================================================== RLS e permissões
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curtidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desafios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premiacao ENABLE ROW LEVEL SECURITY;

-- Leitura liberada: o extrato é público, faz parte da graça do ranking.
-- Escrita NÃO: só as funções abaixo escrevem.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transacoes', 'gastos', 'curtidas', 'desafios', 'prendas', 'premiacao']
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_leitura_publica', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      t || '_leitura_publica', t);
  END LOOP;
END $$;

-- ==================================================================== funções

-- Valida o par (paciente, token). Levanta exceção se não bater.
CREATE OR REPLACE FUNCTION public.exigir_paciente(_paciente uuid, _token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = _paciente AND token = _token) THEN
    RAISE EXCEPTION 'Prontuário não confere.' USING ERRCODE = '28000';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.saldo_de(_paciente uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT saldo FROM public.saldo_pacientes WHERE paciente_id = _paciente), 0)::integer;
$$;

-- Internação: única porta de entrada. Devolve o token, que nunca mais é lido.
CREATE OR REPLACE FUNCTION public.internar_paciente(
  _nome text, _fator_coringa integer, _imunidade_etilica integer,
  _inimigo_do_fim integer, _aptidao_audio integer, _amnesia_anterograda integer,
  _personagem text, _avatar jsonb
) RETURNS TABLE (id uuid, token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _fator_coringa + _imunidade_etilica + _inimigo_do_fim
     + _aptidao_audio + _amnesia_anterograda > 15 THEN
    RAISE EXCEPTION 'Total de pontos acima de 15.';
  END IF;

  RETURN QUERY
  INSERT INTO public.pacientes (
    nome, fator_coringa, imunidade_etilica, inimigo_do_fim,
    aptidao_audio, amnesia_anterograda, personagem, avatar)
  VALUES (
    btrim(_nome), _fator_coringa, _imunidade_etilica, _inimigo_do_fim,
    _aptidao_audio, _amnesia_anterograda, COALESCE(_personagem, 'interno'),
    COALESCE(_avatar, '{}'::jsonb))
  RETURNING pacientes.id, pacientes.token;
END $$;

-- Pontos ganhos em jogo ou no QR code do bar.
CREATE OR REPLACE FUNCTION public.creditar_pontos(
  _paciente uuid, _token uuid, _pontos integer, _motivo text, _referencia text DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.exigir_paciente(_paciente, _token);

  IF _motivo NOT IN ('jogo', 'qrcode') THEN
    RAISE EXCEPTION 'Motivo inválido para crédito direto.';
  END IF;
  IF _pontos < 1 OR _pontos > 100 THEN
    RAISE EXCEPTION 'Crédito fora da faixa permitida.';
  END IF;
  IF _motivo = 'qrcode' AND _referencia IS NULL THEN
    RAISE EXCEPTION 'QR code sem referência.';
  END IF;

  -- Teto diário por jogo, para ninguém farmar a noite inteira no mesmo minigame.
  IF _motivo = 'jogo' AND (
    SELECT COALESCE(sum(pontos), 0) FROM public.transacoes
    WHERE para_paciente = _paciente AND motivo = 'jogo'
      AND referencia IS NOT DISTINCT FROM _referencia
      AND created_at > now() - interval '1 hour') >= 300 THEN
    RAISE EXCEPTION 'Teto de pontos deste jogo atingido. Volte em uma hora.';
  END IF;

  INSERT INTO public.transacoes (de_paciente, para_paciente, pontos, motivo, referencia)
  VALUES (NULL, _paciente, _pontos, _motivo, _referencia)
  ON CONFLICT DO NOTHING;

  RETURN public.saldo_de(_paciente);
END $$;

-- Doação e pagamento de aposta.
CREATE OR REPLACE FUNCTION public.transferir_pontos(
  _de uuid, _token uuid, _para uuid, _pontos integer, _motivo text DEFAULT 'doacao'
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.exigir_paciente(_de, _token);

  IF _de = _para THEN RAISE EXCEPTION 'Não dá para doar pontos para si mesmo.'; END IF;
  IF _pontos < 1 THEN RAISE EXCEPTION 'Quantidade inválida.'; END IF;
  IF _motivo NOT IN ('doacao', 'aposta') THEN RAISE EXCEPTION 'Motivo inválido.'; END IF;
  IF public.saldo_de(_de) < _pontos THEN RAISE EXCEPTION 'Fichas insuficientes.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = _para) THEN
    RAISE EXCEPTION 'Paciente destino não existe.';
  END IF;

  INSERT INTO public.transacoes (de_paciente, para_paciente, pontos, motivo)
  VALUES (_de, _para, _pontos, _motivo);

  RETURN public.saldo_de(_de);
END $$;

-- Compra na loja de molduras e adereços.
CREATE OR REPLACE FUNCTION public.gastar_pontos(
  _paciente uuid, _token uuid, _pontos integer, _item text
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.exigir_paciente(_paciente, _token);

  IF _pontos < 1 THEN RAISE EXCEPTION 'Preço inválido.'; END IF;
  IF public.saldo_de(_paciente) < _pontos THEN RAISE EXCEPTION 'Fichas insuficientes.'; END IF;
  IF EXISTS (SELECT 1 FROM public.gastos WHERE paciente_id = _paciente AND item = _item) THEN
    RAISE EXCEPTION 'Você já comprou este item.';
  END IF;

  INSERT INTO public.gastos (paciente_id, pontos, item) VALUES (_paciente, _pontos, _item);

  UPDATE public.pacientes
  SET itens = jsonb_set(itens, '{comprados}',
        COALESCE(itens -> 'comprados', '[]'::jsonb) || to_jsonb(_item), true)
  WHERE id = _paciente;

  RETURN public.saldo_de(_paciente);
END $$;

-- Equipar o que já é seu não custa nada, mas continua passando pelo token.
CREATE OR REPLACE FUNCTION public.equipar_item(
  _paciente uuid, _token uuid, _slot text, _item text
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

-- Curtida no Match. Devolve true quando o interesse é mútuo.
CREATE OR REPLACE FUNCTION public.curtir(_de uuid, _token uuid, _para uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.exigir_paciente(_de, _token);
  IF _de = _para THEN RAISE EXCEPTION 'Autocurtida não conta.'; END IF;

  INSERT INTO public.curtidas (de_paciente, para_paciente)
  VALUES (_de, _para) ON CONFLICT DO NOTHING;

  RETURN EXISTS (
    SELECT 1 FROM public.curtidas WHERE de_paciente = _para AND para_paciente = _de);
END $$;

-- Prenda alcoólica: o dado é rolado no servidor, então ninguém força o 3.
CREATE OR REPLACE FUNCTION public.mandar_prenda(_de uuid, _token uuid, _para uuid)
RETURNS TABLE (id uuid, segundos integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _faces integer[] := ARRAY[1, 1, 2, 2, 3, 3];
        _sorteado integer;
BEGIN
  PERFORM public.exigir_paciente(_de, _token);
  IF _de = _para THEN RAISE EXCEPTION 'Mande a prenda para outra pessoa.'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.prendas
    WHERE de_paciente = _de AND para_paciente = _para
      AND created_at > now() - interval '15 minutes') THEN
    RAISE EXCEPTION 'Você já mandou uma prenda para este paciente nos últimos 15 minutos.';
  END IF;

  _sorteado := _faces[1 + floor(random() * 6)::integer];

  RETURN QUERY
  INSERT INTO public.prendas (de_paciente, para_paciente, segundos)
  VALUES (_de, _para, _sorteado)
  RETURNING prendas.id, prendas.segundos;
END $$;

-- Cumpriu: 10 pontos por segundo para quem bebeu. Passou: 5 para quem mandou.
CREATE OR REPLACE FUNCTION public.responder_prenda(
  _prenda uuid, _paciente uuid, _token uuid, _cumpriu boolean
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.prendas;
BEGIN
  PERFORM public.exigir_paciente(_paciente, _token);

  SELECT * INTO _p FROM public.prendas WHERE id = _prenda FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prenda não encontrada.'; END IF;
  IF _p.para_paciente <> _paciente THEN RAISE EXCEPTION 'Esta prenda não é sua.'; END IF;
  IF _p.status <> 'pendente' THEN RAISE EXCEPTION 'Prenda já respondida.'; END IF;

  UPDATE public.prendas
  SET status = CASE WHEN _cumpriu THEN 'cumprida' ELSE 'passou' END,
      respondida_em = now()
  WHERE id = _prenda;

  IF _cumpriu THEN
    INSERT INTO public.transacoes (de_paciente, para_paciente, pontos, motivo, referencia)
    VALUES (NULL, _paciente, _p.segundos * 10, 'prenda', _prenda::text);
  ELSE
    INSERT INTO public.transacoes (de_paciente, para_paciente, pontos, motivo, referencia)
    VALUES (NULL, _p.de_paciente, 5, 'prenda', _prenda::text);
  END IF;

  RETURN public.saldo_de(_paciente);
END $$;

-- Desafio de cachaça: par ou ímpar valendo pontos.
CREATE OR REPLACE FUNCTION public.criar_desafio(
  _de uuid, _token uuid, _para uuid, _pontos integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  PERFORM public.exigir_paciente(_de, _token);
  IF _de = _para THEN RAISE EXCEPTION 'Desafie outra pessoa.'; END IF;
  IF public.saldo_de(_de) < _pontos THEN RAISE EXCEPTION 'Fichas insuficientes.'; END IF;
  IF public.saldo_de(_para) < _pontos THEN
    RAISE EXCEPTION 'O desafiado não tem fichas suficientes.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.desafios
    WHERE de_paciente = _de AND para_paciente = _para AND status IN ('pendente', 'aceito')) THEN
    RAISE EXCEPTION 'Já existe um desafio em aberto com este paciente.';
  END IF;

  INSERT INTO public.desafios (de_paciente, para_paciente, pontos)
  VALUES (_de, _para, _pontos) RETURNING id INTO _id;

  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.responder_desafio(
  _desafio uuid, _paciente uuid, _token uuid, _aceita boolean
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d public.desafios;
BEGIN
  PERFORM public.exigir_paciente(_paciente, _token);

  SELECT * INTO _d FROM public.desafios WHERE id = _desafio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Desafio não encontrado.'; END IF;
  IF _d.para_paciente <> _paciente THEN RAISE EXCEPTION 'Este desafio não é seu.'; END IF;
  IF _d.status <> 'pendente' THEN RAISE EXCEPTION 'Desafio já respondido.'; END IF;
  IF _d.created_at < now() - interval '60 seconds' THEN
    UPDATE public.desafios SET status = 'expirado' WHERE id = _desafio;
    RETURN 'expirado';
  END IF;

  UPDATE public.desafios SET status = CASE WHEN _aceita THEN 'aceito' ELSE 'recusado' END
  WHERE id = _desafio;

  RETURN CASE WHEN _aceita THEN 'aceito' ELSE 'recusado' END;
END $$;

-- Cada um manda um número de 0 a 5 sem ver o do outro. A soma decide.
CREATE OR REPLACE FUNCTION public.jogar_desafio(
  _desafio uuid, _paciente uuid, _token uuid, _escolha integer
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d public.desafios;
        _vencedor uuid;
        _perdedor uuid;
BEGIN
  PERFORM public.exigir_paciente(_paciente, _token);
  IF _escolha < 0 OR _escolha > 5 THEN RAISE EXCEPTION 'Escolha entre 0 e 5.'; END IF;

  SELECT * INTO _d FROM public.desafios WHERE id = _desafio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Desafio não encontrado.'; END IF;
  IF _d.status <> 'aceito' THEN RAISE EXCEPTION 'Este desafio não está em jogo.'; END IF;

  IF _paciente = _d.de_paciente THEN
    IF _d.escolha_de IS NOT NULL THEN RAISE EXCEPTION 'Você já escolheu.'; END IF;
    UPDATE public.desafios SET escolha_de = _escolha WHERE id = _desafio;
    _d.escolha_de := _escolha;
  ELSIF _paciente = _d.para_paciente THEN
    IF _d.escolha_para IS NOT NULL THEN RAISE EXCEPTION 'Você já escolheu.'; END IF;
    UPDATE public.desafios SET escolha_para = _escolha WHERE id = _desafio;
    _d.escolha_para := _escolha;
  ELSE
    RAISE EXCEPTION 'Você não está neste desafio.';
  END IF;

  IF _d.escolha_de IS NULL OR _d.escolha_para IS NULL THEN
    RETURN 'aguardando';
  END IF;

  -- Quem desafiou fica com o par. Quem foi desafiado fica com o ímpar.
  IF (_d.escolha_de + _d.escolha_para) % 2 = 0 THEN
    _vencedor := _d.de_paciente; _perdedor := _d.para_paciente;
  ELSE
    _vencedor := _d.para_paciente; _perdedor := _d.de_paciente;
  END IF;

  INSERT INTO public.transacoes (de_paciente, para_paciente, pontos, motivo, referencia)
  VALUES (_perdedor, _vencedor, _d.pontos, 'aposta', _desafio::text);

  UPDATE public.desafios
  SET status = 'resolvido', vencedor = _vencedor, resolvido_em = now()
  WHERE id = _desafio;

  RETURN 'resolvido';
END $$;

-- Apuração das 3:33. Congela o pódio para não depender do relógio de ninguém.
CREATE OR REPLACE FUNCTION public.apurar_premiacao(_momento timestamptz)
RETURNS SETOF public.premiacao
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF now() < _momento THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.premiacao) THEN
    INSERT INTO public.premiacao (paciente_id, nome, ganhos_total, posicao)
    SELECT paciente_id, nome, ganhos_total::integer,
           row_number() OVER (ORDER BY ganhos_total DESC, created_at ASC)::integer
    FROM public.saldo_pacientes
    ORDER BY ganhos_total DESC, created_at ASC
    LIMIT 3;
  END IF;

  RETURN QUERY SELECT * FROM public.premiacao ORDER BY posicao;
END $$;

GRANT EXECUTE ON FUNCTION
  public.internar_paciente(text, integer, integer, integer, integer, integer, text, jsonb),
  public.creditar_pontos(uuid, uuid, integer, text, text),
  public.transferir_pontos(uuid, uuid, uuid, integer, text),
  public.gastar_pontos(uuid, uuid, integer, text),
  public.equipar_item(uuid, uuid, text, text),
  public.curtir(uuid, uuid, uuid),
  public.mandar_prenda(uuid, uuid, uuid),
  public.responder_prenda(uuid, uuid, uuid, boolean),
  public.criar_desafio(uuid, uuid, uuid, integer),
  public.responder_desafio(uuid, uuid, uuid, boolean),
  public.jogar_desafio(uuid, uuid, uuid, integer),
  public.apurar_premiacao(timestamptz)
TO anon, authenticated, service_role;

-- As funções internas não ficam expostas ao cliente.
REVOKE EXECUTE ON FUNCTION public.exigir_paciente(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.saldo_de(uuid) FROM anon, authenticated;

-- ---------------------------------------------------------------- realtime
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transacoes', 'curtidas', 'desafios', 'prendas']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
