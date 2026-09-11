import { useState } from "react";
import { motion } from "motion/react";

import { ArcadeButton } from "@/components/ArcadeButton";

const CASTIGOS = [
  "Tome um shot de água (sim, água).",
  "Desafie alguém pro par ou ímpar valendo a bebida.",
  "Distribua 2 shots pra quem você quiser.",
  "Beba você mesmo, o destino escolheu.",
  "Escolha alguém: essa pessoa bebe em dobro.",
  "Passe a vez e fique com cara de gênio do mal.",
  "Conte um perrengue seu ou beba.",
  "Brinde com todo mundo que estiver por perto.",
  "Última pessoa que você olhou paga o próximo shot.",
  "Dance 15 segundos ou pague um shot.",
];

export function RoletaEtilica() {
  const [angulo, setAngulo] = useState(0);
  const [indice, setIndice] = useState<number | null>(null);
  const [girando, setGirando] = useState(false);

  const fatia = 360 / CASTIGOS.length;

  function girar() {
    if (girando) return;
    setGirando(true);
    setIndice(null);
    const sorteado = Math.floor(Math.random() * CASTIGOS.length);
    const voltas = 4 + Math.floor(Math.random() * 3);
    const alvo = 360 * voltas + (360 - (sorteado * fatia + fatia / 2));
    setAngulo((a) => a + alvo);
    setTimeout(() => {
      setIndice(sorteado);
      setGirando(false);
    }, 2600);
  }

  return (
    <div className="text-center">
      <div className="relative mx-auto grid h-56 w-56 place-items-center">
        <div className="absolute -top-1 z-10 h-0 w-0 border-x-8 border-t-[14px] border-x-transparent border-t-whisky" />
        <motion.div
          animate={{ rotate: angulo }}
          transition={{ duration: 2.6, ease: [0.16, 1, 0.3, 1] }}
          className="h-52 w-52 rounded-full border-4 border-neon shadow-[0_0_30px_-8px_var(--neon)]"
          style={{
            background: `conic-gradient(${CASTIGOS.map((_, i) => {
              const cor =
                i % 3 === 0
                  ? "color-mix(in oklab, var(--neon) 30%, black)"
                  : i % 3 === 1
                    ? "color-mix(in oklab, var(--purple) 60%, black)"
                    : "color-mix(in oklab, var(--whisky) 30%, black)";
              return `${cor} ${i * fatia}deg ${(i + 1) * fatia}deg`;
            }).join(", ")})`,
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
        {girando ? "Girando…" : "Girar"}
      </ArcadeButton>

      <div className="mt-4 min-h-[76px] rounded-sm border border-neon/30 bg-card/50 p-4">
        {indice === null ? (
          <p className="text-[12px] text-muted-foreground">
            {girando ? "O destino está decidindo…" : "Gire a roleta e aceite o veredicto."}
          </p>
        ) : (
          <motion.p
            key={indice}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-[14px] leading-relaxed text-neon text-glow"
          >
            {CASTIGOS[indice]}
          </motion.p>
        )}
      </div>
    </div>
  );
}
