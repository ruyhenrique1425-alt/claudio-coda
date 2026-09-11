// Service worker mínimo: existe para o Android oferecer a instalação e para o
// app abrir mesmo com a internet da festa oscilando. Não guarda dado nenhum
// de paciente em cache.
const CACHE = "sanatorio-v1";
const ESSENCIAIS = ["/", "/manifest.webmanifest", "/favicon.ico"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ESSENCIAIS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Nada do Supabase passa pelo cache: pontos e recados têm que vir frescos.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_serverFn")) return;

  evento.respondWith(
    fetch(req)
      .then((resposta) => {
        const copia = resposta.clone();
        void caches.open(CACHE).then((cache) => cache.put(req, copia));
        return resposta;
      })
      .catch(() => caches.match(req).then((c) => c ?? caches.match("/"))),
  );
});
