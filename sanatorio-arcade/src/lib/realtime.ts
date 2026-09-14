import type { RealtimeChannel } from "@supabase/supabase-js";

import { ouvirRede, realtimeVale } from "@/lib/rede";

/**
 * Realtime só quando o sinal aguenta.
 *
 * Websocket em 2G não entrega e ainda fica tentando reconectar, o que come
 * bateria numa festa que vai até o sol raiar. Com sinal fraco o app desliga o
 * canal e cai numa consulta espaçada; quando o sinal melhora, religa sozinho.
 */
export function canalQuandoDerVerifica(
  abrir: () => RealtimeChannel,
  fechar: (canal: RealtimeChannel) => void,
  aoConsultar: () => void,
  intervaloFraco = 60_000,
): () => void {
  let canal: RealtimeChannel | null = null;
  let pesquisa: ReturnType<typeof setInterval> | null = null;

  const parar = () => {
    if (canal) {
      fechar(canal);
      canal = null;
    }
    if (pesquisa) {
      clearInterval(pesquisa);
      pesquisa = null;
    }
  };

  const ajustar = () => {
    if (realtimeVale()) {
      if (canal) return;
      if (pesquisa) {
        clearInterval(pesquisa);
        pesquisa = null;
      }
      try {
        canal = abrir();
      } catch {
        // Canal recusado (nome repetido, socket caindo): cai para consulta em
        // vez de derrubar a tela inteira.
        canal = null;
        if (!pesquisa) pesquisa = setInterval(aoConsultar, intervaloFraco);
      }
      return;
    }

    // Sinal fraco ou nenhum: fecha o socket e consulta de vez em quando.
    if (canal) {
      fechar(canal);
      canal = null;
    }
    if (!pesquisa) {
      pesquisa = setInterval(() => {
        if (navigator.onLine) aoConsultar();
      }, intervaloFraco);
    }
  };

  ajustar();
  const pararRede = ouvirRede(ajustar);

  return () => {
    pararRede();
    parar();
  };
}

/** Intervalo de recarga que respeita o sinal. false = não recarrega sozinho. */
export function intervaloConsciente(bom: number, fraco: number): number | false {
  if (typeof navigator === "undefined") return false;
  if (!navigator.onLine) return false;
  return realtimeVale() ? bom : fraco;
}
