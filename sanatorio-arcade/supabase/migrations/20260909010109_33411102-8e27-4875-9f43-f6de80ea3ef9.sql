CREATE TABLE public.pacientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL CHECK (char_length(trim(nome)) BETWEEN 2 AND 24),
  fator_coringa INTEGER NOT NULL DEFAULT 0 CHECK (fator_coringa BETWEEN 0 AND 10),
  imunidade_etilica INTEGER NOT NULL DEFAULT 0 CHECK (imunidade_etilica BETWEEN 0 AND 10),
  inimigo_do_fim INTEGER NOT NULL DEFAULT 0 CHECK (inimigo_do_fim BETWEEN 0 AND 10),
  aptidao_audio INTEGER NOT NULL DEFAULT 0 CHECK (aptidao_audio BETWEEN 0 AND 10),
  amnesia_anterograda INTEGER NOT NULL DEFAULT 0 CHECK (amnesia_anterograda BETWEEN 0 AND 10),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT pacientes_total_pontos CHECK (
    fator_coringa + imunidade_etilica + inimigo_do_fim + aptidao_audio + amnesia_anterograda <= 15
  )
);

GRANT SELECT, INSERT ON public.pacientes TO anon;
GRANT SELECT, INSERT ON public.pacientes TO authenticated;
GRANT ALL ON public.pacientes TO service_role;

ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fichas visiveis para todos" ON public.pacientes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Qualquer um pode se internar" ON public.pacientes FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.mural (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destinatario TEXT NOT NULL CHECK (destinatario IN ('Camarão', 'Recruta', 'Canela')),
  mensagem TEXT NOT NULL CHECK (char_length(trim(mensagem)) BETWEEN 1 AND 280),
  autor TEXT NOT NULL CHECK (char_length(trim(autor)) BETWEEN 1 AND 40),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.mural TO anon;
GRANT SELECT, INSERT ON public.mural TO authenticated;
GRANT ALL ON public.mural TO service_role;

ALTER TABLE public.mural ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mural visivel para todos" ON public.mural FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Qualquer um pode postar no mural" ON public.mural FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX mural_destinatario_created_at_idx ON public.mural (destinatario, created_at DESC);