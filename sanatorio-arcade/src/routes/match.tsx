import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { HeartCrack } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { PixelAvatar } from "@/components/avatar/PixelAvatar";

import { listarPacientes } from "@/lib/sanatorio.functions";
import { lerProntuario, type Prontuario } from "@/lib/paciente-local";
import { calcularAfinidade, diagnosticosIguais, tierDeAfinidade } from "@/lib/afinidade";

export const Route = createFileRoute("/match")({
  head: () => ({
    meta: [
      { title: "Match de Manicômio — encontre sua alma gêmea caótica" },
      {
        name: "description",
        content:
          "Veja os pacientes internados na festa Sanatório, descubra quem tem o mesmo nível de caos e desafie para um shot.",
      },
      { property: "og:title", content: "Match de Manicômio" },
      {
        property: "og:description",
        content: "Compatibilidade calculada sobre os cinco diagnósticos da ficha.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchPage,
  errorComponent: () => (
    <p className="text-[12px] text-whisky">Ala de convivência fechada. Tente novamente.</p>
  ),
  notFoundComponent: () => <p className="text-[12px] text-muted-foreground">Nada por aqui.</p>,
});

const ATRIBUTOS = [
  { key: "fator_coringa", label: "Coringa" },
  { key: "imunidade_etilica", label: "Imunidade" },
  { key: "inimigo_do_fim", label: "Inimigo do Fim" },
  { key: "aptidao_audio", label: "Áudio" },
  { key: "amnesia_anterograda", label: "Amnésia" },
] as const;

function MatchPage() {
  const buscar = useServerFn(listarPacientes);
  const [eu, setEu] = useState<Prontuario | null>(null);
  const [desafiados, setDesafiados] = useState<Record<string, boolean>>({});

  useEffect(() => setEu(lerProntuario()), []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["pacientes"],
    queryFn: () => buscar(),
    // A ala enche durante a festa: puxa fichas novas sem precisar recarregar.
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const lista = useMemo(() => {
    const rows = (data ?? []).filter((p) => p.nome !== eu?.nome);
    if (!eu) return rows.map((p) => ({ ...p, afinidade: 0, iguais: 0 }));

    return rows
      .map((p) => ({
        ...p,
        afinidade: calcularAfinidade(eu.stats, p),
        iguais: diagnosticosIguais(eu.stats, p),
      }))
      .sort((a, b) => b.afinidade - a.afinidade || b.iguais - a.iguais);
  }, [data, eu]);

  const compativeis = lista.filter((p) => p.afinidade >= 60).length;

  return (
    <section>
      <header className="rounded-sm border-2 border-purple/70 bg-card/50 p-4 text-center">
        <h1 className="font-arcade text-[11px] uppercase leading-relaxed text-neon text-glow">
          Match de Manicômio
        </h1>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          {eu
            ? `Cruzando sua ficha, ${eu.nome}: ${compativeis} paciente(s) no seu nível de caos.`
            : "Preencha sua ficha na aba Ficha para calcular a afinidade."}
        </p>
      </header>

      {isLoading ? (
        <p className="mt-6 text-center text-[12px] text-muted-foreground">Abrindo prontuários...</p>
      ) : null}
      {isError ? (
        <p className="mt-6 text-center text-[12px] text-whisky">
          Não foi possível carregar os pacientes.
        </p>
      ) : null}
      {!isLoading && !isError && lista.length === 0 ? (
        <p className="mt-6 text-center text-[12px] text-muted-foreground">
          Ninguém internado além de você. Chame a galera.
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        {lista.map((p, i) => (
          <motion.article
            key={p.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
            className={`rounded-sm border-2 bg-card/60 p-4 ${
              tierDeAfinidade(p.afinidade).destaque
                ? "border-neon shadow-[0_0_16px_-6px_var(--neon)]"
                : "border-purple/60"
            }`}
          >
            <div className="flex items-start gap-3">
              <PixelAvatar
                personagem={p.personagem}
                avatar={p.avatar}
                size="md"
                title={`Avatar de ${p.nome}`}
              />
              <div className="min-w-0 flex-1">
                <h2 className="font-arcade text-[10px] uppercase leading-relaxed text-foreground">
                  {p.nome}
                </h2>
                {eu ? (
                  <>
                    <span
                      className={`font-arcade mt-2 block text-[7px] uppercase ${
                        tierDeAfinidade(p.afinidade).destaque
                          ? "text-neon"
                          : "text-muted-foreground"
                      }`}
                    >
                      {[tierDeAfinidade(p.afinidade).estrelas, tierDeAfinidade(p.afinidade).rotulo]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                    <div
                      className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-input"
                      role="meter"
                      aria-valuenow={p.afinidade}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Compatibilidade com ${p.nome}`}
                    >
                      <div
                        className={`h-full ${
                          tierDeAfinidade(p.afinidade).destaque ? "bg-neon" : "bg-purple"
                        }`}
                        style={{ width: `${p.afinidade}%` }}
                      />
                    </div>
                    <span className="font-arcade mt-1 block text-[7px] text-whisky">
                      {p.afinidade}% de compatibilidade · {p.iguais}/5 diagnósticos iguais
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <dl className="mt-3 space-y-2">
              {ATRIBUTOS.map(({ key, label }) => (
                <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <dt className="text-[11px] text-muted-foreground">{label}</dt>
                  <dd className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((n) => (
                      <span
                        key={n}
                        className={`h-2.5 w-2.5 rounded-[1px] ${
                          n < p[key] ? "bg-whisky" : "bg-muted"
                        }`}
                      />
                    ))}
                  </dd>
                </div>
              ))}
            </dl>

            <ArcadeButton
              tone={tierDeAfinidade(p.afinidade).destaque ? "neon" : "purple"}
              onClick={() => setDesafiados((d) => ({ ...d, [p.id]: true }))}
              className="mt-4 w-full p-3 text-[9px] uppercase"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <HeartCrack className="h-4 w-4" />
                {desafiados[p.id] ? "Desafio enviado (mentira)" : "Desafiar para um Shot"}
              </span>
            </ArcadeButton>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
