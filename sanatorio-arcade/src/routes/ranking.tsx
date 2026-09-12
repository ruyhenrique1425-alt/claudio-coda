import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Trophy } from "lucide-react";

import { PixelAvatar } from "@/components/avatar/PixelAvatar";
import { Moldura, NomeDoPaciente } from "@/components/Moldura";
import { ContagemRegressiva } from "@/components/ContagemRegressiva";
import { supabase } from "@/integrations/supabase/client";
import { APURACAO, jaApurou } from "@/lib/datas";
import { apurarPremiacao, lerRanking, type LinhaRanking, type Podio } from "@/lib/pontos";
import { lerProntuario } from "@/lib/paciente-local";
import { canalQuandoDerVerifica } from "@/lib/realtime";

export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking do Sanatório — paciente mais insano da noite" },
      {
        name: "description",
        content:
          "Placar ao vivo das fichas ganhas na festa Sanatório. O pódio congela às 3:33 do dia 30/10.",
      },
      { property: "og:title", content: "Ranking do Sanatório" },
      {
        property: "og:description",
        content: "Quem tiver mais fichas ganhas às 3:33 leva o prêmio.",
      },
    ],
  }),
  component: RankingPage,
});

const MEDALHAS = [
  "border-whisky bg-whisky/15 shadow-[0_0_22px_-6px_var(--whisky)]",
  "border-foreground/70 bg-foreground/10",
  "border-[oklch(0.6_0.12_60)] bg-[oklch(0.6_0.12_60)]/10",
];

function RankingPage() {
  const [linhas, setLinhas] = useState<LinhaRanking[]>([]);
  const [podio, setPodio] = useState<Podio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [eu, setEu] = useState<string | null>(null);

  const puxar = useCallback(() => {
    void lerRanking()
      .then(setLinhas)
      .catch(() => undefined)
      .finally(() => setCarregando(false));
  }, []);

  const conferirApuracao = useCallback(() => {
    if (!jaApurou()) return;
    void apurarPremiacao(APURACAO)
      .then(setPodio)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setEu(lerProntuario()?.pacienteId ?? null);
    puxar();
    conferirApuracao();

    // O placar se mexe sozinho quando o sinal permite; com sinal fraco, o
    // realtime sai de cena e a lista recarrega de minuto em minuto.
    return canalQuandoDerVerifica(
      () =>
        supabase
          .channel(`ranking-${crypto.randomUUID()}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "transacoes" }, puxar)
          .subscribe(),
      (canal) => void supabase.removeChannel(canal),
      puxar,
    );
  }, [puxar, conferirApuracao]);

  const congelado = podio.length > 0;

  return (
    <section>
      <header className="rounded-sm border-2 border-whisky bg-card/50 p-4 text-center">
        <Trophy className="mx-auto h-7 w-7 text-whisky" />
        <h1 className="font-arcade mt-3 text-[11px] uppercase leading-relaxed text-whisky text-glow">
          Paciente mais insano
        </h1>

        {congelado ? (
          <p className="font-arcade mt-3 text-[9px] uppercase text-neon text-glow">
            Pódio apurado às 3:33
          </p>
        ) : (
          <ContagemRegressiva
            ate={APURACAO}
            rotulo="APURAÇÃO EM"
            className="mt-3 text-[13px]"
            aoZerar={conferirApuracao}
          />
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          O ranking usa <span className="text-neon">fichas ganhas</span>, não o saldo. Doar fichas
          para um amigo não tira você da disputa.
        </p>
      </header>

      {congelado ? (
        <div className="mt-4 rounded-sm border-2 border-neon bg-neon/10 p-4">
          <p className="font-arcade text-center text-[9px] uppercase text-neon text-glow">
            Resultado oficial
          </p>
          <ol className="mt-3 space-y-2">
            {podio.map((p) => (
              <li
                key={p.paciente_id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-sm border border-whisky/60 bg-background/60 px-3 py-2"
              >
                <span className="font-arcade text-[12px] text-whisky">{p.posicao}º</span>
                <span className="font-arcade truncate text-[9px] uppercase text-foreground">
                  {p.nome}
                </span>
                <span className="font-arcade text-[11px] text-neon">{p.ganhos_total}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {carregando ? (
        <p className="mt-6 text-center text-[12px] text-muted-foreground">Abrindo o placar…</p>
      ) : null}

      {!carregando && linhas.length === 0 ? (
        <p className="mt-6 text-center text-[12px] text-muted-foreground">
          Ninguém pontuou ainda. Vá para o arcade abrir o placar.
        </p>
      ) : null}

      <ol className="mt-5 space-y-2">
        {linhas.map((l, i) => {
          const medalha = i < 3 ? MEDALHAS[i] : "border-purple/50 bg-card/50";
          return (
            <motion.li
              key={l.paciente_id}
              layout
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className={`grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-sm border-2 px-3 py-2 ${medalha} ${
                l.paciente_id === eu ? "ring-1 ring-neon" : ""
              }`}
            >
              <span
                className={`font-arcade w-6 text-right text-[11px] ${
                  i < 3 ? "text-whisky text-glow" : "text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>

              <Moldura itens={l.itens}>
                <PixelAvatar
                  personagem={l.personagem}
                  avatar={l.avatar}
                  size="sm"
                  title={`Avatar de ${l.nome}`}
                />
              </Moldura>

              <span className="font-arcade min-w-0 truncate text-[9px] uppercase text-foreground">
                <NomeDoPaciente nome={l.nome.slice(0, 12)} itens={l.itens} />
              </span>

              <span className="font-arcade shrink-0 text-right text-[11px] text-whisky">
                {l.ganhos_total}
              </span>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
