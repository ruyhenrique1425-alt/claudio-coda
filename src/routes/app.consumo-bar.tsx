import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useSession";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Beer, BarChart3, Info } from "lucide-react";

export const Route = createFileRoute("/app/consumo-bar")({ component: ConsumoBarPage });

type Row = { bar_nome: string; data: string; marca: string; barris: number };

function ConsumoBarPage() {
  const { user } = useSession();
  const perms = usePermissions(user?.id);
  const canView = perms.isGestor || perms.isManutencao;

  const { data, isLoading } = useQuery({
    queryKey: ["consumo-bar-meep"],
    enabled: canView,
    queryFn: async () => {
      let rows: Row[] = [];
      let tableReady = true;
      try {
        const res = await (supabase as any)
          .from("meep_consumo_bar")
          .select("bar_nome,data,marca,barris")
          .order("data", { ascending: true });
        if (res.error) tableReady = false;
        else rows = res.data ?? [];
      } catch {
        tableReady = false;
      }

      const byBar: Record<
        string,
        { nome: string; heineken: number; amstel: number; total: number }
      > = {};
      const byDay: Record<string, { heineken: number; amstel: number }> = {};
      rows.forEach((r) => {
        const q = Number(r.barris) || 0;
        const br = r.marca === "heineken" ? "heineken" : r.marca === "amstel" ? "amstel" : null;
        byBar[r.bar_nome] ??= { nome: r.bar_nome, heineken: 0, amstel: 0, total: 0 };
        if (br) byBar[r.bar_nome][br] += q;
        byBar[r.bar_nome].total += q;
        byDay[r.data] ??= { heineken: 0, amstel: 0 };
        if (br) byDay[r.data][br] += q;
      });

      const bars = Object.values(byBar).sort((a, b) => b.total - a.total);
      const dias = Object.keys(byDay)
        .sort()
        .map((d) => ({ data: d, ...byDay[d], total: byDay[d].heineken + byDay[d].amstel }));
      const totalGeral = bars.reduce((s, b) => s + b.total, 0);
      return { bars, dias, totalGeral, tableReady, count: rows.length };
    },
  });

  if (!canView) {
    return (
      <div className="p-4">
        <Card className="p-6 text-sm text-muted-foreground">Acesso restrito.</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <div>
        <h1 className="font-display text-2xl tracking-wider flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> CONSUMO POR BAR (REAL)
        </h1>
        <p className="text-xs text-muted-foreground">
          Consumo real de chopp por bar (evento de vendas da MEEP). Diferente do abastecimento
          (barris entregues).
        </p>
      </div>

      {isLoading && <Skeleton className="h-40" />}

      {!isLoading && data && !data.tableReady && (
        <Card className="p-4 text-sm text-muted-foreground flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            A base de consumo ainda não foi criada. Aplique a migration{" "}
            <code>20260724120000_meep_consumo.sql</code> e importe o consumo em{" "}
            <Link to="/app/central" className="text-primary underline underline-offset-2">
              Central → Importar
            </Link>{" "}
            (modo "Consumo MEEP").
          </span>
        </Card>
      )}

      {!isLoading && data && data.tableReady && data.count === 0 && (
        <Card className="p-4 text-sm text-muted-foreground flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Nenhum consumo importado ainda. Importe o CSV de consumo em{" "}
            <Link to="/app/central" className="text-primary underline underline-offset-2">
              Central → Importar
            </Link>
            .
          </span>
        </Card>
      )}

      {!isLoading && data && data.count > 0 && (
        <>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Beer className="h-4 w-4 text-primary" />
              <span className="font-display tracking-wider">TOTAL DE CHOPPS CONSUMIDOS</span>
              <Badge variant="outline" className="ml-auto">
                {data.totalGeral}
              </Badge>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="font-display text-sm tracking-widest text-muted-foreground mb-3">
              POR BAR
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-2">Bar</th>
                    <th className="py-1 px-2 text-right">Heineken</th>
                    <th className="py-1 px-2 text-right">Amstel</th>
                    <th className="py-1 pl-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bars.map((b) => (
                    <tr key={b.nome} className="border-t border-border/50">
                      <td className="py-1.5 pr-2">{b.nome}</td>
                      <td className="py-1.5 px-2 text-right">{b.heineken}</td>
                      <td className="py-1.5 px-2 text-right">{b.amstel}</td>
                      <td className="py-1.5 pl-2 text-right font-medium">{b.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="font-display text-sm tracking-widest text-muted-foreground mb-3">
              POR DIA
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
                  {data.dias.map((d) => (
                    <tr key={d.data} className="border-t border-border/50">
                      <td className="py-1.5 pr-2">
                        {new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-1.5 px-2 text-right">{d.heineken}</td>
                      <td className="py-1.5 px-2 text-right">{d.amstel}</td>
                      <td className="py-1.5 pl-2 text-right font-medium">{d.total}</td>
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
