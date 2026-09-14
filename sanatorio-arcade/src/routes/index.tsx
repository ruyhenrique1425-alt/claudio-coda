import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { internarPaciente } from "@/lib/sanatorio.functions";
import { AnimatePresence, motion } from "motion/react";
import { ClipboardCheck, Gamepad2, RotateCcw, Stethoscope } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { CartaoPixel } from "@/components/CartaoPixel";
import { Logo } from "@/components/Logo";
import { AltaMedica } from "@/components/AltaMedica";
import { Carteira } from "@/components/Carteira";
import { Extrato } from "@/components/Extrato";
import { Moldura, NomeDoPaciente } from "@/components/Moldura";
import { RadarAtributos } from "@/components/RadarAtributos";
import { Inventario } from "@/components/conquistas/Inventario";
import { conquistaPor, lerPendentes, limparPendentes } from "@/lib/conquistas";
import { creditarQrCode } from "@/lib/pontos";
import { laudoDe } from "@/lib/laudos";
import { supabase } from "@/integrations/supabase/client";
import { AttributeRow } from "@/components/AttributeRow";
import { EditorAvatar } from "@/components/avatar/EditorAvatar";
import { PixelAvatar } from "@/components/avatar/PixelAvatar";
import type { Avatar, PersonagemId } from "@/components/avatar/personagens";
import {
  lerProntuario,
  limparProntuario,
  salvarProntuario,
  type Prontuario,
  type Stats,
} from "@/lib/paciente-local";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sanatório — Prontuário de Admissão" },
      {
        name: "description",
        content:
          "Preencha seu prontuário, distribua 15 pontos entre os cinco diagnósticos e seja internado na festa Sanatório.",
      },
      { property: "og:title", content: "Sanatório — Prontuário de Admissão" },
      {
        property: "og:description",
        content: "Distribua 15 pontos entre os diagnósticos e confirme sua internação.",
      },
    ],
  }),
  component: Triagem,
});

const TOTAL_POINTS = 15;
const MAX_PER_ATTR = 5;

const ATTRIBUTES = [
  {
    key: "fatorCoringa",
    label: "Fator Coringa",
    hint: "O quão caótico e imprevisível você é. (0 = Planta decorativa / 5 = Capaz de sumir da festa e reaparecer com um cone de trânsito na cabeça).",
  },
  {
    key: "imunidadeEtilica",
    label: "Imunidade Etílica",
    hint: "Seu escudo natural. (0 = Beba água / 5 = Fígado blindado, capaz de aguentar até os combos mais pesados de Smirnoff - da caixa de 6, lógico - com Red Bull Zero).",
  },
  {
    key: "inimigoDoFim",
    label: "Síndrome do Inimigo do Fim",
    hint: "Sua resistência ao fim da festa. (0 = Bateu meia-noite, vira abóbora / 5 = Ignora que o sol raiou, a música parou e o faxineiro já tá varrendo o seu pé).",
  },
  {
    key: "aptidaoAudio",
    label: "Aptidão para Mandar Áudio",
    hint: "O risco social com o celular. (0 = Aparelho no bolso, comportado / 5 = Risco altíssimo de mandar aquele áudio inexplicável de 5 minutos para quem não deveria às 4 da manhã).",
  },
  {
    key: "amnesia",
    label: "Amnésia Anterógrada",
    hint: 'O apagão programado. (0 = Memória fotográfica / 5 = Certeza de que vai mandar no grupo amanhã: "Gente, como eu cheguei em casa?").',
  },
] as const;

type AttrKey = (typeof ATTRIBUTES)[number]["key"];

const EMPTY: Stats = {
  fatorCoringa: 0,
  imunidadeEtilica: 0,
  inimigoDoFim: 0,
  aptidaoAudio: 0,
  amnesia: 0,
};

