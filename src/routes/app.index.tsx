import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, ChevronRight, AlertTriangle, CheckCircle2, PackageOpen,
  Snowflake, Thermometer, ClipboardCheck, Truck, Trophy, Bell,
} from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

const BRANDS = ["heineken", "amstel"] as const;
type Brand = (typeof BRANDS)[number];
const IDEAL_TEMP = -1;
const TEMP_SLOTS = [
  { v: "t_11", l: "11h", hour: 11 },
  { v: "t_17", l: "17h", hour: 17 },
  { v: "t_22", l: "22h", hour: 22 },
] as const;

type Severity = "ok" | "medium" | "high" | "critical";

type BarRow = {
  id: string;
  name: string;
  apoio_responsavel: string | null;
  standards: Record<Brand, number>;
  cheios: Record<Brand, number>;
  consumidos: Record<Brand, number>;
  needed: Record<Brand, number>;
  fillByBrand: Record<Brand, number>;
  sevByBrand: Record<Brand, Severity>;
  totalNeeded: number;
  totalStandard: number;
  totalCheios: number;
  fillPct: number;
  severity: Severity;
  hasInventory: boolean;
  lastAt: string | null;
  lastBy: string | null;
  tempsToday: Record<string, { temperatura: number } | null>;
  orgToday: boolean;
  bestTempToday: number | null;
};

function computeSeverity(fillPct: number, standard: number): Severity {
  if (standard <= 0) return "ok";
  if (fillPct < 20) return "critical";
  if (fillPct < 30) return "high";
  if (fillPct <= 50) return "medium";
  return "ok";
}
const SEV_RANK: Record<Severity, number> = { ok: 0, medium: 1, high: 2, critical: 3 };
const worst = (a: Severity, b: Severity): Severity => (SEV_RANK[a] >= SEV_RANK[b] ? a : b);

const SEVERITY_STYLES: Record<Exclude<Severity, "ok">, {
  label: string; border: string; bg: string; text: string; badgeBg: string; badgeText: string; pillBg: string; pillText: string;
}> = {
  medium: {
    label: "Atenção",
    border: "border-yellow-400",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    badgeBg: "bg-yellow-400",
    badgeText: "text-yellow-950",
    pillBg: "bg-yellow-100",
    pillText: "text-yellow-700",
  },
  high: {
    label: "Urgente",
    border: "border-orange-500",
    bg: "bg-orange-50",
    text: "text-orange-700",
    badgeBg: "bg-orange-500",
    badgeText: "text-white",
    pillBg: "bg-orange-100",
    pillText: "text-orange-700",
  },
  critical: {
    label: "Crítico",
    border: "border-red-600",
    bg: "bg-red-50",
    text: "text-red-700",
    badgeBg: "bg-red-600",
    badgeText: "text-white",
    pillBg: "bg-red-100",
    pillText: "text-red-700",
  },
};

