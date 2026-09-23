import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, RotateCcw, Save, Wrench } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { CartaoPixel } from "@/components/CartaoPixel";
import { PixelAvatar } from "@/components/avatar/PixelAvatar";
import {
  ACESSORIOS,
  AVATAR_PADRAO,
  BODY_IDS,
  CORES,
  HEAD_IDS,
  ITENS,
  normalizarAvatar,
  PERSONAGENS,
  personagemPor,
  type PersonagemId,
} from "@/components/avatar/personagens";
import { supabase } from "@/integrations/supabase/client";
import { restaurarCustomizacao, salvarCustomizacao, type CampoCustomizacao } from "@/lib/oficina";
import { comPrazo } from "@/lib/rede";

export const Route = createFileRoute("/oficina")({
  head: () => ({
    meta: [
      { title: "Oficina de personagens" },
      {
        name: "description",
        content: "Edite nome, cores, cabeça, corpo, acessório e item dos 6 bonecos do Sanatório.",
      },
    ],
  }),
  component: OficinaPage,
});

const SENHA_KEY = "sanatorio:senha-oficina";

type Overrides = Record<string, Partial<CampoCustomizacao>>;

function camposBase(id: PersonagemId): CampoCustomizacao {
  const p = personagemPor(id);
  return {
    nome: p.nome,
    tagline: p.tagline,
    head: p.head,
    body: p.body,
    cabelo: p.padrao.cabelo,
    roupa: p.padrao.roupa,
    acessorio: AVATAR_PADRAO.acessorio,
    item: AVATAR_PADRAO.item,
  };
}