function Triagem() {
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [prontuario, setProntuario] = useState<Prontuario | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<"ficha" | "personagem">("ficha");
  const internar = useServerFn(internarPaciente);

  const [itens, setItens] = useState<unknown>({});

  useEffect(() => {
    const p = lerProntuario();
    setProntuario(p);
    setHydrated(true);

    // Molduras e adereços vivem no banco, não no localStorage.
    if (p?.pacienteId) {
      void supabase
        .from("pacientes_publicos")
        .select("itens")
        .eq("id", p.pacienteId)
        .maybeSingle()
        .then(({ data }) => setItens(data?.itens ?? {}));
    }
  }, []);

  const spent = useMemo(() => Object.values(stats).reduce((a, b) => a + b, 0), [stats]);
  const remaining = TOTAL_POINTS - spent;
  const canConfirm = nome.trim().length >= 2 && remaining === 0;

  function change(key: AttrKey, delta: number) {
    setStats((prev) => {
      const next = prev[key] + delta;
      if (next < 0 || next > MAX_PER_ATTR) return prev;
      const total = Object.values(prev).reduce((a, b) => a + b, 0) - prev[key] + next;
      if (total > TOTAL_POINTS) return prev;
      return { ...prev, [key]: next };
    });
  }

  async function confirmar(escolha: { personagem: PersonagemId; avatar: Avatar }) {
    if (!canConfirm || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const { id, token } = await internar({
        data: {
          nome: nome.trim(),
          fator_coringa: stats.fatorCoringa,
          imunidade_etilica: stats.imunidadeEtilica,
          inimigo_do_fim: stats.inimigoDoFim,
          aptidao_audio: stats.aptidaoAudio,
          amnesia_anterograda: stats.amnesia,
          personagem: escolha.personagem,
          avatar: escolha.avatar,
        },
      });
      const salvo: Prontuario = {
        nome: nome.trim(),
        stats,
        internadoEm: new Date().toISOString(),
        pacienteId: id,
        token,
        personagem: escolha.personagem,
        avatar: escolha.avatar,
      };
      salvarProntuario(salvo);
      setProntuario(salvo);

      // Quem escaneou um QR antes de se internar recebe agora. O prontuário já
      // existe, então as fichas têm dono.
      const pendentes = lerPendentes();
      if (pendentes.length > 0) {
        await Promise.allSettled(
          pendentes.map((codigo) => {
            const c = conquistaPor(codigo);
            return c ? creditarQrCode(c.fichas, c.codigo) : Promise.resolve(false);
          }),
        );
        limparPendentes();
      }
      setTimeout(() => navigate({ to: "/arcade" }), 1100);
    } catch {
      setErro("Não deu para registrar sua ficha. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  function refazer() {
    limparProntuario();
    setNome("");
    setStats(EMPTY);
    setEtapa("ficha");
    setProntuario(null);
  }

  if (!hydrated) return <div className="min-h-[60vh]" />;

  if (!prontuario && etapa === "personagem") {
    return (
      <motion.div
        key="personagem"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <EditorAvatar
          onConfirmar={confirmar}
          onVoltar={() => setEtapa("ficha")}
          enviando={enviando}
        />
        {erro ? (
          <p role="alert" className="mt-3 text-center text-[11px] text-destructive">
            {erro}
          </p>
        ) : null}
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {prontuario ? (
        <motion.section
          key="internado"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <div className="rounded-sm border-2 border-neon bg-card/60 p-5 text-center shadow-[0_0_28px_-10px_var(--neon)]">
            <div className="flex justify-center">
              <Moldura itens={itens}>
                <PixelAvatar
                  personagem={prontuario.personagem}
                  avatar={prontuario.avatar}
                  size="lg"
                  glow
                  title={`Avatar de ${prontuario.nome}`}
                />
              </Moldura>
            </div>
            <ClipboardCheck className="mx-auto mt-3 h-8 w-8 text-neon" />

            <h1 className="font-arcade mt-4 text-[11px] uppercase leading-relaxed text-neon text-glow">
              {prontuario.altaEm ? "Paciente com alta" : "Paciente internado"}
            </h1>
            <p className="font-arcade mt-3 text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
              Leito {prontuario.pacienteId?.slice(0, 4).toUpperCase() ?? "—"}
            </p>
            <p className="font-arcade mt-2 break-words text-sm text-whisky">
              <NomeDoPaciente nome={prontuario.nome} itens={itens} />
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Internado em {new Date(prontuario.internadoEm).toLocaleDateString("pt-BR")}
            </p>
          </div>

          {prontuario.pacienteId ? (
            <div className="mt-4">
              <Carteira pacienteId={prontuario.pacienteId} />
            </div>
          ) : null}

          <div className="mt-4 rounded-sm border-2 border-purple/70 bg-card/50 p-4">
            <div className="flex justify-center">
              <RadarAtributos stats={prontuario.stats} />
            </div>
            <p className="mt-3 rounded-sm border border-whisky/50 bg-whisky/10 px-3 py-3 text-center text-[12px] leading-relaxed text-whisky">
              {laudoDe(prontuario.stats)}
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {ATTRIBUTES.map(({ key, label }) => (
              <div
                key={key}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm border border-purple/60 bg-card/40 px-3 py-3"
              >
                <span className="min-w-0 text-[13px] leading-snug text-foreground">{label}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex gap-1">
                    {Array.from({ length: MAX_PER_ATTR }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-3 w-1.5 rounded-sm ${
                          i < prontuario.stats[key] ? "bg-whisky" : "bg-input"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-arcade w-4 text-right text-[10px] text-whisky">
                    {prontuario.stats[key]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {prontuario.pacienteId ? <Inventario pacienteId={prontuario.pacienteId} /> : null}

          {prontuario.pacienteId ? <Extrato pacienteId={prontuario.pacienteId} /> : null}

          <AltaMedica
            jaTemAlta={Boolean(prontuario.altaEm)}
            aoConcluir={() => setProntuario(lerProntuario())}
          />

          <ArcadeButton
            onClick={() => navigate({ to: "/arcade" })}
            className="mt-6 flex w-full items-center justify-center gap-2 py-4 text-[10px] uppercase"
          >
            <Gamepad2 className="h-4 w-4" />
            Entrar no arcade
          </ArcadeButton>

          <ArcadeButton
            tone="whisky"
            onClick={refazer}
            className="mt-3 flex w-full items-center justify-center gap-2 py-4 text-[10px] uppercase"
          >
            <RotateCcw className="h-4 w-4" />
            Refazer triagem
          </ArcadeButton>
        </motion.section>
      ) : (
        <motion.section
          key="triagem"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="mb-5 flex justify-center">
            <Logo tamanho="grande" />
          </div>

          <CartaoPixel tom="purple">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 shrink-0 text-whisky" />
              <h1 className="font-arcade text-[10px] uppercase text-whisky text-glow">
                Sua ficha de internação
              </h1>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              Identifique-se e distribua 15 pontos entre os diagnósticos. No máximo 5 por doença.
            </p>

            <label htmlFor="nome" className="font-arcade mt-5 block text-[8px] uppercase text-neon">
              Nome de paciente
            </label>
            <input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={24}
              placeholder="DIGITE AQUI"
              className="tap-44 mt-2 w-full rounded-sm border-2 border-neon/50 bg-background px-3 py-3 font-mono text-sm uppercase text-foreground outline-none placeholder:text-muted-foreground focus:border-neon focus:shadow-[0_0_14px_-4px_var(--neon)]"
            />
          </CartaoPixel>

          <div className="sticky top-[86px] z-30 mt-4 rounded-sm border-2 border-whisky bg-background/95 px-4 py-3 backdrop-blur">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span className="font-arcade truncate text-[9px] uppercase text-foreground">
                Pontos restantes
              </span>
              <motion.span
                key={remaining}
                initial={{ scale: 1.35 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 18 }}
                className={`font-arcade shrink-0 text-xl ${
                  remaining === 0 ? "text-neon text-glow" : "text-whisky text-glow"
                }`}
              >
                {remaining}
              </motion.span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {ATTRIBUTES.map((attr) => (
              <AttributeRow
                key={attr.key}
                label={attr.label}
                hint={attr.hint}
                value={stats[attr.key]}
                max={MAX_PER_ATTR}
                canIncrease={remaining > 0}
                onChange={(delta) => change(attr.key, delta)}
              />
            ))}
          </div>

          <ArcadeButton
            onClick={() => setEtapa("personagem")}
            disabled={!canConfirm}
            className="mt-6 w-full py-5 text-[11px] uppercase leading-relaxed"
          >
            Escolher personagem
          </ArcadeButton>

          {erro ? (
            <p role="alert" className="mt-3 text-center text-[11px] text-destructive">
              {erro}
            </p>
          ) : null}

          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            {nome.trim().length < 2
              ? "Informe seu nome de paciente."
              : remaining > 0
                ? `Distribua os ${remaining} pontos restantes.`
                : "Pronto para internação."}
          </p>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
