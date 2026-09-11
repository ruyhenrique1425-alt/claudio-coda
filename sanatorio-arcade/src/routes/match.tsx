import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { Beer, HeartCrack, Swords } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { PixelAvatar } from "@/components/avatar/PixelAvatar";
import { Moldura, NomeDoPaciente } from "@/components/Moldura";
import { DadoPrenda } from "@/components/DadoPrenda";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

import { listarPacientes } from "@/lib/sanatorio.functions";
import { lerProntuario, type Prontuario } from "@/lib/paciente-local";
import { calcularAfinidade, diagnosticosIguais, tierDeAfinidade } from "@/lib/afinidade";
import { criarDesafio, curtir, mandarPrenda } from "@/lib/pontos";

export const Route = createFileRoute("/match")({
  head: () => ({
    meta: [
      { title: "Match de Manicômio — encontre sua alma gêmea caótica" },
      {
        name: "description",
        content:
          "Compatibilidade calculada sobre os cinco diagnósticos, curtida com aviso ao vivo, prenda alcoólica e desafio valendo fichas.",
      },
      { property: "og:title", content: "Match de Manicômio" },
      {
        property: "og:description",
        content: "Curta, mande prenda e desafie outros pacientes valendo fichas.",
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

const APOSTAS = [10, 25, 50] as const;

type Alvo = { id: string; nome: string };

function MatchPage() {
  const buscar = useServerFn(listarPacientes);
  const [eu, setEu] = useState<Prontuario | null>(null);
  const [curtidos, setCurtidos] = useState<Record<string, boolean>>({});
  const [prenda, setPrenda] = useState<{ alvo: Alvo; segundos: number } | null>(null);
  const [desafio, setDesafio] = useState<Alvo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [somenteMatches, setSomenteMatches] = useState(false);
  const [meusMatches, setMeusMatches] = useState<Set<string>>(new Set());

  useEffect(() => setEu(lerProntuario()), []);

  const carregarMatches = useCallback(async (pacienteId: string) => {
    // Match é curtida nos dois sentidos.
    const [minhas, recebidas] = await Promise.all([
      supabase.from("curtidas").select("para_paciente").eq("de_paciente", pacienteId),
      supabase.from("curtidas").select("de_paciente").eq("para_paciente", pacienteId),
    ]);
    const mandei = new Set((minhas.data ?? []).map((c) => c.para_paciente));
    setCurtidos(Object.fromEntries([...mandei].map((id) => [id, true])));
    setMeusMatches(
      new Set((recebidas.data ?? []).map((c) => c.de_paciente).filter((id) => mandei.has(id))),
    );
  }, []);

  useEffect(() => {
    if (eu?.pacienteId) void carregarMatches(eu.pacienteId).catch(() => undefined);
  }, [eu?.pacienteId, carregarMatches]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["pacientes"],
    queryFn: () => buscar(),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const lista = useMemo(() => {
    const rows = (data ?? []).filter((p) => p.id !== eu?.pacienteId && p.nome !== eu?.nome);
    if (!eu) return rows.map((p) => ({ ...p, afinidade: 0, iguais: 0 }));

    return rows
      .map((p) => ({
        ...p,
        afinidade: calcularAfinidade(eu.stats, p),
        iguais: diagnosticosIguais(eu.stats, p),
      }))
      .sort((a, b) => b.afinidade - a.afinidade || b.iguais - a.iguais);
  }, [data, eu]);

  const visiveis = somenteMatches ? lista.filter((p) => meusMatches.has(p.id)) : lista;
  const compativeis = lista.filter((p) => p.afinidade >= 60).length;

  async function aoCurtir(alvo: Alvo) {
    setOcupado(alvo.id);
    setErro(null);
    try {
      const mutuo = await curtir(alvo.id);
      setCurtidos((c) => ({ ...c, [alvo.id]: true }));
      if (mutuo) setMeusMatches((m) => new Set(m).add(alvo.id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "A curtida não foi.");
    } finally {
      setOcupado(null);
    }
  }

  async function aoMandarPrenda(alvo: Alvo) {
    setOcupado(alvo.id);
    setErro(null);
    try {
      const { segundos } = await mandarPrenda(alvo.id);
      setPrenda({ alvo, segundos });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "A prenda não saiu.");
    } finally {
      setOcupado(null);
    }
  }

  async function aoDesafiar(alvo: Alvo, pontos: number) {
    setOcupado(alvo.id);
    setErro(null);
    try {
      await criarDesafio(alvo.id, pontos);
      setDesafio(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "O desafio não foi enviado.");
    } finally {
      setOcupado(null);
    }
  }

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

        {meusMatches.size > 0 ? (
          <button
            onClick={() => setSomenteMatches((v) => !v)}
            className={`font-arcade mt-3 w-full rounded-sm border-2 py-3 text-[8px] uppercase ${
              somenteMatches ? "border-neon bg-neon/15 text-neon" : "border-purple/60 text-whisky"
            }`}
          >
            {somenteMatches ? "Ver todos os pacientes" : `Meus matches (${meusMatches.size})`}
          </button>
        ) : null}
      </header>

      {erro ? (
        <p role="alert" className="mt-3 text-center text-[11px] text-destructive">
          {erro}
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-6 text-center text-[12px] text-muted-foreground">Abrindo prontuários...</p>
      ) : null}
      {isError ? (
        <p className="mt-6 text-center text-[12px] text-whisky">
          Não foi possível carregar os pacientes.
        </p>
      ) : null}
      {!isLoading && !isError && visiveis.length === 0 ? (
        <p className="mt-6 text-center text-[12px] text-muted-foreground">
          {somenteMatches
            ? "Nenhum match ainda. Curta alguém e espere."
            : "Ninguém internado além de você. Chame a galera."}
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        {visiveis.map((p, i) => {
          const tier = tierDeAfinidade(p.afinidade);
          const alvo: Alvo = { id: p.id, nome: p.nome };
          const ehMatch = meusMatches.has(p.id);

          return (
            <motion.article
              key={p.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
              className={`rounded-sm border-2 bg-card/60 p-4 ${
                ehMatch
                  ? "border-whisky shadow-[0_0_20px_-6px_var(--whisky)]"
                  : tier.destaque
                    ? "border-neon shadow-[0_0_16px_-6px_var(--neon)]"
                    : "border-purple/60"
              }`}
            >
              <div className="flex items-start gap-3">
                <Moldura itens={p.itens}>
                  <PixelAvatar
                    personagem={p.personagem}
                    avatar={p.avatar}
                    size="md"
                    title={`Avatar de ${p.nome}`}
                  />
                </Moldura>

                <div className="min-w-0 flex-1">
                  <h2 className="font-arcade text-[10px] uppercase leading-relaxed text-foreground">
                    <NomeDoPaciente nome={p.nome} itens={p.itens} />
                  </h2>
                  <p className="font-arcade mt-1 text-[7px] uppercase text-muted-foreground">
                    Leito {p.id.slice(0, 4).toUpperCase()}
                  </p>

                  {eu ? (
                    <>
                      <span
                        className={`font-arcade mt-2 block text-[7px] uppercase ${
                          tier.destaque ? "text-neon" : "text-muted-foreground"
                        }`}
                      >
                        {[tier.estrelas, tier.rotulo].filter(Boolean).join(" ")}
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
                          className={`h-full ${tier.destaque ? "bg-neon" : "bg-purple"}`}
                          style={{ width: `${p.afinidade}%` }}
                        />
                      </div>
                      <span className="font-arcade mt-1 block text-[7px] text-whisky">
                        {p.afinidade}% · {p.iguais}/5 diagnósticos iguais
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              {ehMatch ? (
                <p className="font-arcade mt-3 rounded-sm border border-whisky bg-whisky/10 px-2 py-2 text-center text-[7px] uppercase leading-relaxed text-whisky">
                  Match confirmado · tratamento prescrito: uma dose no bar, juntos
                </p>
              ) : null}

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

              <div className="mt-4 grid grid-cols-3 gap-2">
                <ArcadeButton
                  tone={curtidos[p.id] ? "whisky" : tier.destaque ? "neon" : "purple"}
                  disabled={curtidos[p.id] || ocupado === p.id}
                  onClick={() => void aoCurtir(alvo)}
                  className="flex flex-col items-center justify-center gap-1 py-3 text-[7px] uppercase"
                >
                  <HeartCrack className="h-4 w-4" />
                  {curtidos[p.id] ? "Curtido" : "Internar junto"}
                </ArcadeButton>

                <ArcadeButton
                  tone="whisky"
                  disabled={ocupado === p.id}
                  onClick={() => void aoMandarPrenda(alvo)}
                  className="flex flex-col items-center justify-center gap-1 py-3 text-[7px] uppercase"
                >
                  <Beer className="h-4 w-4" />
                  Prenda
                </ArcadeButton>

                <ArcadeButton
                  tone="purple"
                  disabled={ocupado === p.id}
                  onClick={() => setDesafio(alvo)}
                  className="flex flex-col items-center justify-center gap-1 py-3 text-[7px] uppercase"
                >
                  <Swords className="h-4 w-4" />
                  Desafiar
                </ArcadeButton>
              </div>
            </motion.article>
          );
        })}
      </div>

      {/* Dado da prenda: o valor já veio sorteado do servidor. */}
      <Dialog open={prenda !== null} onOpenChange={(o) => !o && setPrenda(null)}>
        <DialogContent className="rounded-sm border-2 border-whisky bg-background p-6 text-center">
          <DialogHeader>
            <DialogTitle className="font-arcade text-[10px] uppercase text-whisky text-glow">
              Prenda enviada
            </DialogTitle>
            <DialogDescription className="text-[12px] text-muted-foreground">
              O dado decidiu quantos segundos {prenda?.alvo.nome} vai beber.
            </DialogDescription>
          </DialogHeader>

          {prenda ? (
            <div className="mt-4">
              <DadoPrenda segundos={prenda.segundos} />
              <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
                O aviso já chegou no celular de {prenda.alvo.nome}. Se cumprir, leva{" "}
                {prenda.segundos * 10} fichas. Se passar, as 5 fichas são suas.
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Aposta de fichas no par ou ímpar. */}
      <Dialog open={desafio !== null} onOpenChange={(o) => !o && setDesafio(null)}>
        <DialogContent className="rounded-sm border-2 border-purple bg-background p-6">
          <DialogHeader>
            <DialogTitle className="font-arcade text-[10px] uppercase text-neon text-glow">
              Desafio de cachaça
            </DialogTitle>
            <DialogDescription className="text-[12px] leading-relaxed text-muted-foreground">
              Par ou ímpar valendo fichas contra {desafio?.nome}. Quem desafia fica com o par. Se a
              pessoa não responder em 60 segundos, ninguém perde nada.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {APOSTAS.map((valor) => (
              <ArcadeButton
                key={valor}
                tone="whisky"
                disabled={ocupado === desafio?.id}
                onClick={() => desafio && void aoDesafiar(desafio, valor)}
                className="py-4 text-[10px] uppercase"
              >
                {valor}
              </ArcadeButton>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
