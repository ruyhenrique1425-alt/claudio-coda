import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Lock, Siren, Users } from "lucide-react";
import { Camera as CameraIcon } from "lucide-react";

import { CartaoPixel } from "@/components/CartaoPixel";
import { ArcadeButton } from "@/components/ArcadeButton";
import { supabase } from "@/integrations/supabase/client";
import { canalQuandoDerVerifica } from "@/lib/realtime";
import { listarFotos, listarMural, listarPacientes, MORADORES } from "@/lib/sanatorio.functions";

export const Route = createFileRoute("/admin-sanatorio")({
  head: () => ({
    meta: [
      { title: "Painel do organizador — República Sanatório" },
      {
        name: "description",
        content: "Pacientes, fotos e nível de pânico ao vivo, com exportação do mural em CSV.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSanatorioPage,
});

const SENHA_KEY = "sanatorio:senha-oficina";
const META_PANICO = 5000;

type Paciente = Awaited<ReturnType<typeof listarPacientes>>[number];
type Foto = Awaited<ReturnType<typeof listarFotos>>[number];

/** Escapa uma célula para CSV: aspas duplicadas, e envolve em aspas se tiver vírgula, aspas ou quebra de linha. */
function celulaCsv(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function baixarCsv(nomeArquivo: string, linhas: string[][]) {
  const conteudo = linhas.map((l) => l.map(celulaCsv).join(",")).join("\r\n");
  // BOM na frente: Excel abre acentuado sem virar sopa de letrinhas.
  const blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function AdminSanatorioPage() {
  const buscarPacientes = useServerFn(listarPacientes);
  const buscarFotos = useServerFn(listarFotos);
  const buscarMural = useServerFn(listarMural);

  const [senha, setSenha] = useState("");
  const [liberado, setLiberado] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);

  const [pacientes, setPacientes] = useState<Paciente[] | null>(null);
  const [fotos, setFotos] = useState<Foto[] | null>(null);
  const [cliquesPanico, setCliquesPanico] = useState<number | null>(null);
  const [exportando, setExportando] = useState(false);
  const [erroExport, setErroExport] = useState<string | null>(null);

  useEffect(() => {
    try {
      const guardada = sessionStorage.getItem(SENHA_KEY);
      if (guardada) setSenha(guardada);
    } catch {
      /* sem sessionStorage: entra sem lembrar a senha */
    }
  }, []);

  async function entrar() {
    setVerificando(true);
    setErroSenha(null);
    try {
      const { data, error } = await supabase.rpc("checar_senha_administracao", {
        _senha: senha,
      });
      if (error) throw new Error(error.message);
      if (!data) {
        setErroSenha("Senha incorreta.");
        return;
      }
      try {
        sessionStorage.setItem(SENHA_KEY, senha);
      } catch {
        /* segue sem lembrar */
      }
      setLiberado(true);
    } catch (e) {
      setErroSenha(e instanceof Error ? e.message : "Não deu para checar a senha.");
    } finally {
      setVerificando(false);
    }
  }

  useEffect(() => {
    if (!liberado) return;
    void buscarPacientes().then(setPacientes);
    void buscarFotos().then(setFotos);
  }, [liberado, buscarPacientes, buscarFotos]);

  // Nível de pânico ao vivo — mesma leitura e canal da tela /panico.
  useEffect(() => {
    if (!liberado) return;
    let ativo = true;

    void supabase
      .from("botao_panico")
      .select("cliques")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (ativo) setCliquesPanico(data?.cliques ?? 0);
      });

    const parar = canalQuandoDerVerifica(
      () =>
        supabase
          .channel(`admin-panico-${crypto.randomUUID()}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "botao_panico" },
            (payload) => {
              const total = (payload.new as { cliques?: number } | null)?.cliques;
              if (typeof total === "number") setCliquesPanico(total);
            },
          )
          .subscribe(),
      (canal) => void supabase.removeChannel(canal),
      () => {
        void supabase
          .from("botao_panico")
          .select("cliques")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => {
            if (typeof data?.cliques === "number") setCliquesPanico(data.cliques);
          });
      },
      30_000,
    );

    return () => {
      ativo = false;
      parar();
    };
  }, [liberado]);

  const exportarMural = useCallback(async () => {
    setExportando(true);
    setErroExport(null);
    try {
      const porMorador = await Promise.all(
        MORADORES.map((morador) => buscarMural({ data: { destinatario: morador } })),
      );
      const linhas: string[][] = [["destinatário", "autor", "mensagem", "data/hora"]];
      MORADORES.forEach((morador, i) => {
        for (const r of porMorador[i] ?? []) {
          linhas.push([
            morador,
            r.autor,
            r.mensagem ?? "(ainda sob embargo)",
            new Date(r.created_at).toLocaleString("pt-BR"),
          ]);
        }
      });
      baixarCsv(`mural-sanatorio-${new Date().toISOString().slice(0, 10)}.csv`, linhas);
    } catch (e) {
      setErroExport(e instanceof Error ? e.message : "Não deu para exportar o mural.");
    } finally {
      setExportando(false);
    }
  }, [buscarMural]);

  if (!liberado) {
    return (
      <section>
        <CartaoPixel tom="whisky" className="text-center">
          <h1 className="font-arcade text-[11px] uppercase leading-relaxed text-whisky text-glow">
            Painel do organizador
          </h1>
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
            Pacientes, fotos e nível de pânico ao vivo. Exportação do mural em CSV.
          </p>
        </CartaoPixel>

        <div className="mt-4 rounded-sm border-2 border-whisky bg-card/50 p-3">
          <label
            htmlFor="senha-admin-sanatorio"
            className="font-arcade flex items-center gap-2 text-[8px] uppercase text-whisky"
          >
            <Lock className="h-3.5 w-3.5" /> Senha (a mesma da oficina e do bar)
          </label>
          <input
            id="senha-admin-sanatorio"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void entrar()}
            placeholder="Senha"
            className="tap-44 mt-2 w-full rounded-sm border-2 border-whisky/50 bg-background px-3 py-3 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-whisky"
          />
        </div>

        {erroSenha ? (
          <p role="alert" className="mt-3 text-center text-[11px] text-destructive">
            {erroSenha}
          </p>
        ) : null}

        <ArcadeButton
          tone="whisky"
          onClick={() => void entrar()}
          disabled={verificando || !senha}
          className="mt-4 w-full py-4 text-[10px] uppercase"
        >
          {verificando ? "Checando…" : "Entrar"}
        </ArcadeButton>
      </section>
    );
  }

  const restantePanico = cliquesPanico === null ? null : Math.max(0, META_PANICO - cliquesPanico);

  return (
    <section>
      <CartaoPixel tom="whisky" className="text-center">
        <h1 className="font-arcade text-[11px] uppercase leading-relaxed text-whisky text-glow">
          Painel do organizador
        </h1>
      </CartaoPixel>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-sm border-2 border-neon/60 bg-card/50 p-3 text-center">
          <Users className="mx-auto h-5 w-5 text-neon" />
          <p className="font-arcade mt-2 text-lg text-neon text-glow">
            {pacientes === null ? "—" : pacientes.length}
          </p>
          <p className="font-arcade mt-1 text-[7px] uppercase text-muted-foreground">Pacientes</p>
        </div>
        <div className="rounded-sm border-2 border-purple/60 bg-card/50 p-3 text-center">
          <CameraIcon className="mx-auto h-5 w-5 text-purple" />
          <p className="font-arcade mt-2 text-lg text-purple text-glow">
            {fotos === null ? "—" : fotos.length}
          </p>
          <p className="font-arcade mt-1 text-[7px] uppercase text-muted-foreground">Fotos</p>
        </div>
      </div>

      <div className="mt-4 rounded-sm border-2 border-destructive/70 bg-card/50 p-4 text-center">
        <p className="font-arcade flex items-center justify-center gap-2 text-[8px] uppercase text-destructive">
          <Siren className="h-4 w-4" /> Nível de pânico
        </p>
        <p className="font-arcade mt-2 text-2xl text-destructive text-glow">
          {cliquesPanico === null ? "—" : cliquesPanico.toLocaleString("pt-BR")}
        </p>
        <div className="mx-auto mt-3 h-2.5 w-full max-w-xs overflow-hidden rounded-sm border border-destructive/60">
          <div
            className="h-full bg-destructive transition-[width] duration-200"
            style={{ width: `${Math.min(100, ((cliquesPanico ?? 0) / META_PANICO) * 100)}%` }}
          />
        </div>
        {restantePanico !== null ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Faltam {restantePanico.toLocaleString("pt-BR")} para o alerta disparar
          </p>
        ) : null}
      </div>

      <div className="mt-4 rounded-sm border-2 border-whisky/60 bg-card/50 p-4">
        <p className="font-arcade text-[8px] uppercase text-whisky">Pacientes recentes</p>
        {pacientes === null ? (
          <p className="mt-3 text-[12px] text-muted-foreground">Carregando…</p>
        ) : pacientes.length === 0 ? (
          <p className="mt-3 text-[12px] text-muted-foreground">Ninguém internado ainda.</p>
        ) : (
          <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
            {pacientes.slice(0, 30).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5 text-[12px] last:border-0"
              >
                <span className="truncate text-foreground">{p.nome}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {new Date(p.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 rounded-sm border-2 border-purple/60 bg-card/50 p-4">
        <p className="font-arcade text-[8px] uppercase text-purple">Fotos recentes</p>
        {fotos === null ? (
          <p className="mt-3 text-[12px] text-muted-foreground">Carregando…</p>
        ) : fotos.length === 0 ? (
          <p className="mt-3 text-[12px] text-muted-foreground">Nenhuma foto registrada ainda.</p>
        ) : (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {fotos.slice(0, 16).map((f) =>
              f.url ? (
                <img
                  key={f.id}
                  src={f.url}
                  alt={`Registro de ${f.autor}`}
                  loading="lazy"
                  className="aspect-square w-full rounded-sm border border-purple/40 object-cover"
                />
              ) : (
                <div
                  key={f.id}
                  title={`${f.autor} — ainda sob embargo`}
                  className="grid aspect-square w-full place-items-center rounded-sm border border-purple/40 bg-background/60"
                >
                  <CameraIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {erroExport ? (
        <p role="alert" className="mt-3 text-center text-[11px] text-destructive">
          {erroExport}
        </p>
      ) : null}

      <ArcadeButton
        tone="purple"
        onClick={() => void exportarMural()}
        disabled={exportando}
        className="mt-4 flex w-full items-center justify-center gap-2 py-4 text-[10px] uppercase"
      >
        <Download className="h-4 w-4" />
        {exportando ? "Exportando…" : "Exportar mural para CSV"}
      </ArcadeButton>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
        Antes de 30/10 ao meio-dia, mensagens e fotos ainda sob embargo saem sem o conteúdo — o
        painel respeita a mesma revelação que os convidados veem.
      </p>
    </section>
  );
}
