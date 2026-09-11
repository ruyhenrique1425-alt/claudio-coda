import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { ArcadeButton } from "@/components/ArcadeButton";

type Fase = "pronto" | "lendo" | "resultado" | "indisponivel";

const DURACAO = 5000;
const LIMITE_TREMOR = 55;

type OrientationEventCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

export function DetectorMentiras() {
  const [fase, setFase] = useState<Fase>("pronto");
  const [progresso, setProgresso] = useState(0);
  const [tremor, setTremor] = useState(0);
  const [mentiu, setMentiu] = useState(false);
  const acumulado = useRef(0);
  const anterior = useRef<{ beta: number; gamma: number } | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearInterval(t));
      timers.current = [];
    },
    [],
  );

  async function iniciar() {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      setFase("indisponivel");
      return;
    }

    const ctor = window.DeviceOrientationEvent as OrientationEventCtor;
    if (typeof ctor.requestPermission === "function") {
      try {
        const ok = await ctor.requestPermission();
        if (ok !== "granted") {
          setFase("indisponivel");
          return;
        }
      } catch {
        setFase("indisponivel");
        return;
      }
    }

    acumulado.current = 0;
    anterior.current = null;
    setTremor(0);
    setProgresso(0);
    setFase("lendo");

    const onOrient = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;
      if (anterior.current) {
        acumulado.current +=
          Math.abs(beta - anterior.current.beta) + Math.abs(gamma - anterior.current.gamma);
      }
      anterior.current = { beta, gamma };
      setTremor(acumulado.current);
    };

    window.addEventListener("deviceorientation", onOrient);

    const inicio = Date.now();
    const tick = window.setInterval(() => {
      setProgresso(Math.min(1, (Date.now() - inicio) / DURACAO));
    }, 80);
    timers.current.push(tick);

    window.setTimeout(() => {
      window.removeEventListener("deviceorientation", onOrient);
      window.clearInterval(tick);
      setProgresso(1);
      setMentiu(acumulado.current > LIMITE_TREMOR);
      setFase("resultado");
    }, DURACAO);
  }

  return (
    <div className="space-y-5 text-center">
      {fase === "pronto" ? (
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Faça a pergunta, entregue o celular na mão do suspeito e mande ele ficar parado por 5
          segundos. O aparelho sente o tremor das mãos.
        </p>
      ) : null}

      {fase === "lendo" ? (
        <div className="space-y-4">
          <motion.p
            animate={{ opacity: [1, 0.35, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
            className="font-arcade text-[10px] uppercase leading-relaxed text-whisky"
          >
            Analisando...
          </motion.p>
          <div className="h-3 w-full overflow-hidden rounded-sm border-2 border-neon/60">
            <div
              className="h-full bg-neon transition-[width] duration-100"
              style={{ width: `${progresso * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Índice de tremor: {Math.round(tremor)}
          </p>
        </div>
      ) : null}

      {fase === "resultado" ? (
        <div className="space-y-4">
          <motion.p
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity }}
            className="font-arcade text-[12px] uppercase leading-relaxed"
            style={{ color: mentiu ? "oklch(0.62 0.25 25)" : "var(--neon)" }}
          >
            {mentiu ? "Mente descaradamente" : "Sincero (ou psicopata)"}
          </motion.p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Tremor medido: {Math.round(tremor)} —{" "}
            {mentiu ? "mãos em pânico." : "pulso de cirurgião."}
          </p>
        </div>
      ) : null}

      {fase === "indisponivel" ? (
        <p className="text-[12px] leading-relaxed text-whisky">
          Este aparelho não liberou os sensores de movimento. Abra pelo celular e autorize o acesso
          para fazer a análise.
        </p>
      ) : null}

      <ArcadeButton
        tone="purple"
        disabled={fase === "lendo"}
        onClick={iniciar}
        className="w-full p-4 text-[10px] uppercase"
      >
        {fase === "lendo"
          ? "Segure firme..."
          : fase === "resultado"
            ? "Analisar de novo"
            : "Iniciar análise"}
      </ArcadeButton>
    </div>
  );
}
