import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useSession";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Beer } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/app/consumo-tempo")({ component: ConsumoTempoPage });

const BRANDS = ["heineken", "amstel"] as const;
type Brand = (typeof BRANDS)[number];
const BRAND_LABEL: Record<Brand, string> = { heineken: "Heineken", amstel: "Amstel" };
const BRAND_COLOR: Record<Brand, string> = { heineken: "#0A7E3F", amstel: "#E0A419" };
const PERIODS = [
  { d: 7, l: "7 dias" },
  { d: 14, l: "14 dias" },
  { d: 30, l: "30 dias" },
] as const;

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
function dayLabel(key: string) {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

function ConsumoTempoPage() {
  const { user } = useSession();
  const perms = usePermissions(user?.id);
  const canView = perms.isGestor || perms.isManutencao;
  const [days, setDays] = useState<number>(14);

  const { data, isLoading } = useQuery({
    queryKey: ["consumo-tempo", days],
    enabled: canView,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - (days - 1));
      since.setHours(0, 0, 0, 0);
      const { data: rows, error } = await supabase
        .from("empties_removed")
        .select("brand,quantidade,performed_at")
        .gte("performed_at", since.toISOString())
        .order("performed_at", { ascending: true });
      if (error) throw error;

      // Bucket por dia (preenche dias sem consumo com zero)
      const byDay: Record<string, Record<Brand, number>> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        byDay[dayKey(d.toISOString())] = { heineken: 0, amstel: 0 };
      }
      const totals: Record<Brand, number> = { heineken: 0, amstel: 0 };
      (rows ?? []).forEach((r: any) => {
        const k = dayKey(r.performed_at);
        if (!byDay[k]) byDay[k] = { heineken: 0, amstel: 0 };
        const q = r.quantidade ?? 0;
        byDay[k][r.brand as Brand] += q;
        totals[r.brand as Brand] += q;
      });

      const series = Object.keys(byDay)
        .sort()
        .map((k) => ({
          dia: dayLabel(k),
          Heineken: byDay[k].heineken,
          Amstel: byDay[k].amstel,
          total: byDay[k].heineken + byDay[k].amstel,
        }));

      const totalGeral = totals.heineken + totals.amstel;
      const media = totalGeral / days;
      const pico = series.reduce(
        (mx, s) => (s.total > mx.total ? { dia: s.dia, total: s.total } : mx),
        { dia: "-", total: 0 },
      );

      return { series, totals, totalGeral, media, pico };
    },
  });

  const media = useMemo(() => (data ? data.media.toFixed(1) : "0"), [data]);

  if (!canView) {
    return (
      <div className="p-4">
        <Card className="p-6 text-sm text-muted-foreground">Acesso restrito.</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl tracking-wider flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" /> CONSUMO × TEMPO
          </h1>
          <p className="text-xs text-muted-foreground">
            Barris consumidos por dia (vazios recolhidos = consumidos), por marca.
          </p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Button
              key={p.d}
              size="sm"
              variant={days === p.d ? "default" : "outline"}
              onClick={() => setDays(p.d)}
            >
              {p.l}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && <Skeleton className="h-72" />}

      {!isLoading && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {BRANDS.map((br) => (
              <Card key={br} className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
                  <Beer className="h-3.5 w-3.5" style={{ color: BRAND_COLOR[br] }} />
                  {BRAND_LABEL[br]}
                </div>
                <div className="font-display text-2xl" style={{ color: BRAND_COLOR[br] }}>
                  {data.totals[br]}
                </div>
                <div className="text-[11px] text-muted-foreground">barris no período</div>
              </Card>
            ))}
            <Card className="p-4">
              <div className="text-xs text-muted-foreground uppercase">Média/dia</div>
              <div className="font-display text-2xl">{media}</div>
              <div className="text-[11px] text-muted-foreground">barris/dia</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground uppercase">Pico</div>
              <div className="font-display text-2xl">{data.pico.total}</div>
              <div className="text-[11px] text-muted-foreground">em {data.pico.dia}</div>
            </Card>
          </div>

          <Card className="p-4">
            <h2 className="font-display text-sm tracking-widest text-muted-foreground mb-3">
              BARRIS CONSUMIDOS POR DIA — TOTAL {data.totalGeral}
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="Heineken"
                    stackId="a"
                    fill={BRAND_COLOR.heineken}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="Amstel"
                    stackId="a"
                    fill={BRAND_COLOR.amstel}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="font-display text-sm tracking-widest text-muted-foreground mb-2">
              DETALHE POR DIA
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-2">Dia</th>
                    <th className="py-1 px-2 text-right">Heineken</th>
                    <th className="py-1 px-2 text-right">Amstel</th>
                    <th className="py-1 pl-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.series.map((s) => (
                    <tr key={s.dia} className="border-t border-border/50">
                      <td className="py-1.5 pr-2">{s.dia}</td>
                      <td className="py-1.5 px-2 text-right">{s.Heineken}</td>
                      <td className="py-1.5 px-2 text-right">{s.Amstel}</td>
                      <td className="py-1.5 pl-2 text-right font-medium">{s.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
