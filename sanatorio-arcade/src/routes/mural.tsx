import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { FileWarning, Loader2, Send } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { PixelAvatar } from "@/components/avatar/PixelAvatar";
import { Moldura, NomeDoPaciente } from "@/components/Moldura";
import { RecadoEmbargado } from "@/components/RegistroEmbargado";
import { ContagemRegressiva } from "@/components/ContagemRegressiva";
import { REVELACAO, jaRevelou } from "@/lib/datas";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listarMural, postarNoMural, MORADORES, type Morador } from "@/lib/sanatorio.functions";
import { lerProntuario } from "@/lib/paciente-local";

export const Route = createFileRoute("/mural")({
  head: () => ({
    meta: [
      { title: "Mural do Sanatório — recados dos internos" },
      {
        name: "description",
        content:
          "Arquivos confidenciais de Camarão, Recruta e Canela: deixe seu recado no mural da festa Sanatório.",
      },
      { property: "og:title", content: "Mural do Sanatório" },
      { property: "og:description", content: "Recados confidenciais dos pacientes internados." },
    ],
  }),
  component: MuralPage,
});

const FICHAS: Record<Morador, { codigo: string; diagnostico: string }> = {
  Camarão: { codigo: "PRT-001", diagnostico: "Alergia a horário marcado" },
  Recruta: { codigo: "PRT-002", diagnostico: "Disciplina em fase terminal" },
  Canela: { codigo: "PRT-003", diagnostico: "Hiperatividade noturna crônica" },
};

function MuralPage() {
  const [aba, setAba] = useState<Morador>("Camarão");
  const [autor, setAutor] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAutor(lerProntuario()?.nome ?? null);
    setHydrated(true);
  }, []);

  return (
    <section>
      <Tabs value={aba} onValueChange={(v) => setAba(v as Morador)}>
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-sm border-2 border-purple bg-card/50 p-1">
          {MORADORES.map((m) => (
            <TabsTrigger
              key={m}
              value={m}
              className="font-arcade rounded-sm px-1 py-3 text-[8px] uppercase text-muted-foreground data-[state=active]:bg-purple/40 data-[state=active]:text-neon"
            >
              {m}
            </TabsTrigger>
          ))}
        </TabsList>

        {MORADORES.map((m) => (
          <TabsContent key={m} value={m} className="mt-4">
            <Feed morador={m} autor={autor} hydrated={hydrated} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

function Feed({
  morador,
  autor,
  hydrated,
}: {
  morador: Morador;
  autor: string | null;
  hydrated: boolean;
}) {
  const carregar = useServerFn(listarMural);
  const postar = useServerFn(postarNoMural);
  const queryClient = useQueryClient();
  const [mensagem, setMensagem] = useState("");

  const feed = useQuery({
    queryKey: ["mural", morador],
    queryFn: () => carregar({ data: { destinatario: morador } }),
    // Recados chegam durante a festa: atualiza sozinho sem recarregar a página.
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const envio = useMutation({
    mutationFn: (texto: string) =>
      postar({ data: { destinatario: morador, mensagem: texto, autor: autor ?? "Anônimo" } }),
    onSuccess: () => {
      setMensagem("");
      queryClient.invalidateQueries({ queryKey: ["mural", morador] });
    },
  });

  const ficha = FICHAS[morador];
  const podeEnviar = mensagem.trim().length > 0 && !envio.isPending && !!autor;

  return (
    <div>
      <header className="rounded-sm border-2 border-neon/50 bg-card/50 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="font-arcade truncate text-[10px] uppercase text-neon text-glow">
              {morador}
            </p>
            <p className="mt-2 text-[12px] text-muted-foreground">{ficha.diagnostico}</p>
          </div>
          <span className="font-arcade shrink-0 rounded-sm border border-whisky px-2 py-1 text-[7px] text-whisky">
            {ficha.codigo}
          </span>
        </div>
        <p className="font-arcade mt-3 text-[7px] uppercase tracking-widest text-muted-foreground">
          Arquivo confidencial · {feed.data?.length ?? 0} registros
        </p>

        {!jaRevelou() ? (
          <div className="mt-3 rounded-sm border border-whisky/50 bg-whisky/10 px-3 py-2 text-center">
            <p className="font-arcade text-[7px] uppercase leading-relaxed text-whisky">
              Recados lacrados até 30/10 ao meio-dia
            </p>
            <ContagemRegressiva ate={REVELACAO} rotulo="ABRE EM" className="mt-1 text-[10px]" />
          </div>
        ) : null}
      </header>

      <div className="mt-4 space-y-3 pb-24">
        {feed.isPending ? (
          <p className="font-arcade py-8 text-center text-[8px] uppercase text-muted-foreground">
            Carregando arquivo…
          </p>
        ) : feed.isError ? (
          <div className="rounded-sm border border-destructive bg-destructive/10 p-4 text-center">
            <FileWarning className="mx-auto h-6 w-6 text-destructive" />
            <p className="mt-2 text-[12px] text-foreground">Não foi possível abrir o arquivo.</p>
            <ArcadeButton
              tone="whisky"
              onClick={() => feed.refetch()}
              className="mt-3 px-4 py-2 text-[8px] uppercase"
            >
              Tentar de novo
            </ArcadeButton>
          </div>
        ) : feed.data.length === 0 ? (
          <p className="font-arcade py-8 text-center text-[8px] uppercase leading-loose text-muted-foreground">
            Nenhum registro
            <br />
            neste prontuário
          </p>
        ) : (
          feed.data.map((r, i) => (
            <motion.article
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i, 6) * 0.03 }}
              className="rounded-sm border border-neon/25 bg-card/40 p-3"
            >
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                <Moldura itens={r.itens}>
                  <PixelAvatar
                    personagem={r.personagem}
                    avatar={r.avatar}
                    size="sm"
                    title={`Avatar de ${r.autor}`}
                  />
                </Moldura>
                <p className="font-arcade truncate text-[8px] uppercase text-whisky">
                  <NomeDoPaciente nome={r.autor} itens={r.itens} />
                </p>
                <time className="shrink-0 text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>

              {r.mensagem === null ? (
                <div className="mt-2">
                  <RecadoEmbargado tamanho={r.tamanho ?? 40} />
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    deixou um recado para {morador}
                  </p>
                </div>
              ) : (
                <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">
                  {r.mensagem}
                </p>
              )}
            </motion.article>
          ))
        )}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-neon/30 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-3">
          {hydrated && !autor ? (
            <p className="text-center text-[12px] text-muted-foreground">
              Passe pela{" "}
              <Link to="/" className="text-neon underline">
                triagem
              </Link>{" "}
              para deixar recados.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (podeEnviar) envio.mutate(mensagem.trim());
              }}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
            >
              <input
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                maxLength={280}
                placeholder={`Recado para ${morador}`}
                aria-label={`Recado para ${morador}`}
                className="tap-44 min-w-0 rounded-sm border-2 border-neon/50 bg-background px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-neon"
              />
              <ArcadeButton
                type="submit"
                disabled={!podeEnviar}
                aria-label="Enviar recado"
                className="grid h-11 w-14 shrink-0 place-items-center"
              >
                {envio.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </ArcadeButton>
            </form>
          )}
          {envio.isError ? (
            <p role="alert" className="mt-2 text-center text-[11px] text-destructive">
              Não deu para enviar. Tente novamente.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
