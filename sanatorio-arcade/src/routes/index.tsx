import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { internarPaciente } from "@/lib/sanatorio.functions";
import { AnimatePresence, motion } from "motion/react";

import { EditorAvatar } from "@/components/avatar/EditorAvatar";
import type { Avatar, PersonagemId } from "@/components/avatar/personagens";
import { FichaInternado } from "@/components/ficha/FichaInternado";
import {
  ATTRIBUTES,
  type AttrKey,
  MAX_PER_ATTR,
  TriagemForm,
} from "@/components/ficha/TriagemForm";
import { conquistaPor, lerPendentes, limparPendentes } from "@/lib/conquistas";
import { creditarQrCode } from "@/lib/pontos";
import { supabase } from "@/integrations/supabase/client";
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
        <FichaInternado
          key="internado"
          prontuario={prontuario}
          itens={itens}
          onRefazer={refazer}
          onAltaConcluida={() => setProntuario(lerProntuario())}
        />
      ) : (
        <TriagemForm
          key="triagem"
          nome={nome}
          onNomeChange={setNome}
          stats={stats}
          remaining={remaining}
          canConfirm={canConfirm}
          onChange={change}
          onAvancar={() => setEtapa("personagem")}
          erro={erro}
        />
      )}
    </AnimatePresence>
  );
}
