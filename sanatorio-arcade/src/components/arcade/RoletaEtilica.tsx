import { useRef, useState } from "react";
import { motion } from "motion/react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { usePontosDoJogo, vibrar } from "./usePontosDoJogo";

/**
 * Roleta Russa Etílica.
 * Cada fatia tem peso: castigo leve sai mais que castigo pesado, e as duas
 * fatias douradas (que valem fichas) são as mais raras da roda.
 */

type Castigo = {
  texto: string;
  peso: number;
  tom: "leve" | "pesado" | "premio";
  fichas?: number;
};

const CASTIGOS: Castigo[] = [
  { texto: "Tome um shot de água. Sim, água.", peso: 3, tom: "leve" },
  { texto: "Desafie alguém pro par ou ímpar valendo a bebida.", peso: 3, tom: "leve" },
  { texto: "Brinde com todo mundo que estiver por perto.", peso: 3, tom: "leve" },
  { texto: "Conte um perrengue seu ou beba.", peso: 2, tom: "leve" },
  { texto: "Faça um elogio sincero pro primeiro desconhecido que passar.", peso: 2, tom: "leve" },
  { texto: "Distribua 2 shots pra quem você quiser.", peso: 2, tom: "pesado" },
  { texto: "Beba você mesmo. O destino escolheu.", peso: 2, tom: "pesado" },
  { texto: "Escolha alguém: essa pessoa bebe em dobro.", peso: 2, tom: "pesado" },
  { texto: "Dance 15 segundos ou pague um shot.", peso: 2, tom: "pesado" },
  { texto: "A última pessoa que você olhou paga o próximo shot.", peso: 1, tom: "pesado" },
  { texto: "A casa é sua: +25 fichas na carteira.", peso: 1, tom: "premio", fichas: 25 },
  { texto: "Jackpot do manicômio: +50 fichas.", peso: 1, tom: "premio", fichas: 50 },
];

const CORES: Record<Castigo["tom"], string> = {
  leve: "color-mix(in oklab, var(--neon) 30%, black)",
  pesado: "color-mix(in oklab, var(--purple) 60%, black)",
  premio: "color-mix(in oklab, var(--whisky) 45%, black)",
};

/** Sorteio ponderado: fatias raras aparecem menos. */
function sortear(): number {
  const total = CASTIGOS.reduce((s, c) => s + c.peso, 0);
  let n = Math.random() * total;
  for (let i = 0; i < CASTIGOS.length; i++) {
    n -= CASTIGOS[i]!.peso;
    if (n <= 0) return i;
  }
  return CASTIGOS.length - 1;
}

export function RoletaEtilica() {
  const [angulo, setAngulo] = useState(0);
  const [indice, setIndice] = useState<number | null>(null);
  const [girando, setGirando] = useState(false);
  const [giros, setGiros] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { aviso, creditar } = usePontosDoJogo("roleta");

  const fatia = 360 / CASTIGOS.length;

  function girar() {
    if (girando) return;
    setGirando(true);
    setIndice(null);
    vibrar(20);

    const sorteado = sortear();
    const voltas = 5 + Math.floor(Math.random() * 3);
    // Para um pouco fora do centro da fatia, para não parecer roteirizado.
    const ruido = (Math.random() - 0.5) * fatia * 0.55;
    const alvo = 360 * voltas + (360 - (sorteado * fatia + fatia / 2)) + ruido;

    setAngulo((a) => a + alvo);
    timer.current = setTimeout(() => {
      setIndice(sorteado);
      setGirando(false);
      setGiros((g) => g + 1);
      vibrar([30, 20, 60]);
      const premio = CASTIGOS[sorteado]?.fichas;
      if (premio) void creditar(premio);
    }, 3200);
  }

  const resultado = indice === null ? null : CASTIGOS[indice]!;

  return (
    <div className="text-center">
      <div className="relative mx-auto grid h-56 w-56 place-items-center">
        <div className="absolute -top-1 z-10 h-0 w-0 border-x-8 border-t-[14px] border-x-transparent border-t-whisky" />
        <motion.div
          animate={{ rotate: angulo }}
          transition={{ duration: 3.2, ease: [0.12, 0.8, 0.2, 1] }}
          className="h-52 w-52 rounded-full border-4 border-neon shadow-[0_0_30px_-8px_var(--neon)]"
          style={{
            background: `conic-gradient(${CASTIGOS.map(
              (c, i) => `${CORES[c.tom]} ${i * fatia}deg ${(i + 1) * fatia}deg`,
            ).join(", ")})`,
          }}
        />
        <div className="absolute grid h-14 w-14 place-items-center rounded-full border-2 border-whisky bg-background">
          <span className="font-arcade text-[7px] text-whisky">SHOT</span>
        </div>
      </div>

      <ArcadeButton
        onClick={girar}
        disabled={girando}
        className="mt-6 w-full py-4 text-[10px] uppercase"
      >
        {girando ? "Girando…" : giros === 0 ? "Girar" : "Girar de novo"}
      </ArcadeButton>

      <div
        className={`mt-4 min-h-[84px] rounded-sm border-2 p-4 transition-colors ${
          resultado?.tom === "premio" ? "border-whisky bg-whisky/10" : "border-neon/30 bg-card/50"
        }`}
      >
        {resultado === null ? (
          <p className="text-[12px] text-muted-foreground">
            {girando ? "O destino está decidindo…" : "Gire a roleta e aceite o veredicto."}
          </p>
        ) : (
          <motion.div
            key={giros}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p
              className={`text-[14px] leading-relaxed text-glow ${
                resultado.tom === "premio" ? "text-whisky" : "text-neon"
              }`}
            >
              {resultado.texto}
            </p>
            {aviso && resultado.fichas ? (
              <p className="font-arcade mt-2 text-[8px] text-neon">{aviso}</p>
            ) : null}
          </motion.div>
        )}
      </div>

      {giros > 0 ? (
        <p className="font-arcade mt-3 text-[7px] uppercase text-muted-foreground">
          Giros nesta internação: {giros}
        </p>
      ) : null}
    </div>
  );
}