function OficinaPage() {
  const [senha, setSenha] = useState("");
  const [selecionado, setSelecionado] = useState<PersonagemId>(PERSONAGENS[0].id);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [campos, setCampos] = useState<CampoCustomizacao>(() => camposBase(PERSONAGENS[0].id));
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    try {
      const guardada = sessionStorage.getItem(SENHA_KEY);
      if (guardada) setSenha(guardada);
    } catch {
      /* sem sessionStorage: segue sem lembrar a senha */
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    void comPrazo(Promise.resolve(supabase.from("personagens_customizados").select("*")))
      .then(({ data }) => {
        if (!ativo) return;
        const mapa: Overrides = {};
        for (const row of data ?? []) {
          const entry: Partial<CampoCustomizacao> = {};
          if (row.nome) entry.nome = row.nome;
          if (row.tagline) entry.tagline = row.tagline;
          if (row.head) entry.head = row.head;
          if (row.body) entry.body = row.body;
          if (row.cabelo) entry.cabelo = row.cabelo;
          if (row.roupa) entry.roupa = row.roupa;
          if (row.acessorio) entry.acessorio = row.acessorio;
          if (row.item) entry.item = row.item;
          mapa[row.personagem_id] = entry;
        }
        setOverrides(mapa);
      })
      .catch(() => {
        if (ativo) setErro("Não deu para ler as customizações salvas. Tente recarregar a tela.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const base = camposBase(selecionado);
    const override = overrides[selecionado];
    setCampos(override ? { ...base, ...override } : base);
  }, [selecionado, overrides]);

  function guardarSenha(v: string) {
    setSenha(v);
    try {
      sessionStorage.setItem(SENHA_KEY, v);
    } catch {
      /* sem sessionStorage: a senha só dura enquanto a tela estiver aberta */
    }
  }

  async function salvar() {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      await salvarCustomizacao(senha, selecionado, campos);
      setOverrides((atuais) => ({ ...atuais, [selecionado]: campos }));
      setAviso("Salvo. Todo mundo vê a partir da próxima abertura do app.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar.");
    } finally {
      setOcupado(false);
    }
  }

  async function restaurar() {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      await restaurarCustomizacao(senha, selecionado);
      setOverrides((atuais) => {
        const { [selecionado]: _descartado, ...resto } = atuais;
        return resto;
      });
      setAviso("Restaurado ao padrão original.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para restaurar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section>
      <CartaoPixel tom="purple" className="text-center">
        <h1 className="font-arcade text-[11px] uppercase leading-relaxed text-neon text-glow">
          Oficina de personagens
        </h1>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          Edite nome, frase, corpo, cores, acessório e item dos 6 bonecos. Vale para todo mundo que
          escolher esse personagem daqui pra frente.
        </p>
      </CartaoPixel>

      <div className="mt-4 rounded-sm border-2 border-whisky bg-card/50 p-3">
        <label
          htmlFor="senha-oficina"
          className="font-arcade flex items-center gap-2 text-[8px] uppercase text-whisky"
        >
          <Lock className="h-3.5 w-3.5" /> Senha da oficina
        </label>
        <input
          id="senha-oficina"
          type="password"
          value={senha}
          onChange={(e) => guardarSenha(e.target.value)}
          placeholder="Senha"
          className="tap-44 mt-2 w-full rounded-sm border-2 border-whisky/50 bg-background px-3 py-3 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-whisky"
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {PERSONAGENS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelecionado(p.id)}
            className={`font-arcade rounded-sm border-2 p-2 text-[7px] uppercase leading-tight transition-colors ${
              selecionado === p.id
                ? "border-neon bg-neon/10 text-neon"
                : "border-purple/50 text-muted-foreground"
            }`}
          >
            {personagemPor(p.id).nome}
            {overrides[p.id] ? <span className="mt-1 block text-whisky">customizado</span> : null}
          </button>
        ))}
      </div>

      {carregando ? (
        <p className="mt-4 text-center text-[12px] text-muted-foreground">Abrindo a oficina…</p>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-center gap-3 rounded-sm border border-neon/40 bg-background/60 p-4">
            <PixelAvatar
              personagem={selecionado}
              avatar={normalizarAvatar(campos)}
              size="lg"
              glow
            />
          </div>

          <div className="mt-4 space-y-3">
            <Campo label="Nome">
              <input
                value={campos.nome}
                onChange={(e) => setCampos((c) => ({ ...c, nome: e.target.value }))}
                maxLength={40}
                className="tap-44 w-full rounded-sm border-2 border-purple/60 bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-neon"
              />
            </Campo>

            <Campo label="Frase">
              <input
                value={campos.tagline}
                onChange={(e) => setCampos((c) => ({ ...c, tagline: e.target.value }))}
                maxLength={80}
                className="tap-44 w-full rounded-sm border-2 border-purple/60 bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-neon"
              />
            </Campo>

            <div className="grid grid-cols-2 gap-2">
              <Campo label="Cabeça">
                <Select
                  valor={campos.head}
                  opcoes={HEAD_IDS}
                  onChange={(v) => setCampos((c) => ({ ...c, head: v }))}
                />
              </Campo>
              <Campo label="Corpo">
                <Select
                  valor={campos.body}
                  opcoes={BODY_IDS}
                  onChange={(v) => setCampos((c) => ({ ...c, body: v }))}
                />
              </Campo>
              <Campo label="Cor do cabelo">
                <Select
                  valor={campos.cabelo}
                  opcoes={CORES.map((c) => c.id)}
                  rotulos={Object.fromEntries(CORES.map((c) => [c.id, c.label]))}
                  onChange={(v) => setCampos((c) => ({ ...c, cabelo: v }))}
                />
              </Campo>
              <Campo label="Cor da roupa">
                <Select
                  valor={campos.roupa}
                  opcoes={CORES.map((c) => c.id)}
                  rotulos={Object.fromEntries(CORES.map((c) => [c.id, c.label]))}
                  onChange={(v) => setCampos((c) => ({ ...c, roupa: v }))}
                />
              </Campo>
              <Campo label="Acessório padrão">
                <Select
                  valor={campos.acessorio}
                  opcoes={ACESSORIOS.map((a) => a.id)}
                  rotulos={Object.fromEntries(ACESSORIOS.map((a) => [a.id, a.label]))}
                  onChange={(v) => setCampos((c) => ({ ...c, acessorio: v }))}
                />
              </Campo>
              <Campo label="Item na mão padrão">
                <Select
                  valor={campos.item}
                  opcoes={ITENS.map((i) => i.id)}
                  rotulos={Object.fromEntries(ITENS.map((i) => [i.id, i.label]))}
                  onChange={(v) => setCampos((c) => ({ ...c, item: v }))}
                />
              </Campo>
            </div>
          </div>

          {erro ? (
            <p role="alert" className="mt-3 text-center text-[11px] text-destructive">
              {erro}
            </p>
          ) : null}
          {aviso ? <p className="mt-3 text-center text-[11px] text-neon">{aviso}</p> : null}

          <ArcadeButton
            onClick={() => void salvar()}
            disabled={ocupado || !senha}
            className="mt-4 flex w-full items-center justify-center gap-2 py-4 text-[10px] uppercase"
          >
            <Save className="h-4 w-4" />
            {ocupado ? "Salvando…" : "Salvar personagem"}
          </ArcadeButton>

          <ArcadeButton
            tone="whisky"
            onClick={() => void restaurar()}
            disabled={ocupado || !senha || !overrides[selecionado]}
            className="mt-3 flex w-full items-center justify-center gap-2 py-3 text-[9px] uppercase"
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar padrão original
          </ArcadeButton>

          <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0" />O acessório e o item aqui só valem
            como padrão de quem escolher este boneco depois de salvo — quem já tem ficha mantém o
            que já equipou.
          </p>
        </>
      )}
    </section>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-arcade mb-1.5 block text-[7px] uppercase text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  valor,
  opcoes,
  rotulos,
  onChange,
}: {
  valor: string;
  opcoes: readonly string[];
  rotulos?: Record<string, string>;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className="tap-44 w-full rounded-sm border-2 border-purple/60 bg-background px-2 py-2 text-[12px] text-foreground outline-none focus:border-neon"
    >
      {opcoes.map((id) => (
        <option key={id} value={id}>
          {rotulos?.[id] ?? id}
        </option>
      ))}
    </select>
  );
}
