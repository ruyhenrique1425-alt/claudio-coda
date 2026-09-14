import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Shuffle, Timer, XCircle } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { usePontosDoJogo, vibrar } from "./usePontosDoJogo";

/**
 * Terapia de Choque (era Diagnóstico Cruzado).
 * A missão agora vale fichas e tem relógio: dois minutos para cumprir e
 * confirmar. Missão difícil vale mais, e o paciente escolhe o nível.
 */

type Nivel = "leve" | "media" | "pesada";

type Missao = { texto: string; nivel: Nivel };

const PRAZO = 120_000;

const FICHAS: Record<Nivel, number> = { leve: 10, media: 20, pesada: 35 };

const ROTULOS: Record<Nivel, string> = {
  leve: "Ambulatorial",
  media: "Internação",
  pesada: "Eletrochoque",
};

const MISSOES: Missao[] = [
  { texto: "Brinde com alguém que você ainda não conhece.", nivel: "leve" },
  { texto: "Descubra o pior apelido de infância de alguém aqui.", nivel: "leve" },
  { texto: "Faça um elogio sincero para o primeiro desconhecido que passar.", nivel: "leve" },
  { texto: "Encontre alguém com o mesmo signo que o seu e brindem.", nivel: "leve" },
  { texto: "Peça uma indicação de música e faça o pedido ao DJ.", nivel: "leve" },
  { texto: "Encontre um paciente de blusa preta e tirem uma foto fazendo careta.", nivel: "media" },
  { texto: "Troque um acessório com outro paciente por 10 minutos.", nivel: "media" },
  { texto: "Junte três pessoas para uma foto estilo ficha policial.", nivel: "media" },
  { texto: "Peça a um interno para imitar o seu jeito de dançar.", nivel: "media" },
  { texto: "Aposte par ou ímpar com alguém: quem perder conta uma vergonha.", nivel: "media" },
  {
    texto: "Descubra o nome de três pacientes que você nunca viu e apresente-os entre si.",
    nivel: "media",
  },
  { texto: "Convença alguém a gritar o nome da festa junto com você. Alto.", nivel: "pesada" },
  {
    texto: "Monte uma roda de cinco pessoas e faça todo mundo brindar ao mesmo tempo.",
    nivel: "pesada",
  },
  { texto: "Peça o microfone e anuncie o próximo paciente que vai receber alta.", nivel: "pesada" },
  {
    texto: "Encontre os três moradores da república e tire uma foto com os três juntos.",
    nivel: "pesada",
  },
  { texto: "Arranje alguém para dançar com você uma música inteira. Inteira.", nivel: "pesada" },
];

type Fase = "pronto" | "valendo" | "concluida" | "estourou";

