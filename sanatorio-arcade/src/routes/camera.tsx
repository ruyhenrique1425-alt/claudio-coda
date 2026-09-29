import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Camera, FileWarning, Loader2, VenetianMask } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { CartaoPixel } from "@/components/CartaoPixel";
import { BotaoReagir } from "@/components/BotaoReagir";
import { PixelAvatar } from "@/components/avatar/PixelAvatar";
import { comprimir } from "@/lib/imagem";
import { enfileirar } from "@/lib/fila";

import { supabase } from "@/integrations/supabase/client";
import { listarFotos } from "@/lib/sanatorio.functions";
import { lerProntuario } from "@/lib/paciente-local";

export const Route = createFileRoute("/camera")({
  head: () => ({
    meta: [
      { title: "Câmera do Sanatório — registros da ala" },
      {
        name: "description",
        content:
          "Registre e compartilhe os episódios da noite na galeria de vigilância do Sanatório.",
      },
      { property: "og:title", content: "Câmera do Sanatório" },
      { property: "og:description", content: "Registros visuais da ala de festas." },
    ],
  }),
  component: CameraPage,
});

function CameraPage() {
  const carregar = useServerFn(listarFotos);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [autor, setAutor] = useState<string | null>(null);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [legenda, setLegenda] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [naFila, setNaFila] = useState(false);

  useEffect(() => {
    const p = lerProntuario();
    setAutor(p?.nome ?? null);
    setPacienteId(p?.pacienteId ?? null);
    setHydrated(true);
  }, []);

  const galeria = useQuery({
    queryKey: ["fotos", pacienteId],
    queryFn: () => carregar({ data: { pacienteId: pacienteId ?? undefined } }),
    enabled: hydrated,
  });

  const envio = useMutation({
    mutationFn: async (file: File) => {
      // Comprime antes de tudo: é o que decide se a foto sobe ou não no sítio.
      const comprimida = await comprimir(file);
      const path = `${crypto.randomUUID()}.jpg`;

      // Vai para a fila. Com sinal sobe agora; sem sinal fica guardada no
      // aparelho e sobe sozinha depois, sem o paciente precisar lembrar.
      return enfileirar("foto", {
        arquivo: comprimida,
        path,
        autor: autor ?? "Anônimo",
        legenda: legenda.trim() || null,
      });
    },
    onSuccess: (subiu) => {
      setLegenda("");
      setErro(null);
      setNaFila(!subiu);
      queryClient.invalidateQueries({ queryKey: ["fotos"] });
    },
    onError: () => setErro("Não deu para preparar a foto. Tente de novo."),
  });

  return (
    <section>
      <CartaoPixel tom="neon">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 shrink-0 text-neon" />
          <h1 className="font-arcade text-[10px] uppercase text-neon text-glow">
            Câmera de vigilância
          </h1>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          Toda foto aparece na hora, pra galera toda ver. Depois de uma hora quem tirou vira
          mistério até o dia seguinte — a foto continua no mural, só some o nome.
        </p>
      </CartaoPixel>

      {hydrated && !autor ? (
        <p className="mt-4 text-center text-[12px] text-muted-foreground">
          Passe pela{" "}
          <Link to="/" className="text-neon underline">
            triagem
          </Link>{" "}
          para enviar fotos.
        </p>
      ) : (
        <div className="mt-4">
          {/* Visor de câmera de vigilância: moldura escura, cantos de mira e
              o "REC" piscando — pra ficar óbvio que isso aqui é uma câmera,
              não um formulário de anexo. */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm border-2 border-neon/70 bg-black">
            <div aria-hidden className="crt-scanlines absolute inset-0 opacity-40" />
            <div
              aria-hidden
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  "repeating-conic-gradient(color-mix(in oklab, var(--neon) 45%, black) 0% 25%, black 0% 50%)",
                backgroundSize: "10px 10px",
                filter: "blur(2px)",
              }}
            />

            {/* Cantos de mira, um em cada quina. */}
            {(
              ["top-2 left-2", "top-2 right-2", "bottom-2 left-2", "bottom-2 right-2"] as const
            ).map((pos) => (
              <span
                key={pos}
                aria-hidden
                className={`absolute ${pos} h-5 w-5 border-neon ${
                  pos.includes("top") ? "border-t-2" : "border-b-2"
                } ${pos.includes("left") ? "border-l-2" : "border-r-2"}`}
              />
            ))}

            <span className="absolute left-3 top-3 flex items-center gap-1.5">
              <motion.span
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="h-2 w-2 rounded-full bg-destructive shadow-[0_0_8px_var(--destructive)]"
              />
              <span className="font-arcade text-[8px] uppercase text-destructive">Rec</span>
            </span>

            <div className="absolute inset-0 grid place-items-center">
              <motion.button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={envio.isPending}
                whileTap={{ scale: 0.92 }}
                aria-label="Tirar ou escolher foto"
                className="tap-44 grid h-20 w-20 place-items-center rounded-full border-4 border-neon bg-neon/10 text-neon shadow-[0_0_24px_-4px_var(--neon)] disabled:opacity-50"
              >
                {envio.isPending ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <Camera className="h-8 w-8" />
                )}
              </motion.button>
            </div>

            <p className="font-arcade absolute bottom-2 left-1/2 -translate-x-1/2 text-[7px] uppercase tracking-widest text-neon/80">
              {envio.isPending ? "Enviando…" : "Toque para fotografar"}
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) envio.mutate(file);
            }}
          />

          <input
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            maxLength={140}
            placeholder="Legenda do episódio (opcional)"
            aria-label="Legenda da foto"
            className="tap-44 mt-3 w-full rounded-sm border-2 border-neon/50 bg-background px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-neon"
          />

          {erro ? (
            <p role="alert" className="mt-2 text-center text-[11px] text-destructive">
              {erro}
            </p>
          ) : null}
          {naFila ? (
            <p className="mt-2 text-center text-[11px] text-whisky">
              Foto guardada no aparelho. Sobe sozinha quando pegar sinal.
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {galeria.isPending ? (
          <p className="font-arcade py-8 text-center text-[8px] uppercase text-muted-foreground">
            Revelando fotos…
          </p>
        ) : galeria.isError ? (
          <div className="rounded-sm border border-destructive bg-destructive/10 p-4 text-center">
            <FileWarning className="mx-auto h-6 w-6 text-destructive" />
            <p className="mt-2 text-[12px] text-foreground">Não foi possível abrir a galeria.</p>
            <ArcadeButton
              tone="whisky"
              onClick={() => galeria.refetch()}
              className="mt-3 px-4 py-2 text-[8px] uppercase"
            >
              Tentar de novo
            </ArcadeButton>
          </div>
        ) : galeria.data.length === 0 ? (
          <p className="font-arcade py-8 text-center text-[8px] uppercase leading-loose text-muted-foreground">
            Nenhum registro
            <br />
            visual ainda
          </p>
        ) : (
          galeria.data.map((f, i) => (
            <motion.figure
              key={f.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i, 6) * 0.03 }}
              className="overflow-hidden rounded-sm border border-neon/25 bg-card/40"
            >
              {f.url ? (
                <img
                  src={f.url}
                  alt={f.legenda ?? `Registro de ${f.autor}`}
                  loading="lazy"
                  className="w-full object-cover"
                />
              ) : null}
              <figcaption className="p-3">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                  <PixelAvatar
                    personagem={f.personagem}
                    avatar={f.avatar}
                    itens={f.itens}
                    size="sm"
                    title={`Avatar de ${f.autor}`}
                  />
                  <span className="font-arcade flex min-w-0 items-center gap-1.5 truncate text-[8px] uppercase text-whisky">
                    {f.anonimo ? <VenetianMask className="h-3 w-3 shrink-0" aria-hidden /> : null}
                    <span className="truncate">{f.autor}</span>
                  </span>
                  <time className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(f.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>

                {f.legenda ? (
                  <p className="mt-2 break-words text-[13px] leading-relaxed text-foreground">
                    {f.legenda}
                  </p>
                ) : null}

                <div className="mt-2 flex justify-end">
                  <BotaoReagir
                    tipo="foto"
                    itemId={f.id}
                    contagemInicial={f.reacoes}
                    reagidoInicial={f.reagido}
                    podeReagir={Boolean(pacienteId)}
                  />
                </div>
              </figcaption>
            </motion.figure>
          ))
        )}
      </div>
    </section>
  );
}
