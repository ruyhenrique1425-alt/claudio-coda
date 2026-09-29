import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Plus, RotateCcw, Save, Trash2 } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { CartaoPixel } from "@/components/CartaoPixel";
import { apagarConquistaBar, salvarConquistaBar, type CampoConquistaBar } from "@/lib/bar-admin";
import { supabase } from "@/integrations/supabase/client";
import { comPrazo } from "@/lib/rede";

export const Route = createFileRoute("/bar-admin")({
  head: () => ({
    meta: [
      { title: "Administração do bar" },
      {
        name: "description",
        content: "Cadastre novos códigos de QR code e suas conquistas, sem editar o código-fonte.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BarAdminPage,
});

const SENHA_KEY = "sanatorio:senha-oficina";
const RESERVADOS = new Set(["bemvindo", "van", "bar", "xeque", "privada"]);

type Linha = { codigo: string; titulo: string; onde_fica: string; legenda: string; fichas: number };

const VAZIO: CampoConquistaBar = { codigo: "", titulo: "", ondeFica: "", legenda: "", fichas: 30 };

function BarAdminPage() {
  const [senha, setSenha] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);
  const [campos, setCampos] = useState<CampoConquistaBar>(VAZIO);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    try {
      const guardada = sessionStorage.getItem(SENHA_KEY);
      if (guardada) setSenha(guardada);
    } catch {
      /* sem sessionStorage: segue sem lembrar a senha */
    }
  }, []);

  async function recarregar() {
    const { data } = await comPrazo(
      Promise.resolve(supabase.from("conquistas_bar").select("*").order("criado_em")),
    );
    setLinhas((data ?? []).filter((l) => !RESERVADOS.has(l.codigo)));
  }

  useEffect(() => {
    void recarregar()
      .catch(() => setErro("Não deu para ler os códigos cadastrados. Tente recarregar a tela."))
      .finally(() => setCarregando(false));
  }, []);

  function guardarSenha(v: string) {
    setSenha(v);
    try {
      sessionStorage.setItem(SENHA_KEY, v);
    } catch {
      /* sem sessionStorage: a senha só dura enquanto a tela estiver aberta */
    }
  }

  function novo() {
    setEditando(null);
    setCampos(VAZIO);
    setErro(null);
    setAviso(null);
  }

  function editar(l: Linha) {
    setEditando(l.codigo);
    setCampos({
      codigo: l.codigo,
      titulo: l.titulo,
      ondeFica: l.onde_fica,
      legenda: l.legenda,
      fichas: l.fichas,
    });
    setErro(null);
    setAviso(null);
  }

  async function salvar() {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      await salvarConquistaBar(senha, { ...campos, codigo: campos.codigo.trim().toLowerCase() });
      await recarregar();
      setAviso("Salvo. O QR code dele já está pronto em /qrcodes.");
      setEditando(campos.codigo.trim().toLowerCase());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar.");
    } finally {
      setOcupado(false);
    }
  }

  async function apagar(codigo: string) {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      await apagarConquistaBar(senha, codigo);
      await recarregar();
      if (editando === codigo) novo();
      setAviso("Código removido.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para apagar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section>
      <CartaoPixel tom="whisky" className="text-center">
        <h1 className="font-arcade text-[11px] uppercase leading-relaxed text-whisky text-glow">
          Administração do bar
        </h1>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          Cadastre novos códigos de QR code e a conquista de cada um. As cinco conquistas originais
          não aparecem aqui — elas são fixas.
        </p>
      </CartaoPixel>

      <div className="mt-4 rounded-sm border-2 border-whisky bg-card/50 p-3">
        <label
          htmlFor="senha-bar-admin"
          className="font-arcade flex items-center gap-2 text-[8px] uppercase text-whisky"
        >
          <Lock className="h-3.5 w-3.5" /> Senha (a mesma da oficina de personagens)
        </label>
        <input
          id="senha-bar-admin"
          type="password"
          value={senha}
          onChange={(e) => guardarSenha(e.target.value)}
          placeholder="Senha"
          className="tap-44 mt-2 w-full rounded-sm border-2 border-whisky/50 bg-background px-3 py-3 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-whisky"
        />
      </div>

      {carregando ? (
        <p className="mt-4 text-center text-[12px] text-muted-foreground">Abrindo a lista…</p>
      ) : (
        <>
          {linhas.length > 0 ? (
            <div className="mt-4 space-y-2">
              {linhas.map((l) => (
                <button
                  key={l.codigo}
                  type="button"
                  onClick={() => editar(l)}
                  className={`w-full rounded-sm border-2 p-3 text-left transition-colors ${
                    editando === l.codigo ? "border-neon bg-neon/10" : "border-purple/50 bg-card/30"
                  }`}
                >
                  <p className="font-arcade text-[9px] uppercase text-foreground">{l.titulo}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    /q/{l.codigo} · {l.onde_fica} · {l.fichas} fichas
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-center text-[12px] text-muted-foreground">
              Nenhum código extra cadastrado ainda.
            </p>
          )}

          <ArcadeButton
            tone="purple"
            onClick={novo}
            className="mt-4 flex w-full items-center justify-center gap-2 py-3 text-[9px] uppercase"
          >
            <Plus className="h-4 w-4" /> Novo código
          </ArcadeButton>

          <div className="mt-4 space-y-3">
            <Campo label="Código (vira a URL /q/código — minúsculas, sem espaço)">
              <input
                value={campos.codigo}
                onChange={(e) => setCampos((c) => ({ ...c, codigo: e.target.value }))}
                disabled={editando !== null}
                placeholder="ex: piscina"
                maxLength={32}
                className="tap-44 w-full rounded-sm border-2 border-purple/60 bg-background px-3 py-2 font-mono text-[13px] text-foreground outline-none focus:border-neon disabled:opacity-50"
              />
            </Campo>

            <Campo label="Título">
              <input
                value={campos.titulo}
                onChange={(e) => setCampos((c) => ({ ...c, titulo: e.target.value }))}
                maxLength={60}
                className="tap-44 w-full rounded-sm border-2 border-purple/60 bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-neon"
              />
            </Campo>

            <Campo label="Onde fica">
              <input
                value={campos.ondeFica}
                onChange={(e) => setCampos((c) => ({ ...c, ondeFica: e.target.value }))}
                maxLength={60}
                className="tap-44 w-full rounded-sm border-2 border-purple/60 bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-neon"
              />
            </Campo>

            <Campo label="Legenda">
              <textarea
                value={campos.legenda}
                onChange={(e) => setCampos((c) => ({ ...c, legenda: e.target.value }))}
                maxLength={200}
                rows={3}
                className="w-full rounded-sm border-2 border-purple/60 bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-neon"
              />
            </Campo>

            <Campo label="Fichas (1 a 100)">
              <input
                type="number"
                min={1}
                max={100}
                value={campos.fichas}
                onChange={(e) => setCampos((c) => ({ ...c, fichas: Number(e.target.value) || 0 }))}
                className="tap-44 w-full rounded-sm border-2 border-purple/60 bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-neon"
              />
            </Campo>
          </div>

          {erro ? (
            <p role="alert" className="mt-3 text-center text-[11px] text-destructive">
              {erro}
            </p>
          ) : null}
          {aviso ? <p className="mt-3 text-center text-[11px] text-neon">{aviso}</p> : null}

          <ArcadeButton
            onClick={() => void salvar()}
            disabled={ocupado || !senha || !campos.codigo.trim() || !campos.titulo.trim()}
            className="mt-4 flex w-full items-center justify-center gap-2 py-4 text-[10px] uppercase"
          >
            <Save className="h-4 w-4" />
            {ocupado ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar código"}
          </ArcadeButton>

          {editando ? (
            <ArcadeButton
              tone="vermelho"
              onClick={() => void apagar(editando)}
              disabled={ocupado || !senha}
              className="mt-3 flex w-full items-center justify-center gap-2 py-3 text-[9px] uppercase"
            >
              <Trash2 className="h-4 w-4" />
              Apagar este código
            </ArcadeButton>
          ) : null}

          <ArcadeButton
            tone="whisky"
            onClick={novo}
            disabled={ocupado}
            className="mt-3 flex w-full items-center justify-center gap-2 py-3 text-[9px] uppercase"
          >
            <RotateCcw className="h-4 w-4" />
            Limpar formulário
          </ArcadeButton>

          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            O QR code de cada código sai pronto para imprimir em{" "}
            <span className="text-neon">/qrcodes</span>.
          </p>
        </>
      )}
    </section>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-arcade mb-1.5 block text-[7px] uppercase text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
