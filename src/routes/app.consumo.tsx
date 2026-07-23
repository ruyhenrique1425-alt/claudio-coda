import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BarChart3,
  Beer,
  Trophy,
  Warehouse,
  AlertTriangle,
  ClipboardCheck,
  CalendarIcon,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  PieChart,
  Pie,
  Legend,
} from "recharts";

export const Route = createFileRoute("/app/consumo")({
  component: ConsumoDashboard,
});

type Range = "today" | "7" | "all";

const RANGES: { v: Range; l: string }[] = [
  { v: "today", l: "Hoje" },
  { v: "7", l: "7 dias" },
  { v: "all", l: "Tudo" },
];

const BRAND_COLORS: Record<string, string> = {
  heineken: "#1B6E3A",
  amstel: "#F4B942",
};

function ConsumoDashboard() {
  const [range, setRange] = useState<Range>("today");
  const [until, setUntil] = useState<string>(""); // datetime-local (YYYY-MM-DDTHH:mm)

  const { data, isLoading } = useQuery({
    queryKey: ["consumo", range, until],
    queryFn: async () => {
      const untilDate = until ? new Date(until) : null;
      const untilIso = untilDate ? untilDate.toISOString() : null;

      let q = supabase.from("empties_removed").select("bar_id,brand,quantidade,performed_at");
      if (untilIso) q = q.lte("performed_at", untilIso);
      if (range === "today") {
        const start = untilDate ? new Date(untilDate) : new Date();
        start.setHours(0, 0, 0, 0);
        q = q.gte("performed_at", start.toISOString());
      } else if (range !== "all") {
        const since = untilDate ? new Date(untilDate) : new Date();
        since.setDate(since.getDate() - Number(range));
        q = q.gte("performed_at", since.toISOString());
      }
      let invQ = supabase
        .from("inventories")
        .select("id,bar_id,performed_at,performed_by,inventory_items(brand,status,quantidade)")
        .order("performed_at", { ascending: false });
      if (untilIso) invQ = invQ.lte("performed_at", untilIso);
      const [{ data: emps, error }, { data: bars }, { data: stds }, { data: invs }] =
        await Promise.all([
          q,
          supabase.from("bars").select("id,name").in("bar_type", ["bar_venda", "bar_parceiro"]),
          supabase.from("bar_stock_standard").select("bar_id,brand,barris_padrao"),
          invQ,
        ]);
      if (error) throw error;

      const userIds = Array.from(
        new Set((invs ?? []).map((i: any) => i.performed_by).filter(Boolean)),
      );
      let profMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,display_name,username")
          .in("id", userIds);
        (profs ?? []).forEach((p: any) => {
          profMap[p.id] = p.display_name ?? p.username ?? null;
        });
      }
      let lastInventory: { at: string; operator: string | null } | null = null;
      const firstInv = (invs ?? []).find((i: any) => i.performed_by);
      if (firstInv) {
        lastInventory = {
          at: firstInv.performed_at,
          operator: profMap[firstInv.performed_by] ?? null,
        };
      }

      const nameById: Record<string, string> = {};
      (bars ?? []).forEach((b) => (nameById[b.id] = b.name));

      // padrão por bar/marca (teto)
      const stdBy: Record<string, { heineken: number; amstel: number }> = {};
      (stds ?? []).forEach((s: any) => {
        if (!stdBy[s.bar_id]) stdBy[s.bar_id] = { heineken: 0, amstel: 0 };
        stdBy[s.bar_id][s.brand as "heineken" | "amstel"] = s.barris_padrao || 0;
      });

      // último inventário por bar
      const lastInv = new Map<string, any>();
      (invs ?? []).forEach((i: any) => {
        if (!lastInv.has(i.bar_id)) lastInv.set(i.bar_id, i);
      });

      const byBar: Record<
        string,
        {
          name: string;
          total: number;
          heineken: number;
          amstel: number;
          vazios_h: number;
          vazios_a: number;
          plug_h: number;
          plug_a: number;
          fech_h: number;
          fech_a: number;
          std_h: number;
          std_a: number;
        }
      > = {};
      const byBrand: Record<string, number> = { heineken: 0, amstel: 0 };
      const vaziosByBrand: Record<string, number> = { heineken: 0, amstel: 0 };
      const plugByBrand: Record<string, number> = { heineken: 0, amstel: 0 };
      const fechByBrand: Record<string, number> = { heineken: 0, amstel: 0 };
      let total = 0;
      let totalVazios = 0;
      let totalPlug = 0;
      let totalFech = 0;

      (emps ?? []).forEach((e: any) => {
        const qtd = e.quantidade || 0;
        total += qtd;
        byBrand[e.brand] = (byBrand[e.brand] ?? 0) + qtd;
        const name = nameById[e.bar_id] ?? "Bar removido";
        const std = stdBy[e.bar_id] ?? { heineken: 0, amstel: 0 };
        if (!byBar[e.bar_id])
          byBar[e.bar_id] = {
            name,
            total: 0,
            heineken: 0,
            amstel: 0,
            vazios_h: 0,
            vazios_a: 0,
            plug_h: 0,
            plug_a: 0,
            fech_h: 0,
            fech_a: 0,
            std_h: std.heineken,
            std_a: std.amstel,
          };
        byBar[e.bar_id].total += qtd;
        byBar[e.bar_id][e.brand as "heineken" | "amstel"] += qtd;
      });

      // último inventário: plugados, fechados e vazios (teto no padrão por marca)
      (bars ?? []).forEach((b) => {
        const inv = lastInv.get(b.id);
        if (!inv) return;
        const std = stdBy[b.id] ?? { heineken: 0, amstel: 0 };
        let vh = 0,
          va = 0,
          ph = 0,
          pa = 0,
          fh = 0,
          fa = 0;
        (inv.inventory_items ?? []).forEach((it: any) => {
          const q = it.quantidade || 0;
          if (it.status === "vazio") {
            if (it.brand === "heineken") vh += q;
            if (it.brand === "amstel") va += q;
          } else if (it.status === "plugado") {
            if (it.brand === "heineken") ph += q;
            if (it.brand === "amstel") pa += q;
          } else if (it.status === "fechado") {
            if (it.brand === "heineken") fh += q;
            if (it.brand === "amstel") fa += q;
          }
        });
        vh = Math.min(vh, std.heineken);
        va = Math.min(va, std.amstel);
        ph = Math.min(ph, std.heineken);
        pa = Math.min(pa, std.amstel);
        fh = Math.min(fh, std.heineken);
        fa = Math.min(fa, std.amstel);
        if (vh + va + ph + pa + fh + fa === 0) return;
        if (!byBar[b.id])
          byBar[b.id] = {
            name: b.name,
            total: 0,
            heineken: 0,
            amstel: 0,
            vazios_h: 0,
            vazios_a: 0,
            plug_h: 0,
            plug_a: 0,
            fech_h: 0,
            fech_a: 0,
            std_h: std.heineken,
            std_a: std.amstel,
          };
        byBar[b.id].vazios_h = vh;
        byBar[b.id].vazios_a = va;
        byBar[b.id].plug_h = ph;
        byBar[b.id].plug_a = pa;
        byBar[b.id].fech_h = fh;
        byBar[b.id].fech_a = fa;
        vaziosByBrand.heineken += vh;
        vaziosByBrand.amstel += va;
        plugByBrand.heineken += ph;
        plugByBrand.amstel += pa;
        fechByBrand.heineken += fh;
        fechByBrand.amstel += fa;
        totalVazios += vh + va;
        totalPlug += ph + pa;
        totalFech += fh + fa;
      });

      const barsRanked = Object.entries(byBar)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.total + b.vazios_h + b.vazios_a - (a.total + a.vazios_h + a.vazios_a));
      const brandsRanked = Object.entries(byBrand)
        .map(([brand, qty]) => ({
          brand,
          qty,
          vazios: vaziosByBrand[brand] ?? 0,
          plug: plugByBrand[brand] ?? 0,
          fech: fechByBrand[brand] ?? 0,
        }))
        .sort((a, b) => b.qty - a.qty);

      return { total, totalVazios, totalPlug, totalFech, barsRanked, brandsRanked, lastInventory };
    },
  });

  const bars = data?.barsRanked ?? [];
  const brands = data?.brandsRanked ?? [];
  const maxBar = Math.max(1, ...bars.map((b) => b.total + b.vazios_h + b.vazios_a));

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 pb-16">
      <div className="flex items-center gap-3 mb-4">
        <BarChart3 className="w-6 h-6 text-accent" />
        <div>
          <h1 className="font-display text-2xl tracking-wider">CONSUMO</h1>
          <p className="text-xs text-muted-foreground">
            Ranking de bares e marcas por barris consumidos (vazios = consumidos)
          </p>
        </div>
      </div>

      {data?.lastInventory &&
        (() => {
          const dt = new Date(data.lastInventory.at);
          return (
            <Card className="p-3 border-l-4 border-l-primary bg-primary/5 mb-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Último inventário registrado
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-display text-lg">
                  {dt.toLocaleDateString("pt-BR")} ·{" "}
                  {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-sm text-muted-foreground">
                  por <b className="text-foreground">{data.lastInventory.operator ?? "—"}</b>
                </span>
              </div>
            </Card>
          );
        })()}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {RANGES.map((r) => (
          <Button
            key={r.v}
            size="sm"
            variant={range === r.v ? "default" : "outline"}
            onClick={() => setRange(r.v)}
          >
            {r.l}
          </Button>
        ))}
        <div className="flex items-center gap-1 ml-auto">
          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
          <Input
            type="datetime-local"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="h-8 w-[200px] text-xs"
            title="Filtrar até data e hora"
          />
          {until && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setUntil("")}
              title="Limpar filtro"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      {until && (
        <div className="text-[10px] text-muted-foreground -mt-2 mb-3">
          Consumo até {new Date(until).toLocaleString("pt-BR")}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        {(["heineken", "amstel"] as const).map((brand) => {
          const vaziosBar = bars.reduce(
            (a, b) => a + (brand === "heineken" ? b.vazios_h : b.vazios_a),
            0,
          );
          const recolhidos = bars.reduce(
            (a, b) => a + (brand === "heineken" ? b.heineken : b.amstel),
            0,
          );
          const consumido = vaziosBar + recolhidos;
          const plug = bars.reduce((a, b) => a + (brand === "heineken" ? b.plug_h : b.plug_a), 0);
          const fech = bars.reduce((a, b) => a + (brand === "heineken" ? b.fech_h : b.fech_a), 0);
          return (
            <Card
              key={brand}
              className="p-4 border-l-4"
              style={{ borderLeftColor: BRAND_COLORS[brand] }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Beer className="w-4 h-4" style={{ color: BRAND_COLORS[brand] }} />
                <span className="font-display uppercase tracking-widest text-sm">{brand}</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Consumidos (vazios)
              </div>
              <div className="font-display text-4xl text-orange-600 leading-none mt-1">
                {consumido}
              </div>
              <div className="text-[10px] text-muted-foreground mt-2 flex flex-wrap gap-x-3">
                <span title="Vazios recolhidos dos bares (histórico)">recolhidos {recolhidos}</span>
                <span title="Vazios ainda no bar (último inventário)">no bar {vaziosBar}</span>
                <span className="text-primary">plug {plug}</span>
                <span className="text-accent">fech {fech}</span>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-foreground mb-4">
        Consumidos = vazios recolhidos + vazios ainda no bar (último inventário)
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-3">
              <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
              <div className="h-3 w-1/3 bg-muted/70 animate-pulse rounded" />
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3 pt-2">
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 h-3 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-10 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Bares */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-accent" />
              <h2 className="font-display text-sm tracking-widest">BARES QUE MAIS CONSUMIRAM</h2>
            </div>
            <p className="text-[10px] text-muted-foreground mb-3">
              Retirados + consumidos em bar (teto = padrão)
            </p>
            {bars.length === 0 && (
              <div className="text-sm text-muted-foreground">Sem registros no período.</div>
            )}
            <div className="space-y-3">
              {bars.map((b, i) => {
                const vazTotal = b.vazios_h + b.vazios_a;
                return (
                  <div key={b.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate">
                        <span className="text-muted-foreground mr-2">#{i + 1}</span>
                        {b.name}
                      </span>
                      <span className="font-mono font-bold">
                        {b.total}
                        {vazTotal > 0 && <span className="text-orange-600"> +{vazTotal}</span>}
                      </span>
                    </div>
                    <div className="flex h-2 rounded overflow-hidden bg-muted">
                      <div
                        style={{
                          width: `${(b.heineken / maxBar) * 100}%`,
                          background: BRAND_COLORS.heineken,
                        }}
                        title={`Heineken retirados: ${b.heineken}`}
                      />
                      <div
                        style={{
                          width: `${(b.amstel / maxBar) * 100}%`,
                          background: BRAND_COLORS.amstel,
                        }}
                        title={`Amstel retirados: ${b.amstel}`}
                      />
                      <div
                        style={{
                          width: `${(vazTotal / maxBar) * 100}%`,
                          background: "#EA580C",
                          opacity: 0.75,
                        }}
                        title={`Consumidos em bar: ${vazTotal}`}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-3">
                      <span>H ret {b.heineken}</span>
                      <span>A ret {b.amstel}</span>
                      <span className="text-primary">
                        Plug H{b.plug_h}/{b.std_h} · A{b.plug_a}/{b.std_a}
                      </span>
                      <span className="text-accent">
                        Fech H{b.fech_h}/{b.std_h} · A{b.fech_a}/{b.std_a}
                      </span>
                      {vazTotal > 0 && (
                        <span className="text-orange-700">
                          Cons H{b.vazios_h}/{b.std_h} · A{b.vazios_a}/{b.std_a}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Marcas */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Beer className="w-4 h-4 text-accent" />
              <h2 className="font-display text-sm tracking-widest">CHOPPS MAIS CONSUMIDOS</h2>
            </div>
            {brands.every((b) => b.qty === 0 && b.vazios === 0) ? (
              <div className="text-sm text-muted-foreground">Sem registros no período.</div>
            ) : (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={brands.map((b) => ({
                        brand: b.brand.toUpperCase(),
                        Consumidos: b.vazios,
                        Retirados: b.qty,
                        fill: BRAND_COLORS[b.brand] ?? "#888",
                      }))}
                      margin={{ top: 16, right: 12, left: 0, bottom: 0 }}
                    >
                      <XAxis dataKey="brand" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Consumidos" radius={[6, 6, 0, 0]}>
                        {brands.map((b, i) => (
                          <Cell key={i} fill="#EA580C" />
                        ))}
                        <LabelList
                          dataKey="Consumidos"
                          position="top"
                          style={{ fontSize: 11, fontWeight: 700, fill: "#EA580C" }}
                        />
                      </Bar>
                      <Bar dataKey="Retirados" radius={[6, 6, 0, 0]}>
                        {brands.map((b, i) => (
                          <Cell key={i} fill={BRAND_COLORS[b.brand] ?? "#888"} />
                        ))}
                        <LabelList
                          dataKey="Retirados"
                          position="top"
                          style={{ fontSize: 11, fontWeight: 700 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-48 mt-2">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mb-1">
                    Participação em Consumidos
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={brands
                          .filter((b) => b.vazios > 0)
                          .map((b) => ({ name: b.brand.toUpperCase(), value: b.vazios }))}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        label={(e: any) => `${e.name} ${e.value}`}
                      >
                        {brands
                          .filter((b) => b.vazios > 0)
                          .map((b, i) => (
                            <Cell key={i} fill={BRAND_COLORS[b.brand] ?? "#888"} />
                          ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      <WarehousesCard bars={bars} />
    </div>
  );
}

const INITIAL: Record<string, { heineken: number; amstel: number }> = {
  dispel: { heineken: 240, amstel: 240 },
  allstar: { heineken: 70, amstel: 70 },
};

function WarehousesCard({ bars }: { bars: any[] }) {
  const qc = useQueryClient();
  const [inv, setInv] = useState<null | { code: "dispel" | "allstar"; id: string; name: string }>(
    null,
  );

  const { data: whs } = useQuery({
    queryKey: ["warehouses-stock"],
    queryFn: async () => {
      const { data: ws, error } = await supabase
        .from("warehouses")
        .select("id, code, name, warehouse_stock(brand, barrels)");
      if (error) throw error;
      return ws ?? [];
    },
  });

  const dispel = whs?.find((w: any) => w.code === "dispel");
  const allstar = whs?.find((w: any) => w.code === "allstar");
  const getStock = (w: any, brand: "heineken" | "amstel") =>
    (w?.warehouse_stock ?? []).find((s: any) => s.brand === brand)?.barrels ?? 0;

  // total "vivo" nos bares (fechado + plugado) por marca — limitado pelo padrão
  const barrisEmBares = bars.reduce(
    (a: any, b: any) => ({
      heineken: a.heineken + b.fech_h + b.plug_h,
      amstel: a.amstel + b.fech_a + b.plug_a,
    }),
    { heineken: 0, amstel: 0 },
  );
  const vaziosEmBares = bars.reduce(
    (a: any, b: any) => ({ heineken: a.heineken + b.vazios_h, amstel: a.amstel + b.vazios_a }),
    { heineken: 0, amstel: 0 },
  );

  const totais = (brand: "heineken" | "amstel") => {
    const d = getStock(dispel, brand);
    const a = getStock(allstar, brand);
    const bar = barrisEmBares[brand];
    const vaz = vaziosEmBares[brand];
    const soma = d + a + bar + vaz; // deve totalizar 240
    return { d, a, bar, vaz, soma, esperado: INITIAL.dispel[brand] };
  };

  return (
    <>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <WarehouseBlock
          title="ESTOQUE CENTRAL · DISPEL"
          subtitle="Inicial 240 barris de cada · alerta se a soma total do sistema não fechar 240"
          icon={<Warehouse className="w-4 h-4 text-primary" />}
          onInv={() => dispel && setInv({ code: "dispel", id: dispel.id, name: dispel.name })}
          rows={(["heineken", "amstel"] as const).map((b) => {
            const t = totais(b);
            const diff = t.soma - t.esperado;
            return {
              brand: b,
              main: t.d,
              detail: `+ AllStar ${t.a} · em bares ${t.bar} · consumidos ${t.vaz} = ${t.soma}/${t.esperado}`,
              alert: diff !== 0,
              alertLabel: diff < 0 ? `Faltam ${-diff}` : `Sobra ${diff}`,
            };
          })}
        />
        <WarehouseBlock
          title="ESTOQUE ALL STAR"
          subtitle="Inicial 70 barris cheios de cada · controle apenas dos cheios em posse deles"
          icon={<Warehouse className="w-4 h-4 text-accent" />}
          onInv={() => allstar && setInv({ code: "allstar", id: allstar.id, name: allstar.name })}
          rows={(["heineken", "amstel"] as const).map((b) => ({
            brand: b,
            main: getStock(allstar, b),
            detail: `Inicial ${INITIAL.allstar[b]} · atual em posse da All Star`,
            alert: false,
          }))}
        />
      </div>

      {inv && (
        <InventariarDialog
          warehouseId={inv.id}
          warehouseName={inv.name}
          current={{
            heineken: getStock(inv.code === "dispel" ? dispel : allstar, "heineken"),
            amstel: getStock(inv.code === "dispel" ? dispel : allstar, "amstel"),
          }}
          onClose={() => setInv(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["warehouses-stock"] });
            setInv(null);
          }}
        />
      )}
    </>
  );
}

function WarehouseBlock({
  title,
  subtitle,
  icon,
  rows,
  onInv,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onInv: () => void;
  rows: {
    brand: "heineken" | "amstel";
    main: number;
    detail: string;
    alert?: boolean;
    alertLabel?: string;
  }[];
}) {
  const anyAlert = rows.some((r) => r.alert);
  return (
    <Card className={`p-4 ${anyAlert ? "border-l-4 border-l-red-500" : ""}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="font-display text-sm tracking-widest">{title}</h2>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onInv} className="shrink-0">
          <ClipboardCheck className="w-3 h-3 mr-1" /> Inventariar
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rows.map((r) => (
          <div key={r.brand} className="border rounded p-2">
            <div className="flex items-center justify-between">
              <span
                className="uppercase text-[11px] font-display tracking-wider"
                style={{ color: BRAND_COLORS[r.brand] }}
              >
                {r.brand}
              </span>
              {r.alert && (
                <span className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {r.alertLabel}
                </span>
              )}
            </div>
            <div className="font-display text-3xl leading-none mt-1">{r.main}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{r.detail}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function InventariarDialog({
  warehouseId,
  warehouseName,
  current,
  onClose,
  onSaved,
}: {
  warehouseId: string;
  warehouseName: string;
  current: { heineken: number; amstel: number };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [hein, setHein] = useState<string>("");
  const [ams, setAms] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const h = hein === "" ? current.heineken : Number(hein);
    const a = ams === "" ? current.amstel : Number(ams);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      toast.error("Valores inválidos");
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const rows = (["heineken", "amstel"] as const)
      .map((brand) => {
        const target = brand === "heineken" ? h : a;
        const cur = current[brand];
        const delta = target - cur;
        if (delta === 0) return null;
        return {
          warehouse_id: warehouseId,
          move_type: "ajuste" as const,
          brand,
          quantidade: Math.abs(delta),
          direction: delta > 0 ? 1 : -1,
          performed_by: u.user?.id ?? null,
          notes: `Inventário manual — ajuste para ${target}`,
        };
      })
      .filter(Boolean) as any[];

    if (rows.length === 0) {
      toast.info("Nada a ajustar");
      setSaving(false);
      onClose();
      return;
    }
    const { error } = await supabase.from("warehouse_movements").insert(rows);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Inventário registrado");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inventariar · {warehouseName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Informe a quantidade real de barris cheios contados agora. Um ajuste será registrado.
          </p>
          <div>
            <Label className="text-xs">HEINEKEN (atual: {current.heineken})</Label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="-"
              value={hein}
              onChange={(e) => setHein(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">AMSTEL (atual: {current.amstel})</Label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="-"
              value={ams}
              onChange={(e) => setAms(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar inventário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
