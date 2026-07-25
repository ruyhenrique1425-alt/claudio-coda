import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, Snowflake, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { IDEAL_TEMP, type Severity } from "@/lib/operacao";
import {
  BrandChip,
  StatePill,
  SEVERITY_STYLES,
  useBarsRows,
  type BarRow,
} from "@/lib/bars-dashboard";

export const Route = createFileRoute("/app/bares")({
  head: () => ({
    meta: [
      { title: "Todos os Bares · Dispel Operação" },
      { name: "description", content: "Lista completa dos bares com status, temperatura e reposição." },
      { property: "og:title", content: "Todos os Bares · Dispel Operação" },
      { property: "og:description", content: "Lista completa dos bares com status, temperatura e reposição." },
    ],
  }),
  component: BaresPage,
});

function BaresPage() {
  const nav = useNavigate();
  const { data: rows = [], isLoading } = useBarsRows();
  const [tempPhoto, setTempPhoto] = useState<
    | { barName: string; temperatura: number; slot: string | null; at: string | null; url: string | null; loading: boolean }
    | null
  >(null);

  const openTempPhoto = async (r: BarRow) => {
    setTempPhoto({
      barName: r.name,
      temperatura: r.bestTempToday as number,
      slot: r.bestTempSlot,
      at: r.bestTempAt,
      url: null,
      loading: true,
    });
    if (!r.bestTempPhoto) {
      setTempPhoto((p) => (p ? { ...p, loading: false } : p));
      return;
    }
    try {
      const { data } = await supabase.storage
        .from("operacao-fotos")
        .createSignedUrl(r.bestTempPhoto, 60 * 60);
      setTempPhoto((p) => (p ? { ...p, loading: false, url: data?.signedUrl ?? null } : p));
    } catch {
      setTempPhoto((p) => (p ? { ...p, loading: false } : p));
    }
  };

  const goReposicao = (barId: string) =>
    nav({ to: "/app/bars/$barId", params: { barId }, search: { tab: "reposicao" } });
  const goInventario = (barId: string) =>
    nav({ to: "/app/bars/$barId", params: { barId }, search: { tab: "inventario" } });

  const sorted = [...rows].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-3">
      <div>
        <h1 className="font-display text-xl tracking-wider">TODOS OS BARES</h1>
        <p className="text-[11px] text-muted-foreground tracking-widest uppercase">
          {rows.length} {rows.length === 1 ? "bar" : "bares"} · ordem alfabética
        </p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-1/3 bg-muted/70 animate-pulse rounded" />
                </div>
                <div className="h-6 w-16 bg-muted animate-pulse rounded" />
              </div>
            </Card>
          ))}
        </div>
      )}
      {!isLoading && sorted.length === 0 && (
        <Card className="p-4 text-sm text-muted-foreground">Nenhum bar cadastrado.</Card>
      )}
      <div className="space-y-2">
        {sorted.map((r) => {
          const state = !r.hasInventory ? "no_inv" : r.severity !== "ok" ? "refill" : "ok";
          const sev =
            r.severity !== "ok" ? SEVERITY_STYLES[r.severity as Exclude<Severity, "ok">] : null;
          const abaixoPadrao =
            r.hasInventory &&
            (r.cheios.heineken < r.standards.heineken || r.cheios.amstel < r.standards.amstel);
          const acimaPadrao =
            r.hasInventory &&
            !abaixoPadrao &&
            (r.cheios.heineken > r.standards.heineken || r.cheios.amstel > r.standards.amstel);
          return (
            <Card
              key={r.id}
              className={`p-3 hover:border-primary transition ${abaixoPadrao ? "border-destructive/60" : acimaPadrao ? "border-yellow-400" : ""}`}
            >
              {(abaixoPadrao || acimaPadrao) && (
                <div
                  className={`mb-2 rounded px-2 py-1 text-[10px] font-bold tracking-wider animate-pulse ${abaixoPadrao ? "bg-destructive/15 text-destructive" : "bg-yellow-100 text-yellow-800"}`}
                >
                  {abaixoPadrao
                    ? "⚠ ATENÇÃO · ESTOQUE ABAIXO DO PADRÃO"
                    : "⚡ BAR FORA DO PADRÃO ESTABELECIDO"}
                </div>
              )}
              <div className="flex items-center gap-3">
                <button onClick={() => goInventario(r.id)} className="shrink-0">
                  <StatePill state={state} severity={r.severity} count={r.totalNeeded} />
                </button>
                <button onClick={() => goInventario(r.id)} className="flex-1 min-w-0 text-left">
                  <div className="font-display text-base truncate">{r.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {state === "refill" && sev && (
                      <span className={`font-bold ${sev.text}`}>{sev.label}</span>
                    )}
                    {state === "no_inv" && "Faça o primeiro inventário"}
                    {state === "ok" &&
                      (r.hasInventory
                        ? `Tudo em ordem · ${r.fillPct}% do padrão`
                        : r.apoio_responsavel
                          ? `Apoio: ${r.apoio_responsavel}`
                          : "Tudo em ordem")}
                  </div>

                  {r.hasInventory &&
                    (r.needed.heineken > 0 || r.needed.amstel > 0 || state === "refill") && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <BrandChip
                          brand="heineken"
                          need={r.needed.heineken}
                          fill={r.fillByBrand.heineken}
                          sev={r.sevByBrand.heineken}
                        />
                        <BrandChip
                          brand="amstel"
                          need={r.needed.amstel}
                          fill={r.fillByBrand.amstel}
                          sev={r.sevByBrand.amstel}
                        />
                      </div>
                    )}
                  {r.bestTempToday !== null && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        openTempPhoto(r);
                      }}
                      className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 hover:text-primary transition"
                      title="Ver foto do termômetro"
                    >
                      <Snowflake className="w-3 h-3" />
                      Mais gelado hoje:{" "}
                      <b className={r.bestTempToday <= IDEAL_TEMP ? "text-primary" : "text-accent"}>
                        {r.bestTempToday.toFixed(1)}°C
                      </b>
                    </button>
                  )}
                  {r.lastAt && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Últ. inv.: {new Date(r.lastAt).toLocaleDateString("pt-BR")}{" "}
                      {new Date(r.lastAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {r.lastBy && (
                        <>
                          {" "}
                          · por <b className="text-foreground">{r.lastBy}</b>
                        </>
                      )}
                    </div>
                  )}
                </button>
                {state === "refill" && sev ? (
                  <Button
                    size="sm"
                    className={`${sev.badgeBg} ${sev.badgeText} hover:brightness-95`}
                    onClick={() => goReposicao(r.id)}
                  >
                    <Truck className="w-3.5 h-3.5 mr-1" />
                    Repor
                  </Button>
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!tempPhoto} onOpenChange={(o) => !o && setTempPhoto(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">
              {tempPhoto?.barName}
            </DialogTitle>
          </DialogHeader>
          {tempPhoto && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Snowflake
                  className={`w-5 h-5 ${tempPhoto.temperatura <= IDEAL_TEMP ? "text-primary" : "text-accent"}`}
                />
                <div
                  className={`font-display text-3xl ${tempPhoto.temperatura <= IDEAL_TEMP ? "text-primary" : "text-accent"}`}
                >
                  {tempPhoto.temperatura.toFixed(1)}°C
                </div>
                {tempPhoto.temperatura <= IDEAL_TEMP && (
                  <span className="text-[10px] font-bold tracking-wider bg-primary/15 text-primary px-2 py-0.5 rounded">
                    ★ SUPER GELADO
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {tempPhoto.slot && <>Slot {tempPhoto.slot.replace("t_", "")}h · </>}
                {tempPhoto.at &&
                  new Date(tempPhoto.at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
              </div>
              <div className="rounded-lg overflow-hidden border border-border bg-muted min-h-[240px] grid place-items-center">
                {tempPhoto.loading ? (
                  <div className="text-xs text-muted-foreground p-6">Carregando foto…</div>
                ) : tempPhoto.url ? (
                  <img
                    src={tempPhoto.url}
                    alt={`Termômetro em ${tempPhoto.barName}`}
                    className="w-full h-auto max-h-[70vh] object-contain"
                  />
                ) : (
                  <div className="text-xs text-muted-foreground p-6">
                    Foto do termômetro indisponível.
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
