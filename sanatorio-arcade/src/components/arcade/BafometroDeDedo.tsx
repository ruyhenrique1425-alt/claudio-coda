import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Wind } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { usePontosDoJogo, vibrar } from "./usePontosDoJogo";

/**
 * Bafômetro de Dedo — o clicker do fliperama.
 *
 * Duas fases, porque só martelar o botão cansa:
 *   SOPRO   10 segundos batendo na garrafa o mais rápido possível.
 *   PULSO   3 segundos segurando o dedo parado no centro do alvo.
 *
 * A nota final mistura velocidade e firmeza, que é exatamente o que uma
 * blitz mediria — se a blitz fosse feita por um manicômio.
 */

const DURACAO_SOPRO = 10_000;
const DURACAO_PULSO = 3_000;
const TOQUES_MAXIMO = 90; // acima disso a agulha crava no fim da escala

type Fase = "pronto" | "soprando" | "intervalo" | "pulso" | "resultado";

const LAUDOS: { ate: number; titulo: string; texto: string }[] = [
  {
    ate: 25,
    titulo: "Sóbrio demais",
    texto: "Agulha parada. Ou você não bebeu, ou o dedo desistiu antes de você.",
  },
  {
    ate: 45,
    titulo: "Dentro da média",
    texto: "Reflexo de gente que ainda lembra o próprio nome. Aproveite enquanto dura.",
  },
  {
    ate: 70,
    titulo: "Alterado",
    texto: "Rápido e trêmulo. Clássico do terceiro combo com energético.",
  },
  {
    ate: 90,
    titulo: "Crítico",
    texto: "Velocidade de máquina e firmeza de gelatina. Sente um pouco.",
  },
  {
    ate: 101,
    titulo: "Fora da escala",
    texto: "O aparelho quebrou. Este paciente é o motivo de existir enfermaria.",
  },
];

function laudo(nota: number) {
  return LAUDOS.find((l) => nota <= l.ate) ?? LAUDOS[LAUDOS.length - 1]!;
}

