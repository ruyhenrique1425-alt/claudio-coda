import { useState } from "react";
import { motion } from "motion/react";
import { Shuffle } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";

const DESAFIOS = [
  "Encontre um paciente com blusa preta e tirem uma foto fazendo careta.",
  "Brinde com alguém que você ainda não conhece.",
  "Peça a um interno para imitar o seu jeito de dançar.",
  "Convença alguém a gritar o nome da festa junto com você.",
  "Descubra o pior apelido de infância de alguém aqui.",
  "Tire uma selfie com o grupo mais barulhento do ambiente.",
  "Troque um acessório com outro paciente por 10 minutos.",
  "Peça uma indicação de música e faça o pedido ao DJ.",
  "Encontre alguém com o mesmo signo que o seu e brindem.",
  "Faça um elogio sincero para o primeiro desconhecido que passar.",
  "Junte três pessoas para uma foto estilo ficha policial.",
  "Aposte par ou ímpar com alguém: quem perder conta uma vergonha.",
];

export function DiagnosticoCruzado() {
  const [atual, setAtual] = useState<string | null>(null);
  const [rodada, setRodada] = useState(0);

  function sortear() {
    const sortear1 = () => DESAFIOS[Math.floor(Math.random() * DESAFIOS.length)] as string;
    let proximo = sortear1();
    if (DESAFIOS.length > 1) {
      while (proximo === atual) proximo = sortear1();
    }
    setAtual(proximo);
    setRodada((r) => r + 1);
  }

  return (
    <div className="text-center">
      <div className="grid min-h-[150px] place-items-center rounded-sm border-2 border-purple bg-card/50 p-5">
        {atual === null ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Aperte o botão e receba sua missão de interação social compulsória.
          </p>
        ) : (
          <motion.p
            key={rodada}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-[15px] leading-relaxed text-whisky text-glow"
          >
            {atual}
          </motion.p>
        )}
      </div>

      <ArcadeButton
        tone="whisky"
        onClick={sortear}
        className="mt-6 flex w-full items-center justify-center gap-2 py-5 text-[10px] uppercase"
      >
        <Shuffle className="h-4 w-4" />
        {atual === null ? "Sortear missão" : "Nova missão"}
      </ArcadeButton>

      {rodada > 0 ? (
        <p className="font-arcade mt-3 text-[7px] uppercase text-muted-foreground">
          Missões recebidas: {rodada}
        </p>
      ) : null}
    </div>
  );
}
