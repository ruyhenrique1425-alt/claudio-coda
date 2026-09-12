import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, Lock, ShoppingBag } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { CartaoPixel } from "@/components/CartaoPixel";
import { PixelAvatar } from "@/components/avatar/PixelAvatar";
import { Moldura, NomeDoPaciente } from "@/components/Moldura";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ITENS_LOJA, normalizarInventario, type ItemLoja, type Slot } from "@/lib/loja";
import { lerProntuario, type Prontuario } from "@/lib/paciente-local";
import { comprarItem, equiparItem, lerCarteira } from "@/lib/pontos";

export const Route = createFileRoute("/loja")({
  head: () => ({
    meta: [
      { title: "Loja do Sanatório — molduras e adereços" },
      {
        name: "description",
        content:
          "Troque suas fichas por molduras, adereços de avatar e efeitos de nome que os outros pacientes veem.",
      },
      { property: "og:title", content: "Loja do Sanatório" },
      { property: "og:description", content: "Fichas viram moldura, adereço e efeito de nome." },
    ],
  }),
  component: LojaPage,
});

const SLOTS: { id: Slot; titulo: string }[] = [
  { id: "moldura", titulo: "Molduras" },
  { id: "adereco", titulo: "Adereços" },
  { id: "nome", titulo: "Nome" },
];

function LojaPage() {
  const [eu, setEu] = useState<Prontuario | null>(null);
  const [saldo, setSaldo] = useState(0);
  const [itens, setItens] = useState<unknown>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Slot>("moldura");

  const recarregar = useCallback(async (pacienteId: string) => {
    const [carteira, ficha] = await Promise.all([
      lerCarteira(pacienteId),
      supabase.from("pacientes_publicos").select("itens").eq("id", pacienteId).maybeSingle(),
    ]);
    setSaldo(carteira.saldo);
    setItens(ficha.data?.itens ?? {});
  }, []);

  useEffect(() => {
    const p = lerProntuario();
    setEu(p);
    if (p?.pacienteId) void recarregar(p.pacienteId).catch(() => undefined);
  }, [recarregar]);

  const inventario = normalizarInventario(itens);

  async function comprar(item: ItemLoja) {
    if (!eu?.pacienteId) return;
    setOcupado(item.id);
    setErro(null);
    try {
      await comprarItem(item.id, item.preco);
      await equiparItem(item.slot, item.id);
      await recarregar(eu.pacienteId);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "A compra não passou.");
    } finally {
      setOcupado(null);
    }
  }

  async function equipar(item: ItemLoja | null, slot: Slot) {
    if (!eu?.pacienteId) return;
    setOcupado(item?.id ?? slot);
    setErro(null);
    try {
      await equiparItem(slot, item?.id ?? null);
      await recarregar(eu.pacienteId);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para equipar.");
    } finally {
      setOcupado(null);
    }
  }

  if (!eu) {
    return (
      <section className="rounded-sm border-2 border-purple bg-card/50 p-5 text-center">
        <ShoppingBag className="mx-auto h-7 w-7 text-whisky" />
        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          Faça sua ficha de admissão para abrir a loja. Sem prontuário, sem fichas.
        </p>
      </section>
    );
  }

  return (
    <section>
      <CartaoPixel tom="whisky">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-arcade text-[10px] uppercase text-whisky text-glow">Loja da ala</h1>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              O que você equipa aqui aparece no seu card para os outros pacientes.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-arcade text-[7px] uppercase text-muted-foreground">Fichas</p>
            <p className="font-arcade text-lg text-whisky text-glow">{saldo}</p>
          </div>
        </div>

        {/* Prévia ao vivo com o que já está equipado. */}
        <div className="mt-4 flex items-center gap-3 rounded-sm border border-neon/40 bg-background/60 p-3">
          <Moldura itens={itens}>
            <PixelAvatar personagem={eu.personagem} avatar={eu.avatar} size="md" glow />
          </Moldura>
          <span className="font-arcade min-w-0 truncate text-[10px] uppercase text-foreground">
            <NomeDoPaciente nome={eu.nome} itens={itens} />
          </span>
        </div>
      </CartaoPixel>

      {erro ? (
        <p role="alert" className="mt-3 text-center text-[11px] text-destructive">
          {erro}
        </p>
      ) : null}

      <Tabs value={aba} onValueChange={(v) => setAba(v as Slot)} className="mt-4">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-sm border-2 border-purple bg-card/50 p-1">
          {SLOTS.map((s) => (
            <TabsTrigger
              key={s.id}
              value={s.id}
              className="font-arcade rounded-sm px-1 py-3 text-[8px] uppercase text-muted-foreground data-[state=active]:bg-purple/40 data-[state=active]:text-neon"
            >
              {s.titulo}
            </TabsTrigger>
          ))}
        </TabsList>

        {SLOTS.map((s) => (
          <TabsContent key={s.id} value={s.id} className="mt-4 space-y-3">
            {inventario.equipados[s.id] ? (
              <button
                onClick={() => void equipar(null, s.id)}
                className="font-arcade w-full rounded-sm border border-muted-foreground/60 py-2 text-[8px] uppercase text-muted-foreground"
              >
                Desequipar {s.titulo.toLowerCase()}
              </button>
            ) : null}

            {ITENS_LOJA.filter((i) => i.slot === s.id).map((item) => {
              const comprado = inventario.comprados.includes(item.id);
              const usando = inventario.equipados[s.id] === item.id;
              const falta = item.preco - saldo;
              const travado = !comprado && falta > 0;

              return (
                <motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-sm border-2 p-3 ${
                    usando
                      ? "border-neon bg-neon/10"
                      : travado
                        ? "border-muted-foreground/30 bg-card/30 opacity-50"
                        : "border-purple/60 bg-card/50"
                  }`}
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                    <Moldura itens={usando || comprado ? itens : {}}>
                      <PixelAvatar personagem={eu.personagem} avatar={eu.avatar} size="sm" />
                    </Moldura>

                    <div className="min-w-0">
                      <p className="font-arcade text-[9px] uppercase leading-relaxed text-foreground">
                        {item.nome}
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                        {item.descricao}
                      </p>
                    </div>

                    <span
                      className={`font-arcade shrink-0 text-[10px] ${
                        travado ? "text-destructive" : "text-whisky"
                      }`}
                    >
                      {item.preco}
                    </span>
                  </div>

                  <div className="mt-3">
                    {usando ? (
                      <p className="font-arcade flex items-center justify-center gap-2 py-2 text-[8px] uppercase text-neon">
                        <Check className="h-4 w-4" />
                        Equipado
                      </p>
                    ) : comprado ? (
                      <ArcadeButton
                        onClick={() => void equipar(item, s.id)}
                        disabled={ocupado === item.id}
                        className="w-full py-3 text-[9px] uppercase"
                      >
                        Equipar
                      </ArcadeButton>
                    ) : travado ? (
                      <p className="font-arcade flex items-center justify-center gap-2 py-2 text-[8px] uppercase text-destructive">
                        <Lock className="h-3.5 w-3.5" />
                        Faltam {falta} fichas
                      </p>
                    ) : (
                      <ArcadeButton
                        tone="whisky"
                        onClick={() => void comprar(item)}
                        disabled={ocupado === item.id}
                        className="w-full py-3 text-[9px] uppercase"
                      >
                        {ocupado === item.id ? "Comprando…" : `Comprar por ${item.preco}`}
                      </ArcadeButton>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