export function BafometroDeDedo() {
  const [fase, setFase] = useState<Fase>("pronto");
  const [toques, setToques] = useState(0);
  const [restante, setRestante] = useState(DURACAO_SOPRO);
  const [combo, setCombo] = useState(0);
  const [firmeza, setFirmeza] = useState(100);
  const [nota, setNota] = useState(0);

  const ultimoToque = useRef(0);
  const pressionado = useRef(false);
  const desvio = useRef(0);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const { aviso, creditar, limparAviso } = usePontosDoJogo("bafometro");

  const limpar = useCallback(() => {
    timers.current.forEach(clearInterval);
    timers.current = [];
  }, []);

  useEffect(() => limpar, [limpar]);

  const iniciarPulso = useCallback(() => {
    desvio.current = 0;
    pressionado.current = false;
    setFirmeza(100);
    setRestante(DURACAO_PULSO);
    setFase("pulso");

    const inicio = Date.now();
    const id = setInterval(() => {
      const decorrido = Date.now() - inicio;
      setRestante(Math.max(0, DURACAO_PULSO - decorrido));

      // Dedo fora do alvo penaliza. Quem segura firme mantém os 100.
      if (!pressionado.current) {
        desvio.current += 4;
        setFirmeza(Math.max(0, 100 - desvio.current));
      }

      if (decorrido >= DURACAO_PULSO) {
        clearInterval(id);
        setFase("resultado");
      }
    }, 100);
    timers.current.push(id);
  }, []);

  const iniciar = useCallback(() => {
    limpar();
    limparAviso();
    setToques(0);
    setCombo(0);
    setNota(0);
    setRestante(DURACAO_SOPRO);
    setFase("soprando");
    ultimoToque.current = 0;

    const inicio = Date.now();
    const id = setInterval(() => {
      const decorrido = Date.now() - inicio;
      setRestante(Math.max(0, DURACAO_SOPRO - decorrido));
      if (decorrido >= DURACAO_SOPRO) {
        clearInterval(id);
        setFase("intervalo");
        setTimeout(iniciarPulso, 1200);
      }
    }, 100);
    timers.current.push(id);
  }, [limpar, limparAviso, iniciarPulso]);

  function bater() {
    if (fase !== "soprando") return;
    const agora = Date.now();
    // Toques em menos de 140ms encadeiam combo. Ritmo, não martelada cega.
    setCombo((c) => (agora - ultimoToque.current < 140 ? c + 1 : 0));
    ultimoToque.current = agora;
    setToques((t) => t + 1);
    vibrar(8);
  }

  // Nota final: 70% velocidade, 30% firmeza.
  useEffect(() => {
    if (fase !== "resultado") return;
    const velocidade = Math.min(100, Math.round((toques / TOQUES_MAXIMO) * 100));
    const final = Math.round(velocidade * 0.7 + firmeza * 0.3);
    setNota(final);
    vibrar([40, 30, 40]);
    void creditar(Math.round(final / 2));
  }, [fase, toques, firmeza, creditar]);

  const agulha = Math.min(100, Math.round((toques / TOQUES_MAXIMO) * 100));

  if (fase === "resultado") {
    const l = laudo(nota);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-sm border-2 border-whisky bg-card/60 p-6 text-center"
      >
        <p className="font-arcade text-[8px] uppercase text-muted-foreground">Teor apurado</p>
        <p className="font-arcade mt-2 text-3xl text-whisky text-glow">{nota}</p>
        <p className="font-arcade mt-3 text-[11px] uppercase text-neon text-glow">{l.titulo}</p>
        <p className="mt-4 text-[13px] leading-relaxed text-foreground">{l.texto}</p>

        <div className="mt-5 grid grid-cols-2 gap-2 text-left">
          <div className="rounded-sm border border-neon/40 bg-background/60 p-2">
            <p className="font-arcade text-[7px] uppercase text-muted-foreground">Toques</p>
            <p className="font-arcade mt-1 text-sm text-neon">{toques}</p>
          </div>
          <div className="rounded-sm border border-purple/60 bg-background/60 p-2">
            <p className="font-arcade text-[7px] uppercase text-muted-foreground">Firmeza</p>
            <p className="font-arcade mt-1 text-sm text-whisky">{firmeza}%</p>
          </div>
        </div>

        {aviso ? <p className="font-arcade mt-3 text-[8px] text-neon">{aviso}</p> : null}

        <ArcadeButton onClick={iniciar} className="mt-6 w-full py-4 text-[10px] uppercase">
          Soprar de novo
        </ArcadeButton>
      </motion.div>
    );
  }

  return (
    <div className="text-center">
      {/* Mostrador do bafômetro */}
      <div className="relative mx-auto h-28 w-full max-w-[260px] overflow-hidden rounded-t-full border-2 border-b-0 border-neon/60 bg-background">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "conic-gradient(from 270deg at 50% 100%, var(--neon) 0deg, var(--whisky) 90deg, var(--destructive) 180deg, transparent 180deg)",
          }}
        />
        <motion.div
          animate={{ rotate: -90 + (agulha / 100) * 180 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="absolute bottom-0 left-1/2 h-24 w-1 origin-bottom -translate-x-1/2 bg-whisky shadow-[0_0_10px_var(--whisky)]"
        />
        <span className="absolute bottom-1 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-whisky bg-background" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <p className="font-arcade text-left text-[8px] uppercase text-muted-foreground">
          {(restante / 1000).toFixed(1)}s
        </p>
        <p className="font-arcade text-[8px] uppercase text-neon">{toques} toques</p>
        <p className="font-arcade text-right text-[8px] uppercase text-whisky">
          {combo > 2 ? `combo x${combo}` : ""}
        </p>
      </div>

      {fase === "pronto" ? (
        <>
          <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
            Dez segundos batendo na garrafa o mais rápido que der. Depois, três segundos segurando o
            dedo parado. Velocidade e firmeza fecham a nota.
          </p>
          <ArcadeButton onClick={iniciar} className="mt-5 w-full py-5 text-[10px] uppercase">
            <span className="inline-flex items-center gap-2">
              <Wind className="h-4 w-4" />
              Soprar no bafômetro
            </span>
          </ArcadeButton>
        </>
      ) : null}

      {fase === "soprando" ? (
        <motion.button
          onPointerDown={bater}
          whileTap={{ scale: 0.9 }}
          aria-label="Bater na garrafa"
          className="mt-4 grid h-44 w-full select-none place-items-center rounded-sm border-4 border-whisky bg-whisky/10 active:bg-whisky/25"
        >
          {/* Garrafa em pixel art, desenhada com divs */}
          <span aria-hidden className="grid gap-[3px]">
            <span className="mx-auto block h-3 w-3 bg-whisky" />
            <span className="mx-auto block h-2 w-5 bg-whisky" />
            <span className="mx-auto block h-12 w-10 bg-whisky" />
            <span className="mx-auto block h-3 w-10 bg-black" />
          </span>
          <span className="font-arcade mt-2 text-[9px] uppercase text-whisky">Bata aqui</span>
        </motion.button>
      ) : null}

      {fase === "intervalo" ? (
        <p className="font-arcade mt-10 text-[10px] uppercase leading-relaxed text-neon text-glow">
          Agora segure firme…
        </p>
      ) : null}

      {fase === "pulso" ? (
        <>
          <motion.button
            onPointerDown={() => (pressionado.current = true)}
            onPointerUp={() => (pressionado.current = false)}
            onPointerLeave={() => (pressionado.current = false)}
            aria-label="Segurar o dedo no alvo"
            className="mt-4 grid h-44 w-full select-none place-items-center rounded-sm border-4 border-neon bg-neon/5"
          >
            <motion.span
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="grid h-24 w-24 place-items-center rounded-full border-4 border-neon"
            >
              <span className="font-arcade text-[9px] uppercase text-neon">Segure</span>
            </motion.span>
          </motion.button>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-sm bg-input">
            <div
              className={`h-full transition-all ${firmeza > 60 ? "bg-neon" : "bg-destructive"}`}
              style={{ width: `${firmeza}%` }}
            />
          </div>
          <p className="font-arcade mt-2 text-[8px] uppercase text-muted-foreground">
            Firmeza {firmeza}% · {(restante / 1000).toFixed(1)}s
          </p>
        </>
      ) : null}
    </div>
  );
}