export function TerapiaDeChoque() {
  const [nivel, setNivel] = useState<Nivel>("media");
  const [missao, setMissao] = useState<Missao | null>(null);
  const [fase, setFase] = useState<Fase>("pronto");
  const [restante, setRestante] = useState(PRAZO);
  const [cumpridas, setCumpridas] = useState(0);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);
  const { aviso, creditar, limparAviso } = usePontosDoJogo("terapia-choque");

  const pararRelogio = useCallback(() => {
    if (relogio.current) clearInterval(relogio.current);
    relogio.current = null;
  }, []);

  useEffect(() => pararRelogio, [pararRelogio]);

  function sortear() {
    limparAviso();
    const candidatas = MISSOES.filter((m) => m.nivel === nivel && m.texto !== missao?.texto);
    const escolhida = candidatas[Math.floor(Math.random() * candidatas.length)]!;
    setMissao(escolhida);
    setFase("valendo");
    setRestante(PRAZO);
    vibrar(20);

    pararRelogio();
    const inicio = Date.now();
    relogio.current = setInterval(() => {
      const falta = PRAZO - (Date.now() - inicio);
      setRestante(Math.max(0, falta));
      if (falta <= 0) {
        pararRelogio();
        setFase("estourou");
        vibrar([80, 40, 80]);
      }
    }, 200);
  }

  function cumpri() {
    if (fase !== "valendo" || !missao) return;
    pararRelogio();
    setFase("concluida");
    setCumpridas((c) => c + 1);
    vibrar([30, 20, 30]);
    void creditar(FICHAS[missao.nivel]);
  }

  const segundos = Math.ceil(restante / 1000);
  const apertado = restante < 30_000;

  return (
    <div className="text-center">
      {/* Escolha do nível: quem topa mais vergonha leva mais ficha. */}
      <div className="grid grid-cols-3 gap-2">
        {(["leve", "media", "pesada"] as const).map((n) => (
          <button
            key={n}
            onClick={() => setNivel(n)}
            disabled={fase === "valendo"}
            className={`font-arcade tap-44 rounded-sm border-2 px-1 py-3 text-[7px] uppercase leading-tight transition-colors disabled:opacity-40 ${
              nivel === n
                ? "border-neon bg-neon/15 text-neon"
                : "border-purple/60 text-muted-foreground"
            }`}
          >
            {ROTULOS[n]}
            <span className="mt-1 block text-whisky">{FICHAS[n]}</span>
          </button>
        ))}
      </div>

      <div
        className={`mt-4 grid min-h-[160px] place-items-center rounded-sm border-2 p-5 transition-colors ${
          fase === "concluida"
            ? "border-neon bg-neon/10"
            : fase === "estourou"
              ? "border-destructive bg-destructive/10"
              : "border-purple bg-card/50"
        }`}
      >
        {missao === null ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Escolha o nível e receba sua missão de interação social compulsória. Dois minutos para
            cumprir.
          </p>
        ) : (
          <motion.div
            key={missao.texto + fase}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {fase === "concluida" ? (
              <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-neon" />
            ) : fase === "estourou" ? (
              <XCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
            ) : null}

            <p className="text-[15px] leading-relaxed text-whisky text-glow">{missao.texto}</p>

            {fase === "concluida" ? (
              <p className="font-arcade mt-3 text-[9px] uppercase text-neon">
                {aviso ?? "Missão cumprida"}
              </p>
            ) : null}
            {fase === "estourou" ? (
              <p className="font-arcade mt-3 text-[9px] uppercase text-destructive">
                Tempo esgotado. Sem fichas desta vez.
              </p>
            ) : null}
          </motion.div>
        )}
      </div>

      {fase === "valendo" ? (
        <>
          <div className="mt-3 flex items-center justify-center gap-2">
            <Timer className={`h-4 w-4 ${apertado ? "text-destructive" : "text-whisky"}`} />
            <span
              className={`font-arcade text-[12px] ${apertado ? "animate-pulse text-destructive" : "text-whisky"}`}
            >
              {segundos}s
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-input">
            <div
              className={`h-full transition-all duration-200 ${apertado ? "bg-destructive" : "bg-neon"}`}
              style={{ width: `${(restante / PRAZO) * 100}%` }}
            />
          </div>

          <ArcadeButton
            onClick={cumpri}
            className="mt-4 flex w-full items-center justify-center gap-2 py-5 text-[10px] uppercase"
          >
            <CheckCircle2 className="h-4 w-4" />
            Cumpri a missão
          </ArcadeButton>
        </>
      ) : (
        <ArcadeButton
          tone="whisky"
          onClick={sortear}
          className="mt-4 flex w-full items-center justify-center gap-2 py-5 text-[10px] uppercase"
        >
          <Shuffle className="h-4 w-4" />
          {missao === null ? "Sortear missão" : "Nova missão"}
        </ArcadeButton>
      )}

      {cumpridas > 0 ? (
        <p className="font-arcade mt-3 text-[7px] uppercase text-muted-foreground">
          Missões cumpridas: {cumpridas}
        </p>
      ) : null}
    </div>
  );
}
