import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Siren } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/panico")({
  head: () => ({
    meta: [
      { title: "Botão do Pânico — 5.000 cliques para libertar o Coringa" },
      {
        name: "description",
        content:
          "Clique junto com toda a festa Sanatório: ao bater 5.000 cliques, o alerta logístico é disparado para todos ao mesmo tempo.",
      },
      { property: "og:title", content: "Botão do Pânico do Sanatório" },
      {
        property: "og:description",
        content: "Contador coletivo ao vivo. Faltam poucos cliques para o caos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PanicoPage,
  errorComponent: () => (
    <p className="text-[12px] text-whisky">A sirene falhou. Recarregue a página.</p>
  ),
  notFoundComponent: () => <p className="text-[12px] text-muted-foreground">Nada por aqui.</p>,
});

const META = 5000;

function PanicoPage() {
  const [cliques, setCliques] = useState<number | null>(null);
  const [alerta, setAlerta] = useState(false);
  const [pulso, setPulso] = useState(0);
  const pendentes = useRef(0);
  const enviando = useRef(false);

  useEffect(() => {
    let ativo = true;

    void supabase
      .from("botao_panico")
      .select("cliques")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!ativo) return;
        const total = data?.cliques ?? 0;
        setCliques(total);
        if (total >= META) setAlerta(true);
      });

    const channel = supabase
      .channel("botao_panico")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "botao_panico" },
        (payload) => {
          const total = (payload.new as { cliques?: number } | null)?.cliques;
          if (typeof total !== "number") return;
          setCliques(total);
          if (total >= META) setAlerta(true);
        },
      )
      .subscribe();

    return () => {
      ativo = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const descarregar = useCallback(async () => {
    if (enviando.current || pendentes.current === 0) return;
    enviando.current = true;
    const qtd = Math.min(pendentes.current, 10);
    pendentes.current -= qtd;
    const { data } = await supabase.rpc("incrementar_panico", { _qtd: qtd });
    if (typeof data === "number") {
      setCliques(data);
      if (data >= META) setAlerta(true);
    }
    enviando.current = false;
    if (pendentes.current > 0) void descarregar();
  }, []);

  function clicar() {
    pendentes.current += 1;
    setCliques((c) => (c === null ? 1 : c + 1));
    setPulso((p) => p + 1);
    void descarregar();
  }

  const restante = cliques === null ? null : Math.max(0, META - cliques);

  return (
    <section>
      <header className="rounded-sm border-2 border-neon/50 bg-card/50 p-4 text-center">
        <h1 className="font-arcade text-[11px] uppercase leading-relaxed text-neon text-glow">
          Botão do Pânico
        </h1>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          Todo mundo da festa clica no mesmo botão. Aos 5.000 cliques o Coringa escapa.
        </p>
      </header>

      <div className="mt-6 text-center">
        <p className="font-arcade text-[9px] uppercase text-whisky">Cliques coletivos</p>
        <motion.p
          key={cliques ?? -1}
          initial={{ scale: 1.15 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="font-arcade mt-3 text-[26px] leading-none text-neon text-glow"
        >
          {cliques === null ? "----" : cliques.toLocaleString("pt-BR")}
        </motion.p>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {restante === null ? "Conectando..." : `Faltam ${restante.toLocaleString("pt-BR")}`}
        </p>

        <div className="mx-auto mt-4 h-3 w-full max-w-xs overflow-hidden rounded-sm border-2 border-purple/70">
          <div
            className="h-full bg-purple transition-[width] duration-200"
            style={{ width: `${Math.min(100, ((cliques ?? 0) / META) * 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-8 grid place-items-center">
        <motion.button
          key={pulso}
          type="button"
          onClick={clicar}
          whileTap={{ scale: 0.9 }}
          animate={{ boxShadow: ["0 0 30px -6px #ff2d2d", "0 0 60px -4px #ff2d2d"] }}
          transition={{ duration: 0.9, repeat: Infinity, repeatType: "reverse" }}
          className="font-arcade tap-44 grid h-52 w-52 place-items-center rounded-full border-4 text-[11px] uppercase leading-relaxed text-white"
          style={{ borderColor: "#ff5c5c", background: "radial-gradient(#c81e1e, #6b0d0d)" }}
        >
          <span className="flex flex-col items-center gap-2">
            <Siren className="h-8 w-8" />
            Pânico
          </span>
        </motion.button>
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
        Aperte sem medo: o contador é o mesmo em todos os celulares, ao vivo.
      </p>

      {alerta ? <AlertaGlobal /> : null}
    </section>
  );
}

function AlertaGlobal() {
  const [cor, setCor] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setCor((c) => (c + 1) % 2), 320);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center px-6 text-center transition-colors duration-200"
      style={{ background: cor === 0 ? "var(--neon)" : "var(--purple)" }}
      role="alertdialog"
      aria-modal="true"
    >
      <div className="max-w-sm rounded-sm border-4 border-black bg-black/85 p-6">
        <motion.h2
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="font-arcade text-[15px] uppercase leading-relaxed text-whisky text-glow"
        >
          O Coringa fugiu!
        </motion.h2>
        <p className="mt-5 text-[13px] leading-relaxed text-foreground">
          Alerta logístico: Liberação imediata das caixas de Smirnoff (padrão 6 unidades) e Red Bull
          Zero nos bares principais da pista!
        </p>
      </div>
    </div>
  );
}
