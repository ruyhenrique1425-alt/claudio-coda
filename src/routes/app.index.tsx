import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  PackageOpen,
  Beer,
  Warehouse,
  Snowflake,
  Thermometer,
  ClipboardCheck,
  Truck,
  Trophy,
  Bell,
  ListOrdered,
} from "lucide-react";

import {
  IDEAL_TEMP,
  TEMP_ALERTA,
  SEVERITY_ORDER,
  type Severity,
} from "@/lib/operacao";
import {
  BRANDS,
  ESTADOS,
  ESTADO_LABEL,
  TEMP_SLOTS,
  BRAND_LABEL,
  BRAND_ACCENT,
  SEVERITY_STYLES,
  BrandChip,
  useBarsRows,
  type Brand,
  type Estado,
  type BarRow,
} from "@/lib/bars-dashboard";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const nav = useNavigate();
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

  const { data: rows = [] } = useBarsRows();

  const totalHein = rows.reduce((a, r) => a + r.needed.heineken, 0);
  const totalAms = rows.reduce((a, r) => a + r.needed.amstel, 0);
  const semInv = rows.filter((r) => !r.hasInventory).length;

  // ===== CONSUMO =====
  type Periodo = "hoje" | "7d" | "tudo";
  type Fonte = "vazios" | "meep";
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const [fonte, setFonte] = useState<Fonte>("vazios");

  const desde = useMemo(() => {
    if (periodo === "tudo") return null;
    const d = new Date();
    if (periodo === "hoje") d.setHours(0, 0, 0, 0);
    else {
      d.setDate(d.getDate() - 6);
      d.setHours(0, 0, 0, 0);
    }
    return d;
  }, [periodo]);

  const { data: vaziosFlow = [] } = useQuery({
    queryKey: ["dashboard-vazios", periodo],
    queryFn: async () => {
      let q = supabase.from("empties_removed").select("bar_id,brand,quantidade,performed_at");
      if (desde) q = q.gte("performed_at", desde.toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: meepFlow } = useQuery({
    queryKey: ["dashboard-meep", periodo],
    queryFn: async () => {
      try {
        let q = (supabase as any).from("meep_consumo_bar").select("bar_nome,data,marca,barris");
        if (desde) q = q.gte("data", desde.toISOString().slice(0, 10));
        const res = await q;
        if (res.error) return { ready: false, rows: [] as any[] };
        return { ready: true, rows: (res.data ?? []) as any[] };
      } catch {
        return { ready: false, rows: [] as any[] };
      }
    },
  });
  const meepReady = meepFlow?.ready ?? false;

  const { data: estoques = [] } = useQuery({
    queryKey: ["dashboard-estoques"],
    queryFn: async () => {
      const [{ data: whs }, { data: stock }] = await Promise.all([
        supabase.from("warehouses").select("id,code,name"),
        supabase.from("warehouse_stock").select("warehouse_id,brand,barrels"),
      ]);
      const byWh: Record<string, Record<Brand, number>> = {};
      (stock ?? []).forEach((s: any) => {
        byWh[s.warehouse_id] ??= { heineken: 0, amstel: 0 };
        byWh[s.warehouse_id][s.brand as Brand] = s.barrels ?? 0;
      });
      return (whs ?? []).map((w: any) => ({
        code: String(w.code ?? ""),
        name: String(w.name ?? ""),
        stock: byWh[w.id] ?? { heineken: 0, amstel: 0 },
      }));
    },
  });

  const consumo = useMemo(() => {
    const porBar = new Map<string, { nome: string; heineken: number; amstel: number }>();
    const nomePorId = new Map(rows.map((r) => [r.id, r.name]));

    if (fonte === "vazios") {
      (vaziosFlow as any[]).forEach((e) => {
        const nome = nomePorId.get(e.bar_id);
        if (!nome) return;
        const br = e.brand as Brand;
        const cur = porBar.get(e.bar_id) ?? { nome, heineken: 0, amstel: 0 };
        if (br === "heineken" || br === "amstel") cur[br] += Number(e.quantidade) || 0;
        porBar.set(e.bar_id, cur);
      });
    } else {
      (meepFlow?.rows ?? []).forEach((m: any) => {
        const nome = String(m.bar_nome ?? "");
        if (!nome) return;
        const br = m.marca === "heineken" ? "heineken" : m.marca === "amstel" ? "amstel" : null;
        const cur = porBar.get(nome) ?? { nome, heineken: 0, amstel: 0 };
        if (br) cur[br] += Number(m.barris) || 0;
        porBar.set(nome, cur);
      });
    }

    const lista = Array.from(porBar.values())
      .map((b) => ({ ...b, total: b.heineken + b.amstel }))
      .filter((b) => b.total !== 0)
      .sort((a, b) => b.total - a.total);
    const totH = lista.reduce((s, b) => s + b.heineken, 0);
    const totA = lista.reduce((s, b) => s + b.amstel, 0);
    return { lista, heineken: totH, amstel: totA, total: totH + totA };
  }, [fonte, vaziosFlow, meepFlow, rows]);

  const precisaRepor = rows
    .filter((r) => r.hasInventory && r.severity !== "ok")
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.totalNeeded - a.totalNeeded);

  // Missões pendentes hoje
  const nowH = new Date().getHours();
  type PendingMission = { barId: string; barName: string; kind: "temp" | "org"; label: string };
  const pendingMissions: PendingMission[] = [];
  rows.forEach((r) => {
    TEMP_SLOTS.forEach((s) => {
      if (nowH >= s.hour && !r.tempsToday[s.v]) {
        pendingMissions.push({
          barId: r.id,
          barName: r.name,
          kind: "temp",
          label: `Temperatura ${s.l}`,
        });
      }
    });
    if (!r.orgToday)
      pendingMissions.push({
        barId: r.id,
        barName: r.name,
        kind: "org",
        label: "Check organização",
      });
  });

  const choppQuente = rows
    .filter((r) => r.worstTempToday !== null && (r.worstTempToday as number) > TEMP_ALERTA)
    .sort((a, b) => (b.worstTempToday as number) - (a.worstTempToday as number));

  const coldRanking = rows
    .filter((r) => r.bestTempToday !== null)
    .sort((a, b) => (a.bestTempToday as number) - (b.bestTempToday as number))
    .slice(0, 5);

  const goReposicao = (barId: string) =>
    nav({ to: "/app/bars/$barId", params: { barId }, search: { tab: "reposicao" } });
  const goMissoes = (barId: string) =>
    nav({ to: "/app/bars/$barId", params: { barId }, search: { tab: "missoes" } });

  // ===== RESUMO EXECUTIVO =====
  const estoqueBaresH = rows.reduce((a, r) => a + r.cheios.heineken, 0);
  const estoqueBaresA = rows.reduce((a, r) => a + r.cheios.amstel, 0);
  const totalPadraoH = rows.reduce((a, r) => a + r.standards.heineken, 0);
  const totalPadraoA = rows.reduce((a, r) => a + r.standards.amstel, 0);
  const totalPadrao = totalPadraoH + totalPadraoA;
  const totalCheios = estoqueBaresH + estoqueBaresA;
  const saudePct = totalPadrao > 0 ? Math.round((totalCheios / totalPadrao) * 100) : 100;
  const baresOK = rows.filter((r) => r.hasInventory && r.severity === "ok").length;
  const baresAlerta = rows.filter((r) => r.hasInventory && r.severity !== "ok").length;

  // ===== Barris por estado e por marca =====
  const porEstado: Record<Brand, Record<Estado, number>> = {
    heineken: { plugado: 0, fechado: 0, vazio: 0 },
    amstel: { plugado: 0, fechado: 0, vazio: 0 },
  };
  rows.forEach((r) =>
    BRANDS.forEach((br) =>
      ESTADOS.forEach((st) => {
        porEstado[br][st] += r.estados[br][st];
      }),
    ),
  );
  // Soma "recolhidos + ainda no bar" só vale no período TUDO e fonte vazios:
  // fora disso misturaria fluxo de janela com foto do momento (sem dupla
  // contagem — o "a recolher" já desconta o que saiu após o inventário).
  const somaEvento = periodo === "tudo" && fonte === "vazios";

  const totalPorEstado: Record<Estado, number> = {
    plugado: porEstado.heineken.plugado + porEstado.amstel.plugado,
    fechado: porEstado.heineken.fechado + porEstado.amstel.fechado,
    vazio: porEstado.heineken.vazio + porEstado.amstel.vazio,
  };
  const aRecolherTotal = totalPorEstado.vazio;

  const estoqueDispel = estoques.find((e) => e.code.toLowerCase() === "dispel");
  const estoqueAllstar = estoques.find((e) => e.code.toLowerCase() === "allstar");
  const estoqueTotalGeral = estoques.reduce(
    (s, e) => s + e.stock.heineken + e.stock.amstel,
    0,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl tracking-wider">CENTRAL DE OPERAÇÃO</h1>
          <p className="text-[11px] text-muted-foreground tracking-widest uppercase">
            Hoje · {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/bares">
              <ListOrdered className="w-4 h-4 mr-1" />
              Todos os Bares
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/map">
              <MapPin className="w-4 h-4 mr-1" />
              Mapa
            </Link>
          </Button>
        </div>
      </div>

      {/* 1. BARRIS NOS BARES POR ESTADO */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Beer className="w-4 h-4 text-primary" />
          <h2 className="font-display text-sm tracking-widest text-muted-foreground">
            BARRIS NOS BARES POR ESTADO
          </h2>
          <Link to="/app/operacao" className="ml-auto text-[11px] text-muted-foreground underline">
            ver Barris
          </Link>
        </div>
        <Card className="p-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="text-left py-1 pr-2">Marca</th>
                  {ESTADOS.map((st) => (
                    <th key={st} className="py-1 px-2 text-right">
                      {ESTADO_LABEL[st]}
                    </th>
                  ))}
                  <th className="py-1 pl-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {BRANDS.map((br) => {
                  const e = porEstado[br];
                  const tot = e.plugado + e.fechado + e.vazio;
                  return (
                    <tr key={br} className="border-t border-border/50">
                      <td className="py-1.5 pr-2 flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${BRAND_ACCENT[br].dot}`}
                          aria-hidden
                        />
                        {BRAND_LABEL[br]}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{e.plugado}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{e.fechado}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums font-bold text-accent">
                        {e.vazio}
                      </td>
                      <td className="py-1.5 pl-2 text-right tabular-nums font-bold">{tot}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-border">
                  <td className="py-1.5 pr-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                    Total
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums font-bold">
                    {totalPorEstado.plugado}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums font-bold">
                    {totalPorEstado.fechado}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums font-bold text-accent">
                    {totalPorEstado.vazio}
                  </td>
                  <td className="py-1.5 pl-2 text-right tabular-nums font-bold">
                    {totalPorEstado.plugado + totalPorEstado.fechado + totalPorEstado.vazio}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Foto do último inventário de cada bar. Plugado = na torneira · Fechado = cheio de
            reserva · Vazio = já consumido, a recolher.
          </p>
        </Card>
      </div>

      {/* 2. ESTOQUE NOS ARMAZÉNS */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Warehouse className="w-4 h-4 text-primary" />
          <h2 className="font-display text-sm tracking-widest text-muted-foreground">
            ESTOQUE NOS ARMAZÉNS
          </h2>
          <span className="ml-auto font-display text-sm">{estoqueTotalGeral} barris</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <EstoqueCard nome="DISPEL" stock={estoqueDispel?.stock} />
          <EstoqueCard nome="ALLSTAR" stock={estoqueAllstar?.stock} />
        </div>
      </div>

      {/* 3. RESUMO EXECUTIVO */}
      <Card className="p-3 bg-gradient-to-br from-primary/8 via-primary/4 to-accent/8 border-primary/20">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-[11px] tracking-[0.25em] text-primary/80">
            RESUMO EXECUTIVO
          </h2>
          <span className="text-[10px] text-muted-foreground tracking-wider">
            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-background/60 border p-2">
            <div className="text-[9px] tracking-widest text-muted-foreground uppercase">
              Saúde da Operação
            </div>
            <div
              className={`font-display text-2xl leading-tight ${saudePct >= 70 ? "text-green-600" : saudePct >= 40 ? "text-orange-500" : "text-red-600"}`}
            >
              {saudePct}
              <span className="text-sm">%</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              <span className="text-green-600 font-semibold">{baresOK}</span> ok ·{" "}
              <span className="text-red-600 font-semibold">{baresAlerta}</span> alerta
            </div>
          </div>
          <div className="rounded-lg bg-background/60 border p-2">
            <div className="text-[9px] tracking-widest text-muted-foreground uppercase">
              Estoque Nos Bares
            </div>
            <div className="font-display text-2xl leading-tight text-primary">
              {totalCheios}
              <span className="text-xs text-muted-foreground">/{totalPadrao}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              H <span className="font-semibold">{estoqueBaresH}</span> · A{" "}
              <span className="font-semibold">{estoqueBaresA}</span>
            </div>
          </div>
          <div className="rounded-lg bg-background/60 border p-2">
            <div className="text-[9px] tracking-widest text-muted-foreground uppercase">
              Repor Agora
            </div>
            <div
              className={`font-display text-2xl leading-tight ${totalHein + totalAms > 0 ? "text-orange-600" : "text-green-600"}`}
            >
              {totalHein + totalAms}
            </div>
            <div className="text-[10px] text-muted-foreground">
              H <span className="font-semibold">{totalHein}</span> · A{" "}
              <span className="font-semibold">{totalAms}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 4. MISSÕES + RANKING GELADO */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            <h2 className="font-display text-sm tracking-widest text-muted-foreground">
              MISSÕES PENDENTES
            </h2>
          </div>
          {pendingMissions.length === 0 ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Tudo em dia por aqui.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-auto">
              {pendingMissions.slice(0, 8).map((m, i) => (
                <button
                  key={i}
                  onClick={() => goMissoes(m.barId)}
                  className="w-full flex items-center gap-2 text-left rounded border border-border p-1.5 hover:border-primary transition"
                >
                  {m.kind === "temp" ? (
                    <Thermometer className="w-3.5 h-3.5 text-accent" />
                  ) : (
                    <ClipboardCheck className="w-3.5 h-3.5 text-accent" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-display truncate">{m.barName}</div>
                    <div className="text-[10px] text-muted-foreground">{m.label}</div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              ))}
              {pendingMissions.length > 8 && (
                <p className="text-[10px] text-muted-foreground">
                  +{pendingMissions.length - 8} pendentes
                </p>
              )}
            </div>
          )}
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-primary" />
            <h2 className="font-display text-sm tracking-widest text-muted-foreground">
              CHOPPS MAIS GELADOS
            </h2>
          </div>
          {coldRanking.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem medições hoje ainda.</p>
          ) : (
            <ol className="space-y-1.5">
              {coldRanking.map((r, i) => {
                const t = r.bestTempToday as number;
                const seal = t <= IDEAL_TEMP;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => openTempPhoto(r)}
                      title="Ver foto do termômetro"
                      className="w-full flex items-center gap-2 rounded border border-border p-1.5 hover:border-primary transition text-left"
                    >
                      <div
                        className={`w-6 h-6 grid place-items-center rounded-full font-display text-xs ${i === 0 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                      >
                        {i + 1}
                      </div>
                      <Snowflake
                        className={`w-3.5 h-3.5 ${seal ? "text-primary" : "text-accent"}`}
                      />
                      <div className="flex-1 min-w-0 text-xs font-display truncate">{r.name}</div>
                      <div
                        className={`font-display text-sm ${seal ? "text-primary" : "text-accent"}`}
                      >
                        {t.toFixed(1)}°C
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      {/* 5. QUANTOS PRECISO REPOR — KPIs */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <PackageOpen className="w-4 h-4 text-accent" />
          <h2 className="font-display text-sm tracking-widest text-accent">
            QUANTOS PRECISO REPOR
          </h2>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Kpi label="Bares" value={rows.length} />
          <Kpi label="Sem inv." value={semInv} tone={semInv > 0 ? "danger" : "ok"} />
          <Kpi
            label="Heineken"
            value={totalHein}
            tone={totalHein > 0 ? "warn" : "ok"}
            suffix="repor"
          />
          <Kpi label="Amstel" value={totalAms} tone={totalAms > 0 ? "warn" : "ok"} suffix="repor" />
        </div>
      </div>

      {/* CHOPP QUENTE */}
      {choppQuente.length > 0 && (
        <Card className="p-3 border-red-500/50 bg-red-50">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="w-4 h-4 text-red-600" />
            <h2 className="font-display text-sm tracking-widest text-red-700">
              CHOPP ACIMA DE {TEMP_ALERTA}°C
            </h2>
            <span className="ml-auto text-[10px] uppercase tracking-widest text-red-700/70">
              {choppQuente.length} {choppQuente.length === 1 ? "bar" : "bares"}
            </span>
          </div>
          <div className="space-y-1.5">
            {choppQuente.map((r) => (
              <button
                key={r.id}
                onClick={() => goMissoes(r.id)}
                className="w-full flex items-center gap-2 rounded border border-red-300 bg-white/60 p-1.5 hover:brightness-95 transition text-left"
              >
                <Thermometer className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span className="text-xs font-display truncate flex-1">{r.name}</span>
                <span className="font-display text-sm text-red-700 shrink-0">
                  {(r.worstTempToday as number).toFixed(1)}°C
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
          <p className="text-[10px] text-red-700/70 mt-2">
            Pior medição de hoje. Meta: ≤ {IDEAL_TEMP}°C. Verificar chopeira e gelo.
          </p>
        </Card>
      )}

      {/* 6. ALERTAS DE REPOSIÇÃO */}
      {(precisaRepor.length > 0 || semInv > 0) && (
        <Card className="p-3 border-accent/40 bg-accent/5">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-accent" />
            <h2 className="font-display text-sm tracking-widest text-accent">
              ALERTAS DE REPOSIÇÃO
            </h2>
          </div>
          <div className="space-y-2">
            {precisaRepor.slice(0, 5).map((r) => {
              const s = SEVERITY_STYLES[r.severity as Exclude<Severity, "ok">];
              return (
                <button
                  key={r.id}
                  onClick={() => goReposicao(r.id)}
                  className={`w-full flex items-center gap-3 rounded border ${s.border} ${s.bg} p-2 hover:brightness-95 transition text-left`}
                >
                  <Truck className={`w-4 h-4 shrink-0 ${s.text}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-display truncate">{r.name}</div>
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
                  </div>
                  <Badge className={`${s.badgeBg} ${s.badgeText}`}>{s.label}</Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              );
            })}
            {precisaRepor.length > 5 && (
              <p className="text-[11px] text-muted-foreground pl-6">
                +{precisaRepor.length - 5} bar(es) em alerta
              </p>
            )}
            {semInv > 0 && (
              <div className="flex items-center gap-2 text-xs text-destructive pt-1">
                <AlertTriangle className="w-4 h-4" />
                {semInv} bar{semInv > 1 ? "es" : ""} ainda sem inventário
              </div>
            )}
          </div>
        </Card>
      )}

      {/* CONSUMO — filtro por período e fonte */}
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <PackageOpen className="w-4 h-4 text-accent" />
          <h2 className="font-display text-sm tracking-widest text-accent">
            {fonte === "meep" ? "BARRIS ENTREGUES (MEEP)" : "BARRIS CONSUMIDOS"}
          </h2>
          <div className="ml-auto flex items-center gap-1 flex-wrap">
            {(
              [
                { v: "hoje", l: "Hoje" },
                { v: "7d", l: "7 dias" },
                { v: "tudo", l: "Tudo" },
              ] as const
            ).map((p) => (
              <button
                key={p.v}
                onClick={() => setPeriodo(p.v)}
                className={`text-[10px] px-2 py-0.5 rounded border transition ${
                  periodo === p.v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:border-primary"
                }`}
              >
                {p.l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 mb-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground mr-1">
            Fonte
          </span>
          <button
            onClick={() => setFonte("vazios")}
            className={`text-[10px] px-2 py-0.5 rounded border transition ${
              fonte === "vazios"
                ? "bg-accent text-accent-foreground border-accent"
                : "border-border hover:border-accent"
            }`}
          >
            Vazios recolhidos
          </button>
          <button
            onClick={() => meepReady && setFonte("meep")}
            disabled={!meepReady}
            title={
              meepReady
                ? "Barris ENTREGUES ao bar, bipados na MEEP (estoque DISPEL → bar). NÃO é consumo do cliente."
                : "Abastecimento MEEP ainda não importado"
            }
            className={`text-[10px] px-2 py-0.5 rounded border transition disabled:opacity-40 ${
              fonte === "meep"
                ? "bg-accent text-accent-foreground border-accent"
                : "border-border hover:border-accent"
            }`}
          >
            MEEP (entregue)
          </button>
        </div>

        <Card className="p-3">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-lg border bg-background/60 p-2">
              <div className="text-[9px] tracking-widest text-muted-foreground uppercase">
                {fonte === "meep"
                  ? "Entregues"
                  : somaEvento
                    ? "Consumidos no evento"
                    : "Total"}
              </div>
              <div className="font-display text-3xl leading-tight">
                {somaEvento ? consumo.total + aRecolherTotal : consumo.total}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {somaEvento ? `${consumo.total} recolhidos + ${aRecolherTotal} no bar` : "barris"}
              </div>
            </div>
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-2">
              <div className="text-[9px] tracking-widest text-emerald-800/70 uppercase">
                Heineken
              </div>
              <div className="font-display text-3xl leading-tight text-emerald-800">
                {consumo.heineken}
              </div>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2">
              <div className="text-[9px] tracking-widest text-amber-800/70 uppercase">Amstel</div>
              <div className="font-display text-3xl leading-tight text-amber-800">
                {consumo.amstel}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-1.5">
            <Trophy className="w-3.5 h-3.5 text-accent" />
            <h3 className="font-display text-[11px] tracking-widest text-muted-foreground">
              {fonte === "meep" ? "TOP BARES POR ENTREGA" : "TOP BARES POR CONSUMO"}
            </h3>
          </div>
          {consumo.lista.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {fonte === "meep"
                ? "Sem consumo MEEP no período."
                : "Nenhum vazio recolhido no período."}
            </p>
          ) : (
            <ol className="space-y-1">
              {consumo.lista.slice(0, 5).map((b, i) => {
                const maxTotal = consumo.lista[0].total || 1;
                const pct = Math.max(3, Math.round((b.total / maxTotal) * 100));
                return (
                  <li key={b.nome} className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 shrink-0 grid place-items-center rounded-full font-display text-[10px] ${
                        i === 0 ? "bg-accent text-accent-foreground" : "bg-muted"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-xs truncate w-28 shrink-0">{b.nome}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums w-16 text-right">
                      {b.heineken}H · {b.amstel}A
                    </span>
                    <span className="font-display text-sm shrink-0 tabular-nums w-8 text-right">
                      {b.total}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="text-[10px] text-muted-foreground mt-2">
            {fonte === "meep"
              ? "⚠️ Barris ENTREGUES ao bar (estoque DISPEL → bar), bipados na MEEP. Não é consumo do cliente — serve para conferir a distribuição."
              : somaEvento
                ? "Recolhidos + os que ainda estão no bar, sem dupla contagem. Não inclui o que foi consumido após o último inventário e ainda não foi recolhido."
                : "Vazios recolhidos no período (fluxo com data). Para o consumo completo do evento, selecione Tudo."}
          </p>
        </Card>
      </div>

      {/* Atalho para todos os bares */}
      <Card className="p-3">
        <Link
          to="/app/bares"
          className="flex items-center gap-3 hover:text-primary transition"
        >
          <div className="w-10 h-10 rounded-full grid place-items-center bg-primary/15 text-primary shrink-0">
            <ListOrdered className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-base">TODOS OS BARES</div>
            <div className="text-[11px] text-muted-foreground">
              Lista completa com status, temperatura e reposição por bar.
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </Link>
      </Card>

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

function Kpi({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone?: "ok" | "warn" | "danger";
}) {
  const cls =
    tone === "warn"
      ? "text-accent"
      : tone === "danger"
        ? "text-destructive"
        : tone === "ok"
          ? "text-primary"
          : "";
  return (
    <Card className="p-2 text-center">
      <div className={`font-display text-2xl leading-none ${cls}`}>{value}</div>
      <div className="text-[9px] tracking-widest uppercase text-muted-foreground mt-1">
        {label}
        {suffix ? ` ${suffix}` : ""}
      </div>
    </Card>
  );
}

function EstoqueCard({
  nome,
  stock,
}: {
  nome: string;
  stock?: Record<Brand, number>;
}) {
  if (!stock) {
    return (
      <Card className="p-3">
        <div className="font-display text-xs tracking-widest uppercase text-muted-foreground">
          {nome}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Armazém não cadastrado.</p>
      </Card>
    );
  }
  const total = stock.heineken + stock.amstel;
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <Warehouse className="w-4 h-4 text-primary" />
        <div className="font-display text-xs tracking-widest uppercase text-muted-foreground">
          {nome}
        </div>
        <span className="ml-auto font-display text-lg">{total}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className={`rounded border p-1.5 ${BRAND_ACCENT.heineken.bg}`}>
          <div className={`text-[9px] uppercase tracking-widest ${BRAND_ACCENT.heineken.text}`}>
            Heineken
          </div>
          <div className={`font-display text-lg ${BRAND_ACCENT.heineken.text}`}>
            {stock.heineken}
          </div>
        </div>
        <div className={`rounded border p-1.5 ${BRAND_ACCENT.amstel.bg}`}>
          <div className={`text-[9px] uppercase tracking-widest ${BRAND_ACCENT.amstel.text}`}>
            Amstel
          </div>
          <div className={`font-display text-lg ${BRAND_ACCENT.amstel.text}`}>{stock.amstel}</div>
        </div>
      </div>
    </Card>
  );
}