function isToday(iso: string | null | undefined) {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function Dashboard() {
  const nav = useNavigate();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dashboard-v2"],
    queryFn: async (): Promise<BarRow[]> => {
      const { data: bars, error } = await supabase
        .from("bars")
        .select("id,name,apoio_responsavel")
        .in("bar_type", ["bar_venda", "bar_parceiro"])
        .order("name");
      if (error) throw error;
      if (!bars?.length) return [];
      const ids = bars.map((b) => b.id);

      const [{ data: stds }, { data: invs }, { data: temps }, { data: orgs }] = await Promise.all([
        supabase.from("bar_stock_standard").select("*").in("bar_id", ids),
        supabase.from("inventories")
          .select("id,bar_id,performed_at,performed_by,inventory_items(brand,status,quantidade)")
          .in("bar_id", ids).order("performed_at", { ascending: false }),
        supabase.from("bar_temperature_checks")
          .select("bar_id,slot,temperatura,performed_at")
          .in("bar_id", ids).order("performed_at", { ascending: false }),
        supabase.from("bar_organization_checks")
          .select("bar_id,performed_at,copo_ok,meninas_ok,limpo_ok,sem_fila_ok")
          .in("bar_id", ids).order("performed_at", { ascending: false }),
      ]);

      const lastInv = new Map<string, any>();
      (invs ?? []).forEach((i: any) => { if (!lastInv.has(i.bar_id)) lastInv.set(i.bar_id, i); });

      const userIds = Array.from(new Set(Array.from(lastInv.values()).map((i: any) => i.performed_by).filter(Boolean)));
      const profMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id,display_name,username").in("id", userIds);
        (profs ?? []).forEach((p: any) => { profMap[p.id] = p.display_name ?? p.username ?? null; });
      }

      return bars.map((b) => {
        const standards: Record<Brand, number> = { heineken: 0, amstel: 0 };
        (stds ?? []).filter((s: any) => s.bar_id === b.id).forEach((s: any) => {
          standards[s.brand as Brand] = s.barris_padrao;
        });
        const inv = lastInv.get(b.id);
        const cheios: Record<Brand, number> = { heineken: 0, amstel: 0 };
        const vaziosRaw: Record<Brand, number> = { heineken: 0, amstel: 0 };
        (inv?.inventory_items ?? []).forEach((it: any) => {
          if ((it.status === "plugado" || it.status === "fechado") && cheios[it.brand as Brand] !== undefined) {
            cheios[it.brand as Brand] += it.quantidade;
          }
          if (it.status === "vazio" && vaziosRaw[it.brand as Brand] !== undefined) {
            vaziosRaw[it.brand as Brand] += it.quantidade;
          }
        });
        const consumidos: Record<Brand, number> = {
          heineken: Math.min(vaziosRaw.heineken, standards.heineken),
          amstel: Math.min(vaziosRaw.amstel, standards.amstel),
        };
        const needed: Record<Brand, number> = {
          heineken: Math.max(0, standards.heineken - cheios.heineken),
          amstel: Math.max(0, standards.amstel - cheios.amstel),
        };

        const tempsToday: Record<string, { temperatura: number } | null> = { t_11: null, t_17: null, t_22: null };
        let best: number | null = null;
        (temps ?? []).filter((t: any) => t.bar_id === b.id && isToday(t.performed_at)).forEach((t: any) => {
          if (!tempsToday[t.slot]) tempsToday[t.slot] = { temperatura: Number(t.temperatura) };
          const tv = Number(t.temperatura);
          if (best === null || tv < best) best = tv;
        });

        const orgToday = (orgs ?? []).some((o: any) => o.bar_id === b.id && isToday(o.performed_at) && o.copo_ok && o.meninas_ok && o.limpo_ok && o.sem_fila_ok);

        const totalStandard = standards.heineken + standards.amstel;
        const totalCheios = cheios.heineken + cheios.amstel;
        const fillPct = totalStandard > 0 ? Math.round((totalCheios / totalStandard) * 100) : 100;
        const fillByBrand: Record<Brand, number> = {
          heineken: standards.heineken > 0 ? Math.round((cheios.heineken / standards.heineken) * 100) : 100,
          amstel: standards.amstel > 0 ? Math.round((cheios.amstel / standards.amstel) * 100) : 100,
        };
        const sevByBrand: Record<Brand, Severity> = inv
          ? {
              heineken: computeSeverity(fillByBrand.heineken, standards.heineken),
              amstel: computeSeverity(fillByBrand.amstel, standards.amstel),
            }
          : { heineken: "ok", amstel: "ok" };
        const severity: Severity = inv ? worst(sevByBrand.heineken, sevByBrand.amstel) : "ok";

        return {
          id: b.id, name: b.name, apoio_responsavel: b.apoio_responsavel,
          standards, cheios, consumidos, needed, fillByBrand, sevByBrand,
          totalNeeded: needed.heineken + needed.amstel,
          totalStandard, totalCheios, fillPct, severity,
          hasInventory: !!inv,
          lastAt: inv?.performed_at ?? null,
          lastBy: inv?.performed_by ? (profMap[inv.performed_by] ?? null) : null,
          tempsToday, orgToday, bestTempToday: best,
        };
      });
    },
  });

  const totalHein = rows.reduce((a, r) => a + r.needed.heineken, 0);
  const totalAms = rows.reduce((a, r) => a + r.needed.amstel, 0);
  const semInv = rows.filter((r) => !r.hasInventory).length;

  // Consumidos com filtro por dia (default: último inventário de cada bar)
  const [consumoDay, setConsumoDay] = useState<string>(""); // yyyy-mm-dd; "" = último

  const { data: allInvs = [] } = useQuery({
    queryKey: ["dashboard-consumo-invs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventories")
        .select("id,bar_id,performed_at,inventory_items(brand,status,quantidade)")
        .order("performed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const consumoData = useMemo(() => {
    const byBar = new Map<string, any>();
    for (const inv of allInvs as any[]) {
      if (consumoDay) {
        const d = new Date(inv.performed_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (key !== consumoDay) continue;
      }
      if (!byBar.has(inv.bar_id)) byBar.set(inv.bar_id, inv);
    }
    return rows.map((r) => {
      const inv = byBar.get(r.id);
      const raw: Record<Brand, number> = { heineken: 0, amstel: 0 };
      (inv?.inventory_items ?? []).forEach((it: any) => {
        if (it.status === "vazio" && raw[it.brand as Brand] !== undefined) {
          raw[it.brand as Brand] += it.quantidade;
        }
      });
      return {
        ...r,
        consumidos: {
          heineken: Math.min(raw.heineken, r.standards.heineken),
          amstel: Math.min(raw.amstel, r.standards.amstel),
        },
        hasInvForDay: !!inv,
      };
    });
  }, [rows, allInvs, consumoDay]);

  const consumHein = consumoData.reduce((a, r) => a + r.consumidos.heineken, 0);
  const consumAms = consumoData.reduce((a, r) => a + r.consumidos.amstel, 0);
  const topConsumHein = [...consumoData].filter((r) => r.consumidos.heineken > 0).sort((a, b) => b.consumidos.heineken - a.consumidos.heineken).slice(0, 3);
  const topConsumAms = [...consumoData].filter((r) => r.consumidos.amstel > 0).sort((a, b) => b.consumidos.amstel - a.consumidos.amstel).slice(0, 3);
  const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, ok: 3 };
  const precisaRepor = rows
    .filter((r) => r.hasInventory && r.severity !== "ok")
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || b.totalNeeded - a.totalNeeded);

  // Missões pendentes hoje (slot vencido sem registro)
  const nowH = new Date().getHours();
  type PendingMission = { barId: string; barName: string; kind: "temp" | "org"; label: string };
  const pendingMissions: PendingMission[] = [];
  rows.forEach((r) => {
    TEMP_SLOTS.forEach((s) => {
      if (nowH >= s.hour && !r.tempsToday[s.v]) {
        pendingMissions.push({ barId: r.id, barName: r.name, kind: "temp", label: `Temperatura ${s.l}` });
      }
    });
    if (!r.orgToday) pendingMissions.push({ barId: r.id, barName: r.name, kind: "org", label: "Check organização" });
  });

  // Ranking chopps mais gelados (hoje)
  const coldRanking = rows
    .filter((r) => r.bestTempToday !== null)
    .sort((a, b) => (a.bestTempToday as number) - (b.bestTempToday as number))
    .slice(0, 5);

  // Bares para lista principal
  const sorted = [...rows].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
  );

  const goReposicao = (barId: string) =>
    nav({ to: "/app/bars/$barId", params: { barId }, search: { tab: "reposicao" } });
  const goMissoes = (barId: string) =>
    nav({ to: "/app/bars/$barId", params: { barId }, search: { tab: "missoes" } });
  const goInventario = (barId: string) =>
    nav({ to: "/app/bars/$barId", params: { barId }, search: { tab: "inventario" } });

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


  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl tracking-wider">CENTRAL DE OPERAÇÃO</h1>
          <p className="text-[11px] text-muted-foreground tracking-widest uppercase">Hoje · {new Date().toLocaleDateString("pt-BR")}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/map"><MapPin className="w-4 h-4 mr-1" />Mapa</Link>
        </Button>
      </div>

      {/* RESUMO EXECUTIVO */}
      <Card className="p-3 bg-gradient-to-br from-primary/8 via-primary/4 to-accent/8 border-primary/20">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-[11px] tracking-[0.25em] text-primary/80">RESUMO EXECUTIVO</h2>
          <span className="text-[10px] text-muted-foreground tracking-wider">
            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-background/60 border p-2">
            <div className="text-[9px] tracking-widest text-muted-foreground uppercase">Saúde da Operação</div>
            <div className={`font-display text-2xl leading-tight ${saudePct >= 70 ? "text-green-600" : saudePct >= 40 ? "text-orange-500" : "text-red-600"}`}>
              {saudePct}<span className="text-sm">%</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              <span className="text-green-600 font-semibold">{baresOK}</span> ok · <span className="text-red-600 font-semibold">{baresAlerta}</span> alerta
            </div>
          </div>
          <div className="rounded-lg bg-background/60 border p-2">
            <div className="text-[9px] tracking-widest text-muted-foreground uppercase">Estoque Nos Bares</div>
            <div className="font-display text-2xl leading-tight text-primary">
              {totalCheios}<span className="text-xs text-muted-foreground">/{totalPadrao}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              H <span className="font-semibold">{estoqueBaresH}</span> · A <span className="font-semibold">{estoqueBaresA}</span>
            </div>
          </div>
          <div className="rounded-lg bg-background/60 border p-2">
            <div className="text-[9px] tracking-widest text-muted-foreground uppercase">Repor Agora</div>
            <div className={`font-display text-2xl leading-tight ${totalHein + totalAms > 0 ? "text-orange-600" : "text-green-600"}`}>
              {totalHein + totalAms}
            </div>
            <div className="text-[10px] text-muted-foreground">
              H <span className="font-semibold">{totalHein}</span> · A <span className="font-semibold">{totalAms}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-2">
        <Kpi label="Bares" value={rows.length} />
        <Kpi label="Sem inv." value={semInv} tone={semInv > 0 ? "danger" : "ok"} />
        <Kpi label="Heineken" value={totalHein} tone={totalHein > 0 ? "warn" : "ok"} suffix="repor" />
        <Kpi label="Amstel" value={totalAms} tone={totalAms > 0 ? "warn" : "ok"} suffix="repor" />
      </div>


      {/* CONSUMIDOS — foco por marca */}
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <PackageOpen className="w-4 h-4 text-accent" />
          <h2 className="font-display text-sm tracking-widest text-accent">
            CONSUMIDOS · {consumoDay ? new Date(consumoDay + "T00:00:00").toLocaleDateString("pt-BR") : "ÚLTIMO INVENTÁRIO"}
          </h2>
          <div className="ml-auto flex items-center gap-1">
            <input
              type="date"
              value={consumoDay}
              onChange={(e) => setConsumoDay(e.target.value)}
              className="text-[11px] px-1.5 py-0.5 rounded border bg-background"
            />
            {consumoDay && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setConsumoDay("")}>
                limpar
              </Button>
            )}
            <Link to="/app/consumo" className="text-[11px] text-muted-foreground underline">ver consumo</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ConsumoBrandCard brand="heineken" total={consumHein} top={topConsumHein} onGo={goInventario} />
          <ConsumoBrandCard brand="amstel" total={consumAms} top={topConsumAms} onGo={goInventario} />
        </div>
      </div>

      {/* Alertas prioritários */}
      {(precisaRepor.length > 0 || semInv > 0) && (
        <Card className="p-3 border-accent/40 bg-accent/5">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-accent" />
            <h2 className="font-display text-sm tracking-widest text-accent">ALERTAS DE REPOSIÇÃO</h2>
          </div>
          <div className="space-y-2">
            {precisaRepor.slice(0, 5).map((r) => {
              const s = SEVERITY_STYLES[r.severity as Exclude<Severity, "ok">];
              return (
                <button key={r.id} onClick={() => goReposicao(r.id)}
                  className={`w-full flex items-center gap-3 rounded border ${s.border} ${s.bg} p-2 hover:brightness-95 transition text-left`}>
                  <Truck className={`w-4 h-4 shrink-0 ${s.text}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-display truncate">{r.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <BrandChip brand="heineken" need={r.needed.heineken} fill={r.fillByBrand.heineken} sev={r.sevByBrand.heineken} />
                      <BrandChip brand="amstel" need={r.needed.amstel} fill={r.fillByBrand.amstel} sev={r.sevByBrand.amstel} />
                    </div>
                  </div>
                  <Badge className={`${s.badgeBg} ${s.badgeText}`}>{s.label}</Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              );
            })}
            {precisaRepor.length > 5 && (
              <p className="text-[11px] text-muted-foreground pl-6">+{precisaRepor.length - 5} bar(es) em alerta</p>
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

      {/* Grid: Missões + Ranking gelado */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Missões pendentes */}
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            <h2 className="font-display text-sm tracking-widest text-muted-foreground">MISSÕES PENDENTES</h2>
          </div>
          {pendingMissions.length === 0 ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-primary" />Tudo em dia por aqui.</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-auto">
              {pendingMissions.slice(0, 8).map((m, i) => (
                <button key={i} onClick={() => goMissoes(m.barId)}
                  className="w-full flex items-center gap-2 text-left rounded border border-border p-1.5 hover:border-primary transition">
                  {m.kind === "temp"
                    ? <Thermometer className="w-3.5 h-3.5 text-accent" />
                    : <ClipboardCheck className="w-3.5 h-3.5 text-accent" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-display truncate">{m.barName}</div>
                    <div className="text-[10px] text-muted-foreground">{m.label}</div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              ))}
              {pendingMissions.length > 8 && (
                <p className="text-[10px] text-muted-foreground">+{pendingMissions.length - 8} pendentes</p>
              )}
            </div>
          )}
        </Card>

        {/* Ranking mais gelados */}
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-primary" />
            <h2 className="font-display text-sm tracking-widest text-muted-foreground">CHOPPS MAIS GELADOS</h2>
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
                    <button onClick={() => goMissoes(r.id)}
                      className="w-full flex items-center gap-2 rounded border border-border p-1.5 hover:border-primary transition text-left">
                      <div className={`w-6 h-6 grid place-items-center rounded-full font-display text-xs ${i === 0 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{i + 1}</div>
                      <Snowflake className={`w-3.5 h-3.5 ${seal ? "text-primary" : "text-accent"}`} />
                      <div className="flex-1 min-w-0 text-xs font-display truncate">{r.name}</div>
                      <div className={`font-display text-sm ${seal ? "text-primary" : "text-accent"}`}>{t.toFixed(1)}°C</div>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      {/* Lista completa */}
      <div className="space-y-2">
        <h2 className="font-display text-sm tracking-widest text-muted-foreground pt-1">TODOS OS BARES</h2>
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
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
        {sorted.map((r) => {
          const state = !r.hasInventory ? "no_inv" : r.severity !== "ok" ? "refill" : "ok";
          const sev = r.severity !== "ok" ? SEVERITY_STYLES[r.severity as Exclude<Severity, "ok">] : null;
          const abaixoPadrao = r.hasInventory && (r.cheios.heineken < r.standards.heineken || r.cheios.amstel < r.standards.amstel);
          const acimaPadrao = r.hasInventory && !abaixoPadrao && (r.cheios.heineken > r.standards.heineken || r.cheios.amstel > r.standards.amstel);
          return (
            <Card key={r.id} className={`p-3 hover:border-primary transition ${abaixoPadrao ? "border-destructive/60" : acimaPadrao ? "border-yellow-400" : ""}`}>
              {(abaixoPadrao || acimaPadrao) && (
                <div className={`mb-2 rounded px-2 py-1 text-[10px] font-bold tracking-wider animate-pulse ${abaixoPadrao ? "bg-destructive/15 text-destructive" : "bg-yellow-100 text-yellow-800"}`}>
                  {abaixoPadrao ? "⚠ ATENÇÃO · ESTOQUE ABAIXO DO PADRÃO" : "⚡ BAR FORA DO PADRÃO ESTABELECIDO"}
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
                    {state === "ok" && (r.hasInventory
                      ? `Tudo em ordem · ${r.fillPct}% do padrão`
                      : (r.apoio_responsavel ? `Apoio: ${r.apoio_responsavel}` : "Tudo em ordem"))}
                  </div>

                  {r.hasInventory && (r.needed.heineken > 0 || r.needed.amstel > 0 || state === "refill") && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <BrandChip brand="heineken" need={r.needed.heineken} fill={r.fillByBrand.heineken} sev={r.sevByBrand.heineken} />
                      <BrandChip brand="amstel" need={r.needed.amstel} fill={r.fillByBrand.amstel} sev={r.sevByBrand.amstel} />
                    </div>
                  )}
                  {r.bestTempToday !== null && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Snowflake className="w-3 h-3" />
                      Mais gelado hoje: <b className={r.bestTempToday <= IDEAL_TEMP ? "text-primary" : "text-accent"}>{r.bestTempToday.toFixed(1)}°C</b>
                    </div>
                  )}
                  {r.lastAt && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Últ. inv.: {new Date(r.lastAt).toLocaleDateString("pt-BR")} {new Date(r.lastAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {r.lastBy && <> · por <b className="text-foreground">{r.lastBy}</b></>}
                    </div>
                  )}
                </button>
                {state === "refill" && sev ? (
                  <Button size="sm" className={`${sev.badgeBg} ${sev.badgeText} hover:brightness-95`} onClick={() => goReposicao(r.id)}>
                    <Truck className="w-3.5 h-3.5 mr-1" />Repor
                  </Button>
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ label, value, suffix, tone }: { label: string; value: number; suffix?: string; tone?: "ok" | "warn" | "danger" }) {
  const cls = tone === "warn" ? "text-accent" : tone === "danger" ? "text-destructive" : tone === "ok" ? "text-primary" : "";
  return (
    <Card className="p-2 text-center">
      <div className={`font-display text-2xl leading-none ${cls}`}>{value}</div>
      <div className="text-[9px] tracking-widest uppercase text-muted-foreground mt-1">{label}{suffix ? ` ${suffix}` : ""}</div>
    </Card>
  );
}

const BRAND_LABEL: Record<Brand, string> = { heineken: "Heineken", amstel: "Amstel" };
function BrandChip({ brand, need, fill, sev }: { brand: Brand; need: number; fill: number; sev: Severity }) {
  const s = sev !== "ok" ? SEVERITY_STYLES[sev] : null;
  const cls = s ? `${s.pillBg} ${s.pillText} border ${s.border}` : "bg-primary/10 text-primary border border-primary/20";
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-display tracking-wide ${cls}`}>
      <span className="font-bold">{BRAND_LABEL[brand]}</span>
      <span>{fill}%</span>
      {need > 0 && <span>· repor {need}</span>}
    </span>
  );
}

function StatePill({ state, severity, count }: { state: "ok" | "refill" | "no_inv"; severity: Severity; count: number }) {
  if (state === "no_inv") return (
    <div className="w-12 h-12 shrink-0 rounded-full grid place-items-center bg-destructive/15 text-destructive">
      <AlertTriangle className="w-5 h-5" />
    </div>
  );
  if (state === "refill" && severity !== "ok") {
    const s = SEVERITY_STYLES[severity];
    return (
      <div className={`w-12 h-12 shrink-0 rounded-full grid place-items-center ${s.pillBg} ${s.pillText}`}>
        <div className="flex flex-col items-center leading-none">
          <PackageOpen className="w-4 h-4" />
          <span className="font-display text-sm mt-0.5">{count}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="w-12 h-12 shrink-0 rounded-full grid place-items-center bg-primary/15 text-primary">
      <CheckCircle2 className="w-5 h-5" />
    </div>
  );
}

const BRAND_ACCENT: Record<Brand, { bg: string; text: string; dot: string }> = {
  heineken: { bg: "bg-emerald-50 border-emerald-300", text: "text-emerald-800", dot: "bg-emerald-600" },
  amstel: { bg: "bg-amber-50 border-amber-300", text: "text-amber-800", dot: "bg-amber-600" },
};

function ConsumoBrandCard({
  brand, total, top, onGo,
}: {
  brand: Brand;
  total: number;
  top: BarRow[];
  onGo: (barId: string) => void;
}) {
  const a = BRAND_ACCENT[brand];
  return (
    <Card className={`p-3 border ${a.bg}`}>
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${a.dot}`} />
        <div className="font-display text-xs tracking-widest uppercase">{BRAND_LABEL[brand]}</div>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">Consumidos</span>
      </div>
      <div className={`font-display text-4xl leading-none mt-1 ${a.text}`}>{total}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">barris (teto = padrão por bar)</div>
      <div className="mt-2 space-y-1">
        {top.length === 0 && <div className="text-[11px] text-muted-foreground">Sem consumo registrado.</div>}
        {top.map((r, i) => (
          <button
            key={r.id}
            onClick={() => onGo(r.id)}
            className="w-full flex items-center justify-between text-[11px] hover:bg-black/5 rounded px-1 py-0.5"
          >
            <span className="truncate">
              <span className="text-muted-foreground mr-1">#{i + 1}</span>
              {r.name}
            </span>
            <span className={`font-mono font-bold ${a.text}`}>{r.consumidos[brand]}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
