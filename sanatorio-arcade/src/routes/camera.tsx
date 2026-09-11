import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Camera, FileWarning, ImagePlus, Loader2 } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { PixelAvatar } from "@/components/avatar/PixelAvatar";

import { supabase } from "@/integrations/supabase/client";
import { listarFotos, registrarFoto } from "@/lib/sanatorio.functions";
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
  const registrar = useServerFn(registrarFoto);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [autor, setAutor] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [legenda, setLegenda] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setAutor(lerProntuario()?.nome ?? null);
    setHydrated(true);
  }, []);

  const galeria = useQuery({ queryKey: ["fotos"], queryFn: () => carregar() });

  const envio = useMutation({
    mutationFn: async (file: File) => {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
      const path = `${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("galeria").upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
      if (up.error) throw up.error;
      await registrar({
        data: {
          path,
          autor: autor ?? "Anônimo",
          ...(legenda.trim() ? { legenda: legenda.trim() } : {}),
        },
      });
    },
    onSuccess: () => {
      setLegenda("");
      setErro(null);
      queryClient.invalidateQueries({ queryKey: ["fotos"] });
    },
    onError: () => setErro("Não deu para enviar a foto. Tente de novo."),
  });

  return (
    <section>
      <header className="rounded-sm border-2 border-neon/50 bg-card/50 p-4">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 shrink-0 text-neon" />
          <h1 className="font-arcade text-[10px] uppercase text-neon text-glow">
            Câmera de vigilância
          </h1>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          Registre as provas dos seus episódios. As fotos ficam guardadas na ala e todos os
          pacientes conseguem ver.
        </p>
      </header>

      {hydrated && !autor ? (
        <p className="mt-4 text-center text-[12px] text-muted-foreground">
          Passe pela{" "}
          <Link to="/" className="text-neon underline">
            triagem
          </Link>{" "}
          para enviar fotos.
        </p>
      ) : (
        <div className="mt-4 space-y-3 rounded-sm border-2 border-purple bg-card/40 p-4">
          <input
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            maxLength={140}
            placeholder="Legenda do episódio (opcional)"
            aria-label="Legenda da foto"
            className="tap-44 w-full rounded-sm border-2 border-neon/50 bg-background px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-neon"
          />
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
          <ArcadeButton
            onClick={() => inputRef.current?.click()}
            disabled={envio.isPending}
            className="flex w-full items-center justify-center gap-2 py-4 text-[9px] uppercase"
          >
            {envio.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
              </>
            ) : (
              <>
                <ImagePlus className="h-4 w-4" /> Tirar / escolher foto
              </>
            )}
          </ArcadeButton>
          {erro ? (
            <p role="alert" className="text-center text-[11px] text-destructive">
              {erro}
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
                    size="sm"
                    title={`Avatar de ${f.autor}`}
                  />
                  <span className="font-arcade truncate text-[8px] uppercase text-whisky">
                    {f.autor}
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
              </figcaption>
            </motion.figure>
          ))
        )}
      </div>
    </section>
  );
}
