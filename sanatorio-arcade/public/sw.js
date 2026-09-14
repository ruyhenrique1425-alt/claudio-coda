/**
 * Service worker do modo sítio.
 *
 * A festa é longe da cidade e o sinal vai e volta. As estratégias aqui partem
 * dessa premissa:
 *
 *   - o casco do app (HTML, JS, CSS, fontes, ícones) vem do cache primeiro e
 *     só é revalidado em segundo plano, então o app abre instantâneo e abre
 *     mesmo sem sinal;
 *   - nada do Supabase entra em cache: pontos e recados velhos confundem mais
 *     do que ajudam, e o cache de leitura fica no IndexedDB, onde o app sabe
 *     dizer de quando é;
 *   - requisição de rede tem prazo. Sem isso, uma antena que aceita a conexão
 *     e não responde deixa a tela pendurada por meio minuto.
 */
const VERSAO = "sanatorio-v2";
const CASCO = VERSAO + "-casco";

// O que precisa estar no aparelho antes de sair o sinal.
const ESSENCIAIS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icone-192.png",
  "/icone-512.png",
  "/fontes/press-start-2p-latin.woff2",
  "/fontes/press-start-2p-latin-ext.woff2",
  "/fontes/inter-latin.woff2",
  "/fontes/inter-latin-ext.woff2",
];

const PRAZO_REDE = 8000;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CASCO)
      // addAll falha inteiro se um item falhar; um a um é mais teimoso.
      .then((cache) => Promise.allSettled(ESSENCIAIS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(chaves.filter((c) => !c.startsWith(VERSAO)).map((c) => caches.delete(c))),
      )
      .then(() => self.clients.claim()),
  );
});

function comPrazo(promessa, ms) {
  return Promise.race([
    promessa,
    new Promise((_, rejeita) => setTimeout(() => rejeita(new Error("prazo")), ms)),
  ]);
}

/** Guarda a cópia sem segurar a resposta que o app está esperando. */
function guardar(req, resposta) {
  if (!resposta || !resposta.ok || resposta.type === "opaque") return;
  const copia = resposta.clone();
  void caches.open(CASCO).then((cache) => cache.put(req, copia));
}

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Chamadas de servidor e Supabase: rede ou erro, nunca cache. Quem decide o
  // que fazer sem sinal é o app, que tem a fila e o cache de leitura.
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api")) return;

  // Navegação.
  //
  // Rede primeiro, com prazo curto, e cada rota guardada sob a própria URL.
  // Entregar sempre a casca da "/" seria mais rápido, mas o HTML da home numa
  // URL de /arcade faz o React jogar fora a página inteira e desenhar de novo
  // do zero — o oposto do que se quer num aparelho fraco.
  //
  // Sem sinal, nem tenta a rede: vai direto para a cópia daquela rota e, se
  // não houver, para a casca da "/", que o roteador conserta no cliente.
  if (req.mode === "navigate") {
    evento.respondWith(
      (async () => {
        if (navigator.onLine) {
          try {
            const resposta = await comPrazo(fetch(req), PRAZO_REDE);
            guardar(req, resposta);
            return resposta;
          } catch {
            /* sem resposta a tempo: cai para o que está guardado */
          }
        }

        return (
          (await caches.match(req)) ||
          (await caches.match("/")) ||
          new Response("", { status: 504, statusText: "Sem sinal e sem cópia guardada." })
        );
      })(),
    );
    return;
  }

  // Assets: cache primeiro. São versionados no nome, então cache velho não
  // existe — ou o arquivo está lá, ou é outro arquivo.
  evento.respondWith(
    caches.match(req).then((guardado) => {
      if (guardado) {
        // Revalida em segundo plano, sem fazer ninguém esperar.
        void comPrazo(fetch(req), PRAZO_REDE)
          .then((resposta) => guardar(req, resposta))
          .catch(() => undefined);
        return guardado;
      }

      return comPrazo(fetch(req), PRAZO_REDE)
        .then((resposta) => {
          guardar(req, resposta);
          return resposta;
        })
        .catch(
          () => new Response("", { status: 504, statusText: "Sem sinal e sem cópia guardada." }),
        );
    }),
  );
});

/**
 * O app avisa quais arquivos ele realmente usou para carregar, e eles entram
 * no casco. É o jeito de garantir o arranque offline sem precisar adivinhar os
 * nomes com hash que o build gera.
 */
self.addEventListener("message", (evento) => {
  const msg = evento.data;

  if (msg === "pular-espera") {
    self.skipWaiting();
    return;
  }

  if (msg && msg.tipo === "guardar-casco" && Array.isArray(msg.urls)) {
    evento.waitUntil(
      caches.open(CASCO).then(async (cache) => {
        const jaTem = await cache.keys();
        const conhecidas = new Set(jaTem.map((r) => new URL(r.url).pathname));
        const faltando = msg.urls.filter(
          (u) => !conhecidas.has(new URL(u, self.location.origin).pathname),
        );
        // Uma a uma: se um arquivo falhar, os outros ainda entram.
        await Promise.allSettled(faltando.map((u) => cache.add(u)));
      }),
    );
  }
});
