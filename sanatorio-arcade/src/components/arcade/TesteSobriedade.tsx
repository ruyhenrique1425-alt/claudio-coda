import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Skull } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { usePontosDoJogo, vibrar } from "./usePontosDoJogo";

type PadId = 0 | 1 | 2 | 3;

const PADS: { id: PadId; nome: string; base: string; aceso: string }[] = [
  {
    id: 0,
    nome: "Verde",
    base: "border-neon bg-[color-mix(in_oklab,var(--neon)_14%,black)]",
    aceso: "border-neon bg-neon shadow-[0_0_36px_-4px_var(--neon)]",
  },
  {
    id: 1,
    nome: "Roxo",
    base: "border-purple bg-[color-mix(in_oklab,var(--purple)_25%,black)]",
    aceso: "border-purple bg-purple shadow-[0_0_36px_-4px_var(--purple)]",
  },
  {
    id: 2,
    nome: "Amarelo",
    base: "border-whisky bg-[color-mix(in_oklab,var(--whisky)_14%,black)]",
    aceso: "border-whisky bg-whisky shadow-[0_0_36px_-4px_var(--whisky)]",
  },
  {
    id: 3,
    nome: "Branco",
    base: "border-foreground/60 bg-[color-mix(in_oklab,var(--foreground)_12%,black)]",
    aceso: "border-foreground bg-foreground shadow-[0_0_36px_-4px_var(--foreground)]",
  },
];

type Fase = "pronto" | "mostrando" | "repetindo" | "gameover";

/* --------------------------- curva de dificuldade -------------------------- */

const ACESO_INICIAL = 700;
const PAUSA_INICIAL = 350;
const FATOR = 0.88;
const PISO_ACESO = 140;
const PISO_PAUSA = 70;

/** A cada rodada vencida os dois tempos encolhem 12%, até o piso. */
function ritmoDaRodada(rodada: number) {
  const escala = Math.pow(FATOR, Math.max(0, rodada - 1));
  return {
    aceso: Math.max(PISO_ACESO, Math.round(ACESO_INICIAL * escala)),
    pausa: Math.max(PISO_PAUSA, Math.round(PAUSA_INICIAL * escala)),
  };
}

/** Da rodada 8 em diante a tela treme e a cor apaga antes da hora. */
function fasePesada(rodada: number) {
  return rodada >= 8;
}

const LAUDOS: { ate: number; texto: string }[] = [
  { ate: 3, texto: "Diagnóstico: já passou do ponto. Vá beber água." },
  { ate: 7, texto: "Diagnóstico: sóbrio o suficiente para dirigir uma bicicleta." },
  { ate: 11, texto: "Diagnóstico: reflexos suspeitos. Você bebeu mesmo?" },
  { ate: Infinity, texto: "Diagnóstico: você é o motorista da rodada. Parabéns e sinto muito." },
];

function laudoDaRodada(rodada: number) {
  return (LAUDOS.find((l) => rodada <= l.ate) ?? LAUDOS[LAUDOS.length - 1]!).texto;
}

