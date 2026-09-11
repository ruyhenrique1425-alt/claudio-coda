import { useCallback, useState } from "react";

import { credenciais } from "@/lib/paciente-local";
import { creditarJogo } from "@/lib/pontos";

/**
 * Credita pontos de um minigame e devolve o aviso para a tela mostrar.
 * O servidor tem teto por jogo e por hora, então quem tentar farmar a mesma
 * máquina a noite inteira recebe recusa em vez de pontos.
 */
export function usePontosDoJogo(jogo: string) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [creditando, setCreditando] = useState(false);

  const creditar = useCallback(
    async (pontos: number) => {
      if (pontos <= 0) return;
      if (!credenciais()) {
        setAviso("Faça sua ficha de admissão para valer fichas.");
        return;
      }

      setCreditando(true);
      try {
        await creditarJogo(pontos, jogo);
        setAviso(`+${pontos} fichas`);
      } catch (e) {
        setAviso(e instanceof Error ? e.message : "As fichas não entraram.");
      } finally {
        setCreditando(false);
      }
    },
    [jogo],
  );

  return { aviso, creditando, creditar, limparAviso: () => setAviso(null) };
}

/** Vibração curta onde o aparelho deixa. Ignorada em silêncio no iPhone. */
export function vibrar(padrao: number | number[]) {
  try {
    navigator.vibrate?.(padrao);
  } catch {
    /* aparelho sem vibração */
  }
}
