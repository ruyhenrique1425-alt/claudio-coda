import { useEffect } from "react";

import { manterFilaViva } from "@/lib/fila";
import { persistir, restaurar } from "@/lib/cache-consultas";
import { Route } from "@/routes/__root";

/**
 * Liga o modo sítio: restaura o cache de leitura, mantém a fila subindo e
 * registra o service worker. Não desenha nada.
 */
export function ModoSitio() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    void restaurar(queryClient);
    const pararPersistencia = persistir(queryClient);
    const pararFila = manterFilaViva();

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then(() => {
          // Conta ao service worker quais arquivos este carregamento usou,
          // para eles entrarem no casco. Os nomes têm hash do build, então
          // não dá para listá-los à mão no sw.js.
          const usados = performance
            .getEntriesByType("resource")
            .map((r) => r.name)
            .filter((url) => url.startsWith(location.origin))
            .filter((url) => /\.(js|css|woff2|png|ico|webmanifest)(\?|$)/.test(url));

          navigator.serviceWorker.controller?.postMessage({
            tipo: "guardar-casco",
            urls: [...new Set(usados)],
          });
        })
        .catch(() => undefined);
    }

    return () => {
      pararPersistencia();
      pararFila();
    };
  }, [queryClient]);

  return null;
}
