import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Modo sítio: o dado guardado continua valendo por muito tempo e a
        // tela abre com ele na hora, em vez de piscar vazia esperando a rede.
        staleTime: 60_000,
        gcTime: 1000 * 60 * 60 * 24,
        // Uma tentativa e para. Cinco tentativas num sinal ruim só drenam
        // bateria e atrasam a tela; quem insiste depois é a fila.
        retry: 1,
        retryDelay: 3000,
        networkMode: "offlineFirst",
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
      },
      mutations: { networkMode: "offlineFirst", retry: 0 },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