export function TesteSobriedade() {
  const [sequencia, setSequencia] = useState<PadId[]>([]);
  const [passo, setPasso] = useState(0);
  const [fase, setFase] = useState<Fase>("pronto");
  const [aceso, setAceso] = useState<PadId | null>(null);
  const [recorde, setRecorde] = useState(0);
  const [tremendo, setTremendo] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { aviso, creditar, limparAviso } = usePontosDoJogo("teste-sobriedade");

  const limparTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => limparTimers, [limparTimers]);

  const mostrar = useCallback(
    (seq: PadId[]) => {
      limparTimers();
      setFase("mostrando");

      const rodada = seq.length;
      const { aceso: tAceso, pausa } = ritmoDaRodada(rodada);
      const pesada = fasePesada(rodada);
      setTremendo(pesada);

      // Na fase pesada a cor some um pouco antes do previsto, então não dá
      // para contar com o ritmo — tem que olhar.
      const duracaoAceso = pesada ? Math.max(90, tAceso - 60) : tAceso;
      const ciclo = tAceso + pausa;

      seq.forEach((pad, i) => {
        timers.current.push(setTimeout(() => setAceso(pad), ciclo * i + 300));
        timers.current.push(setTimeout(() => setAceso(null), ciclo * i + 300 + duracaoAceso));
      });

      timers.current.push(
        setTimeout(
          () => {
            setPasso(0);
            setFase("repetindo");
          },
          ciclo * seq.length + 350,
        ),
      );
    },
    [limparTimers],
  );

  const proximaRodada = useCallback(
    (atual: PadId[]) => {
      const seq: PadId[] = [...atual, Math.floor(Math.random() * 4) as PadId];
      setSequencia(seq);
      mostrar(seq);
    },
    [mostrar],
  );

  function iniciar() {
    limparAviso();
    setSequencia([]);
    setPasso(0);
    setTremendo(false);
    proximaRodada([]);
  }

  function tocar(pad: PadId) {
    if (fase !== "repetindo") return;
    setAceso(pad);
    vibrar(15);
    timers.current.push(setTimeout(() => setAceso(null), 140));

    if (sequencia[passo] !== pad) {
      limparTimers();
      const alcancada = sequencia.length - 1;
      setRecorde((r) => Math.max(r, alcancada));
      setFase("gameover");
      setTremendo(false);
      vibrar([60, 40, 120]);
      // 8 fichas por rodada vencida. O teto por hora fica no servidor.
      void creditar(alcancada * 8);
      return;
    }

    if (passo + 1 === sequencia.length) {
      setRecorde((r) => Math.max(r, sequencia.length));
      setFase("mostrando");
      timers.current.push(setTimeout(() => proximaRodada(sequencia), 600));
    } else {
      setPasso(passo + 1);
    }
  }

  const rodadaAtual = sequencia.length;
  const { aceso: tempoAceso } = ritmoDaRodada(rodadaAtual || 1);

  if (fase === "gameover") {
    const alcancada = Math.max(0, sequencia.length - 1);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-sm border-2 border-destructive bg-destructive/10 p-6 text-center"
      >
        <Skull className="mx-auto h-10 w-10 text-destructive" />
        <p className="font-arcade mt-4 text-[12px] uppercase text-destructive text-glow">
          Reprovado
        </p>
        <p className="mt-4 text-[14px] leading-relaxed text-foreground">
          {laudoDaRodada(alcancada)}
        </p>
        <p className="font-arcade mt-4 text-[8px] uppercase text-whisky">
          Rodada alcançada: {alcancada} · Recorde: {recorde}
        </p>
        {aviso ? <p className="font-arcade mt-2 text-[8px] text-neon">{aviso}</p> : null}
        <ArcadeButton onClick={iniciar} className="mt-6 w-full py-4 text-[10px] uppercase">
          Novo teste
        </ArcadeButton>
      </motion.div>
    );
  }

  return (
    <div className="text-center">
      <div className="grid grid-cols-2 items-center gap-3">
        <p className="font-arcade text-left text-[8px] uppercase text-muted-foreground">
          Rodada {rodadaAtual}
        </p>
        <p className="font-arcade text-right text-[8px] uppercase text-whisky">Recorde {recorde}</p>
      </div>

      {/* Velocímetro: mostra de cara que o jogo está acelerando. */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-input">
        <div
          className={`h-full transition-all duration-500 ${
            fasePesada(rodadaAtual) ? "bg-destructive" : "bg-neon"
          }`}
          style={{
            width: `${Math.min(100, Math.round(((ACESO_INICIAL - tempoAceso) / (ACESO_INICIAL - PISO_ACESO)) * 100))}%`,
          }}
        />
      </div>

      <motion.div
        animate={tremendo ? { x: [0, -3, 3, -2, 2, 0] } : { x: 0 }}
        transition={tremendo ? { repeat: Infinity, duration: 0.35 } : { duration: 0.2 }}
        className="mt-4 grid grid-cols-2 gap-3"
      >
        {PADS.map((pad) => (
          <motion.button
            key={pad.id}
            whileTap={{ scale: 0.94 }}
            aria-label={pad.nome}
            disabled={fase !== "repetindo"}
            onClick={() => tocar(pad.id)}
            className={`aspect-square rounded-sm border-4 transition-all duration-100 ${
              aceso === pad.id ? pad.aceso : pad.base
            } ${fase !== "repetindo" ? "opacity-70" : ""}`}
          />
        ))}
      </motion.div>

      <p className="mt-4 min-h-[36px] text-[12px] leading-relaxed text-muted-foreground">
        {fase === "pronto"
          ? "A sequência acelera a cada rodada. Da oitava em diante, boa sorte."
          : fase === "mostrando"
            ? fasePesada(rodadaAtual)
              ? "Acelerou. Olhe, não conte."
              : "Preste atenção…"
            : `Sua vez: ${passo}/${sequencia.length}`}
      </p>

      {fase === "pronto" ? (
        <ArcadeButton onClick={iniciar} className="mt-2 w-full py-4 text-[10px] uppercase">
          Começar teste
        </ArcadeButton>
      ) : null}
    </div>
  );
}
