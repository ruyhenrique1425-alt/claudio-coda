import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Fingerprint, Lock, LogOut, Ticket } from "lucide-react";

import { ArcadeButton } from "./ArcadeButton";
import { ContagemRegressiva } from "./ContagemRegressiva";
import { altaLiberada, proximaAlta, ALTA_ABRE, ALTA_FECHA } from "@/lib/datas";
import { registrarAlta } from "@/lib/paciente-local";

const SEGURAR_MS = 2000;
const CUPOM = "ALTA333";

type Passo = "fechado" | "carimbo" | "diagnostico" | "cupom";

/**
 * A alta do hospício. Só abre entre 22h e 7h, porque ninguém recebe alta
 * às três da tarde. No lugar da assinatura vai o carimbo do polegar: a pessoa
 * segura o dedo por dois segundos e a digital cresce embaixo dele.
 */
export function AltaMedica({
  jaTemAlta,
  aoConcluir,
}: {
  jaTemAlta: boolean;
  aoConcluir: () => void;
}) {
  const [passo, setPasso] = useState<Passo>(jaTemAlta ? "cupom" : "fechado");
  const [progresso, setProgresso] = useState(0);
  // Os dois andam juntos: quando a janela abre, o horário-alvo também muda.
  // Guardar num estado só evita criar uma Date nova a cada render, o que
  // reiniciaria o contador sem parar.
  const [janela, setJanela] = useState(() => ({
    liberada: altaLiberada(),
    abertura: proximaAlta(),
  }));
  const { liberada, abertura } = janela;
  const segurando = useRef(false);
  const quadro = useRef<number | null>(null);

  // O relógio vira durante a festa: reavalia a janela de minuto em minuto.
  useEffect(() => {
    const id = setInterval(
      () => setJanela({ liberada: altaLiberada(), abertura: proximaAlta() }),
      30_000,
    );
    return () => clearInterval(id);
  }, []);

  useEffect(
    () => () => {
      if (quadro.current) cancelAnimationFrame(quadro.current);
    },
    [],
  );

  function comecarCarimbo() {
    segurando.current = true;
    const inicio = Date.now();

    const passoQuadro = () => {
      if (!segurando.current) {
        setProgresso(0);
        return;
      }
      const p = Math.min(1, (Date.now() - inicio) / SEGURAR_MS);
      setProgresso(p);
      if (p >= 1) {
        segurando.current = false;
        try {
          navigator.vibrate?.([40, 30, 90]);
        } catch {
          /* sem vibração */
        }
        setPasso("diagnostico");
        setTimeout(() => {
          registrarAlta();
          setPasso("cupom");
          aoConcluir();
        }, 2200);
        return;
      }
      quadro.current = requestAnimationFrame(passoQuadro);
    };

    quadro.current = requestAnimationFrame(passoQuadro);
  }

  function soltarCarimbo() {
    segurando.current = false;
    setProgresso(0);
  }

  if (passo === "fechado") {
    return liberada ? (
      <ArcadeButton
        tone="whisky"
        onClick={() => setPasso("carimbo")}
        className="mt-3 flex w-full animate-pulse items-center justify-center gap-2 border-destructive py-5 text-[10px] uppercase text-destructive"
      >
        <LogOut className="h-4 w-4" />
        Solicitar alta médica
      </ArcadeButton>
    ) : (
      <div className="mt-3 rounded-sm border-2 border-muted-foreground/40 bg-card/30 p-4 text-center">
        <Lock className="mx-auto h-5 w-5 text-muted-foreground" />
        <p className="font-arcade mt-3 text-[9px] uppercase leading-relaxed text-muted-foreground">
          Alta liberada a partir das {ALTA_ABRE}h
        </p>
        <ContagemRegressiva
          ate={abertura}
          rotulo="ABRE EM"
          className="mt-2 text-[11px]"
          aoZerar={() => setJanela({ liberada: altaLiberada(), abertura: proximaAlta() })}
        />
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          A ala de saída funciona das {ALTA_ABRE}h às {ALTA_FECHA}h. Antes disso, ninguém sai.
        </p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {passo === "carimbo" ? (
        <motion.div
          key="carimbo"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] grid place-items-center bg-black/95 px-5"
        >
          <div className="w-full max-w-sm rounded-sm border-2 border-foreground bg-foreground p-5 text-center text-black">
            <p className="font-arcade text-[9px] uppercase">Termo de alta</p>
            <p className="mt-3 text-[12px] leading-relaxed">
              Declaro que fui internado por vontade própria, que não me arrependo de nada e que
              qualquer coisa dita depois da meia-noite não pode ser usada contra mim.
            </p>

            <button
              onPointerDown={comecarCarimbo}
              onPointerUp={soltarCarimbo}
              onPointerLeave={soltarCarimbo}
              onPointerCancel={soltarCarimbo}
              aria-label="Segurar o polegar para carimbar"
              className="mt-5 grid h-44 w-full select-none place-items-center rounded-sm border-4 border-dashed border-black/40 bg-white"
            >
              <span className="relative grid place-items-center">
                <Fingerprint
                  className="h-24 w-24 text-black/15"
                  style={{ transform: `scale(${0.9 + progresso * 0.25})` }}
                />
                <motion.span
                  aria-hidden
                  className="absolute inset-0 overflow-hidden"
                  style={{ clipPath: `inset(${(1 - progresso) * 100}% 0 0 0)` }}
                >
                  <Fingerprint className="h-24 w-24 text-[oklch(0.45_0.2_302)]" />
                </motion.span>
              </span>
              <span className="font-arcade mt-3 text-[8px] uppercase text-black/60">
                {progresso > 0 ? "Segure…" : "Pressione o polegar por 2 segundos"}
              </span>
            </button>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-sm bg-black/10">
              <div
                className="h-full bg-[oklch(0.45_0.2_302)] transition-none"
                style={{ width: `${progresso * 100}%` }}
              />
            </div>

            <button
              onClick={() => setPasso("fechado")}
              className="font-arcade mt-4 text-[8px] uppercase text-black/50"
            >
              Ainda não quero sair
            </button>
          </div>
        </motion.div>
      ) : null}

      {passo === "diagnostico" ? (
        <motion.div
          key="diagnostico"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            backgroundColor: [
              "rgba(0,0,0,0.95)",
              "oklch(0.45 0.2 302 / 0.9)",
              "oklch(0.85 0.27 143 / 0.9)",
              "rgba(0,0,0,0.95)",
            ],
          }}
          transition={{ duration: 0.7, repeat: 2 }}
          className="fixed inset-0 z-[80] grid place-items-center px-6"
        >
          <p className="font-arcade text-center text-[13px] uppercase leading-relaxed text-neon text-glow">
            HAHAHA! Você acha mesmo que está curado? Leve essa camisa de força com você.
          </p>
        </motion.div>
      ) : null}

      {passo === "cupom" ? (
        <motion.div
          key="cupom"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3"
        >
          <div className="rounded-sm border-2 border-dashed border-whisky bg-whisky/10 p-5 text-center">
            <Ticket className="mx-auto h-7 w-7 text-whisky" />
            <p className="font-arcade mt-3 text-[8px] uppercase text-muted-foreground">
              Alta concedida · cupom do paciente
            </p>
            <motion.p
              animate={{ opacity: [1, 0.45, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="font-arcade mt-3 text-2xl text-whisky text-glow"
            >
              {CUPOM}
            </motion.p>
            <p className="mt-3 text-[13px] leading-relaxed text-foreground">
              R$ 3,33 de desconto na blusa da Sanatório.
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Mostre o print desta tela para resgatar. O navegador não deixa o app salvar a imagem
              sozinho, então tire o print agora, antes de fechar.
            </p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
