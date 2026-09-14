import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, SignalLow } from "lucide-react";

import { contar, descarregar, ouvirFila } from "@/lib/fila";
import { ouvirRede, qualidade, type Qualidade } from "@/lib/rede";

/**
 * Faixa de estado da conexão.
 *
 * Some quando está tudo certo: com sinal bom e nada na fila, não há o que
 * avisar. Aparece quando o paciente precisa saber que o que ele fez está
 * guardado — e não perdido.
 */
export function StatusRede() {
  // O servidor não tem navigator: se ele chutasse um estado de rede, o
  // resultado seria diferente do celular e a hidratação quebraria. Então o
  // componente não desenha nada até montar no aparelho.
  const [montado, setMontado] = useState(false);
  const [rede, setRede] = useState<Qualidade>("boa");
  const [fila, setFila] = useState(0);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setMontado(true);
    setRede(qualidade());
    void contar().then(setFila);
    const pararRede = ouvirRede(setRede);
    const pararFila = ouvirFila(setFila);
    return () => {
      pararRede();
      pararFila();
    };
  }, []);

  if (!montado) return null;
  if (rede === "boa" && fila === 0) return null;

  const semSinal = rede === "sem-sinal";

  async function tentarAgora() {
    setEnviando(true);
    try {
      await descarregar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      role="status"
      className={`mx-auto flex max-w-md items-center gap-2 px-4 py-2 ${
        semSinal
          ? "bg-destructive/20 text-destructive"
          : fila > 0
            ? "bg-whisky/15 text-whisky"
            : "bg-purple/25 text-foreground"
      }`}
    >
      {semSinal ? (
        <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <SignalLow className="h-4 w-4 shrink-0" aria-hidden />
      )}

      <span className="font-arcade min-w-0 flex-1 text-[7px] uppercase leading-relaxed">
        {semSinal
          ? fila > 0
            ? `Sem sinal · ${fila} coisa(s) guardada(s)`
            : "Sem sinal · o arcade continua valendo"
          : fila > 0
            ? `Sinal fraco · enviando ${fila}`
            : "Sinal fraco · modo econômico"}
      </span>

      {fila > 0 && !semSinal ? (
        <button
          onClick={() => void tentarAgora()}
          disabled={enviando}
          aria-label="Tentar enviar agora"
          className="tap-44 grid h-8 w-8 shrink-0 place-items-center"
        >
          <RefreshCw className={`h-4 w-4 ${enviando ? "animate-spin" : ""}`} />
        </button>
      ) : null}
    </div>
  );
}
