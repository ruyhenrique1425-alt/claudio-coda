import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { ouvirAvisos, pendencias, type Aviso } from "@/lib/avisos";
import { responderPrenda, responderDesafio } from "@/lib/pontos";

const ICONES: Record<Aviso["tipo"], string> = {
  curtida: "♥",
  match: "★",
  prenda: "🍺",
  desafio: "⚔",
};

export function SinoAvisos({ pacienteId }: { pacienteId: string }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [aberto, setAberto] = useState(false);
  const [match, setMatch] = useState<Aviso | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const adicionar = useCallback((aviso: Aviso) => {
    setAvisos((atuais) => [aviso, ...atuais.filter((a) => a.id !== aviso.id)].slice(0, 20));
    if (aviso.tipo === "match") setMatch(aviso);
  }, []);

  useEffect(() => {
    void pendencias(pacienteId)
      .then(setAvisos)
      .catch(() => undefined);
    return ouvirAvisos({ pacienteId }, adicionar);
  }, [pacienteId, adicionar]);

  const naoLidos = avisos.filter((a) => !a.lido).length;

  function marcarLido(id: string) {
    setAvisos((atuais) => atuais.map((a) => (a.id === id ? { ...a, lido: true } : a)));
  }

  async function responder(aviso: Aviso, sim: boolean) {
    setErro(null);
    try {
      if (aviso.tipo === "prenda" && aviso.referencia) {
        await responderPrenda(aviso.referencia, sim);
      } else if (aviso.tipo === "desafio" && aviso.referencia) {
        await responderDesafio(aviso.referencia, sim);
      }
      setAvisos((atuais) => atuais.filter((a) => a.id !== aviso.id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu certo.");
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setAberto((v) => !v);
          avisos.forEach((a) => marcarLido(a.id));
        }}
        aria-label={`Avisos${naoLidos ? `, ${naoLidos} novo(s)` : ""}`}
        className="tap-44 relative grid h-11 w-11 shrink-0 place-items-center text-neon"
      >
        <Bell className="h-5 w-5" />
        {naoLidos > 0 ? (
          <span className="font-arcade absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[7px] text-foreground">
            {naoLidos}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {aberto ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute right-2 top-[68px] z-50 w-[min(20rem,calc(100vw-1rem))] rounded-sm border-2 border-neon bg-background/98 p-3 backdrop-blur"
          >
            <p className="font-arcade text-[8px] uppercase text-neon">Avisos da ala</p>

            {avisos.length === 0 ? (
              <p className="mt-3 text-[12px] text-muted-foreground">
                Nada por enquanto. Vá jogar alguma coisa.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {avisos.map((a) => (
                  <li key={a.id} className="rounded-sm border border-purple/60 bg-card/50 p-2">
                    <p className="text-[11px] leading-snug text-foreground">
                      <span aria-hidden className="mr-1">
                        {ICONES[a.tipo]}
                      </span>
                      {a.texto}
                    </p>
                    {a.tipo === "prenda" || a.tipo === "desafio" ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => void responder(a, true)}
                          className="font-arcade tap-44 rounded-sm border border-neon py-2 text-[8px] uppercase text-neon"
                        >
                          {a.tipo === "prenda" ? "Cumpri" : "Aceito"}
                        </button>
                        <button
                          onClick={() => void responder(a, false)}
                          className="font-arcade tap-44 rounded-sm border border-muted-foreground py-2 text-[8px] uppercase text-muted-foreground"
                        >
                          {a.tipo === "prenda" ? "Passo" : "Recuso"}
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {erro ? <p className="mt-2 text-[11px] text-destructive">{erro}</p> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {match ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] grid place-items-center bg-black/95 px-6"
            onClick={() => setMatch(null)}
          >
            <motion.div
              animate={{
                boxShadow: ["0 0 0px var(--neon)", "0 0 40px var(--purple)", "0 0 0px var(--neon)"],
              }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="w-full max-w-sm rounded-sm border-2 border-neon bg-card/80 p-6 text-center"
            >
              <p className="font-arcade text-[12px] uppercase leading-relaxed text-neon text-glow">
                {match.texto}
              </p>
              <p className="mt-4 text-[13px] leading-relaxed text-whisky">
                Tratamento prescrito: uma dose no bar, juntos. Agora.
              </p>
              <p className="mt-4 text-[11px] text-muted-foreground">Toque para fechar</p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
