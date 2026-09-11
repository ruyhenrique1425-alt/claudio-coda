import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Skull } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";

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

export function GeniusManicomio() {
  const [sequencia, setSequencia] = useState<PadId[]>([]);
  const [passo, setPasso] = useState(0);
  const [fase, setFase] = useState<Fase>("pronto");
  const [aceso, setAceso] = useState<PadId | null>(null);
  const [recorde, setRecorde] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const limparTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => limparTimers, [limparTimers]);

  const mostrar = useCallback(
    (seq: PadId[]) => {
      limparTimers();
      setFase("mostrando");
      seq.forEach((pad, i) => {
        timers.current.push(setTimeout(() => setAceso(pad), 600 * i + 350));
        timers.current.push(setTimeout(() => setAceso(null), 600 * i + 350 + 380));
      });
      timers.current.push(
        setTimeout(
          () => {
            setPasso(0);
            setFase("repetindo");
          },
          600 * seq.length + 400,
        ),
      );
    },
    [limparTimers],
  );

  function proximaRodada(atual: PadId[]) {
    const seq: PadId[] = [...atual, Math.floor(Math.random() * 4) as PadId];
    setSequencia(seq);
    mostrar(seq);
  }

  function iniciar() {
    setSequencia([]);
    setPasso(0);
    proximaRodada([]);
  }

  function tocar(pad: PadId) {
    if (fase !== "repetindo") return;
    setAceso(pad);
    timers.current.push(setTimeout(() => setAceso(null), 180));

    if (sequencia[passo] !== pad) {
      limparTimers();
      setRecorde((r) => Math.max(r, sequencia.length - 1));
      setFase("gameover");
      return;
    }

    if (passo + 1 === sequencia.length) {
      setRecorde((r) => Math.max(r, sequencia.length));
      timers.current.push(setTimeout(() => proximaRodada(sequencia), 700));
      setFase("mostrando");
    } else {
      setPasso(passo + 1);
    }
  }

  if (fase === "gameover") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-sm border-2 border-destructive bg-destructive/10 p-6 text-center"
      >
        <Skull className="mx-auto h-10 w-10 text-destructive" />
        <p className="font-arcade mt-4 text-[12px] uppercase text-destructive text-glow">
          Game Over
        </p>
        <p className="mt-4 text-[14px] leading-relaxed text-foreground">
          Diagnóstico: Reflexos comprometidos. Vá beber um copo d&apos;água.
        </p>
        <p className="font-arcade mt-4 text-[8px] uppercase text-whisky">
          Sequência máxima: {recorde}
        </p>
        <ArcadeButton onClick={iniciar} className="mt-6 w-full py-4 text-[10px] uppercase">
          Nova internação
        </ArcadeButton>
      </motion.div>
    );
  }

  return (
    <div className="text-center">
      <div className="grid grid-cols-2 items-center gap-3">
        <p className="font-arcade text-left text-[8px] uppercase text-muted-foreground">
          Rodada {sequencia.length}
        </p>
        <p className="font-arcade text-right text-[8px] uppercase text-whisky">Recorde {recorde}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {PADS.map((pad) => (
          <motion.button
            key={pad.id}
            whileTap={{ scale: 0.94 }}
            aria-label={pad.nome}
            disabled={fase !== "repetindo"}
            onClick={() => tocar(pad.id)}
            className={`aspect-square rounded-sm border-4 transition-all duration-150 ${
              aceso === pad.id ? pad.aceso : pad.base
            } ${fase !== "repetindo" ? "opacity-70" : ""}`}
          />
        ))}
      </div>

      <p className="mt-4 min-h-[36px] text-[12px] leading-relaxed text-muted-foreground">
        {fase === "pronto"
          ? "Observe a sequência do manicômio e repita na ordem exata."
          : fase === "mostrando"
            ? "Preste atenção…"
            : "Sua vez: repita a sequência."}
      </p>

      {fase === "pronto" ? (
        <ArcadeButton onClick={iniciar} className="mt-2 w-full py-4 text-[10px] uppercase">
          Começar
        </ArcadeButton>
      ) : null}
    </div>
  );
}
