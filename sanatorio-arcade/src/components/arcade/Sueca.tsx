import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Layers, Plus, RotateCcw, Trash2 } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { usePontosDoJogo, vibrar } from "./usePontosDoJogo";
import { montarMonte, naipeDe, REGRAS, type Carta, type Regra } from "./sueca";

/**
 * Sueca Bêbada.
 *
 * Um celular no meio da mesa faz o papel do monte: toca, vira a carta, todo
 * mundo lê a regra. Roda inteira sem sinal — nada aqui fala com o servidor,
 * o que também resolve a mesa montada no fundo do sítio.
 */

const CORES_EFEITO: Record<Regra["efeito"], string> = {
  beber: "border-destructive text-destructive",
  brincadeira: "border-neon text-neon",
  guardar: "border-whisky text-whisky",
  regra: "border-purple text-foreground",
};

const ROTULO_EFEITO: Record<Regra["efeito"], string> = {
  beber: "Alguém bebe",
  brincadeira: "Brincadeira de roda",
  guardar: "Guarde a carta",
  regra: "Vale a noite toda",
};

export function Sueca() {
  const [monte, setMonte] = useState<Carta[]>(() => montarMonte());
  const [atual, setAtual] = useState<Carta | null>(null);
  const [virando, setVirando] = useState(false);
  const [guardadas, setGuardadas] = useState<Carta[]>([]);
  const [regrasAtivas, setRegrasAtivas] = useState<string[]>([]);
  const [rascunho, setRascunho] = useState("");
  const { aviso, creditar } = usePontosDoJogo("sueca");

  const regra = atual ? REGRAS[atual.valor] : null;
  const restantes = monte.length;
  const acabou = restantes === 0 && atual !== null;

  function virar() {
    if (virando || restantes === 0) return;
    setVirando(true);
    vibrar(18);

    // Meio segundo de suspense: é o tempo da mesa parar e olhar.
    setTimeout(() => {
      const [carta, ...resto] = monte;
      setMonte(resto);
      setAtual(carta!);
      setVirando(false);
      vibrar([25, 20, 25]);
      void creditar(3);
    }, 500);
  }

  function guardarCarta() {
    if (!atual) return;
    setGuardadas((g) => [...g, atual]);
    setAtual(null);
  }

  function usarGuardada(carta: Carta) {
    setGuardadas((g) => g.filter((c) => c.id !== carta.id));
    vibrar([40, 30, 40]);
  }

  function fixarRegra() {
    const texto = rascunho.trim();
    if (!texto) return;
    // O oito substitui a regra anterior, como manda a mesa.
    setRegrasAtivas([texto]);
    setRascunho("");
  }

  function reembaralhar() {
    setMonte(montarMonte());
    setAtual(null);
    setGuardadas([]);
    setRegrasAtivas([]);
    setRascunho("");
  }

  const progresso = useMemo(() => Math.round(((104 - restantes) / 104) * 100), [restantes]);

  return (
    <div>
      {/* Monte e carta virada */}
      <div className="grid grid-cols-2 items-center gap-3">
        <p className="font-arcade text-[8px] uppercase text-muted-foreground">
          <Layers className="mr-1 inline h-3 w-3" aria-hidden />
          {restantes} cartas
        </p>
        <p className="font-arcade text-right text-[8px] uppercase text-whisky">
          {progresso}% virado
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-input">
        <div className="h-full bg-whisky transition-all" style={{ width: `${progresso}%` }} />
      </div>

      <div className="mt-4 grid min-h-[210px] place-items-center">
        <AnimatePresence mode="wait">
          {virando ? (
            <motion.div
              key="virando"
              initial={{ rotateY: 0 }}
              animate={{ rotateY: 180 }}
              transition={{ duration: 0.45 }}
              className="grid h-[190px] w-[132px] place-items-center rounded-sm border-4 border-purple bg-purple/25"
            >
              <span className="font-arcade text-[9px] uppercase text-neon">?</span>
            </motion.div>
          ) : atual && regra ? (
            <motion.div
              key={atual.id}
              initial={{ opacity: 0, scale: 0.85, rotateY: -90 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="w-full"
            >
              <div className="mx-auto grid h-[190px] w-[132px] grid-rows-[auto_1fr_auto] rounded-sm border-4 border-foreground bg-foreground p-2 text-black">
                <span
                  className={`font-arcade text-left text-[13px] ${
                    naipeDe(atual.naipe).vermelho ? "text-[#c0272d]" : "text-black"
                  }`}
                >
                  {atual.valor}
                </span>
                <span
                  className={`grid place-items-center text-5xl ${
                    naipeDe(atual.naipe).vermelho ? "text-[#c0272d]" : "text-black"
                  }`}
                  aria-hidden
                >
                  {naipeDe(atual.naipe).simbolo}
                </span>
                <span
                  className={`font-arcade rotate-180 text-left text-[13px] ${
                    naipeDe(atual.naipe).vermelho ? "text-[#c0272d]" : "text-black"
                  }`}
                >
                  {atual.valor}
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="fechado"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid h-[190px] w-[132px] place-items-center rounded-sm border-4 border-purple bg-[repeating-linear-gradient(45deg,color-mix(in_oklab,var(--purple)_45%,black)_0_8px,black_8px_16px)]"
            >
              <span className="font-arcade text-[8px] uppercase leading-relaxed text-neon">
                Sueca
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Regra da carta virada */}
      {atual && regra && !virando ? (
        <motion.div
          key={"regra-" + atual.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-4 rounded-sm border-2 bg-card/60 p-4 ${CORES_EFEITO[regra.efeito]}`}
        >
          <p className="font-arcade text-[7px] uppercase text-muted-foreground">
            {ROTULO_EFEITO[regra.efeito]}
          </p>
          <p className="font-arcade mt-2 text-[11px] uppercase leading-relaxed">{regra.titulo}</p>
          <p className="mt-3 text-[13px] leading-relaxed text-foreground">{regra.comoJoga}</p>
          {regra.exemplo ? (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {regra.exemplo}
            </p>
          ) : null}

          {regra.efeito === "guardar" ? (
            <ArcadeButton
              tone="whisky"
              onClick={guardarCarta}
              className="mt-4 w-full py-3 text-[9px] uppercase"
            >
              Guardar esta carta
            </ArcadeButton>
          ) : null}

          {regra.efeito === "regra" ? (
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <label className="sr-only" htmlFor="regra-geral">
                Regra geral da mesa
              </label>
              <input
                id="regra-geral"
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                maxLength={80}
                placeholder="Digite a regra da mesa"
                className="tap-44 min-w-0 rounded-sm border-2 border-purple bg-background px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-neon"
              />
              <ArcadeButton
                onClick={fixarRegra}
                disabled={!rascunho.trim()}
                aria-label="Fixar regra"
                className="grid h-11 w-12 place-items-center"
              >
                <Plus className="h-4 w-4" />
              </ArcadeButton>
            </div>
          ) : null}

          {aviso ? <p className="font-arcade mt-3 text-[7px] text-neon">{aviso}</p> : null}
        </motion.div>
      ) : null}

      {acabou ? (
        <p className="mt-4 rounded-sm border-2 border-whisky bg-whisky/10 p-4 text-center text-[13px] leading-relaxed text-whisky">
          Acabaram as 104 cartas. Se ainda tem alguém de pé, embaralhe de novo.
        </p>
      ) : null}

      <ArcadeButton
        onClick={virar}
        disabled={virando || restantes === 0}
        className="mt-4 w-full py-5 text-[11px] uppercase"
      >
        {virando ? "Virando…" : atual ? "Próxima carta" : "Virar a primeira"}
      </ArcadeButton>

      {/* Cartas guardadas (6 e 9) */}
      {guardadas.length > 0 ? (
        <div className="mt-5 rounded-sm border-2 border-whisky/60 bg-card/40 p-3">
          <p className="font-arcade text-[7px] uppercase text-muted-foreground">
            Na sua mão · use quando quiser
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {guardadas.map((c) => (
              <button
                key={c.id}
                onClick={() => usarGuardada(c)}
                className="font-arcade rounded-sm border-2 border-whisky bg-background px-3 py-3 text-[10px] text-whisky"
              >
                {c.valor}
                <span
                  className={naipeDe(c.naipe).vermelho ? "ml-1 text-destructive" : "ml-1"}
                  aria-hidden
                >
                  {naipeDe(c.naipe).simbolo}
                </span>
                <span className="mt-1 block text-[6px] uppercase text-muted-foreground">
                  {REGRAS[c.valor].titulo}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Toque na carta depois de fazer o gesto, para tirá-la da mão.
          </p>
        </div>
      ) : null}

      {/* Regra geral em vigor */}
      {regrasAtivas.length > 0 ? (
        <div className="mt-4 rounded-sm border-2 border-purple bg-purple/15 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-arcade text-[7px] uppercase text-muted-foreground">
                Regra em vigor
              </p>
              {regrasAtivas.map((r) => (
                <p key={r} className="mt-2 break-words text-[13px] leading-relaxed text-foreground">
                  {r}
                </p>
              ))}
            </div>
            <button
              onClick={() => setRegrasAtivas([])}
              aria-label="Cancelar a regra em vigor"
              className="tap-44 grid h-9 w-9 shrink-0 place-items-center text-muted-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <button
        onClick={reembaralhar}
        className="font-arcade mt-5 flex w-full items-center justify-center gap-2 py-3 text-[8px] uppercase text-muted-foreground underline underline-offset-4"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Embaralhar de novo
      </button>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
        Regra da casa: ninguém sai da roda no meio do jogo. Nem para o banheiro.
      </p>
    </div>
  );
}
