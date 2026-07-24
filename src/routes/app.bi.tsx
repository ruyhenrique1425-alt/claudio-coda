import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useSession";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Warehouse, PackageOpen, Beer } from "lucide-react";

export const Route = createFileRoute("/app/bi")({ component: BIPage });

const BRANDS = ["heineken", "amstel"] as const;
type Brand = (typeof BRANDS)[number];
type State = "plugado" | "fechado" | "vazio";
const BRAND_LABEL: Record<Brand, string> = { heineken: "Heineken", amstel: "Amstel" };

type BarBI = {
  id: string;
  name: string;
  rota: string | null;
  counts: Record<Brand, Record<State, number>>;
  padrao: Record<Brand, number>;
  hasInv: boolean;
};

const emptyCounts = (): Record<Brand, Record<State, number>> => ({
  heineken: { plugado: 0, fechado: 0, vazio: 0 },
  amstel: { plugado: 0, fechado: 0, vazio: 0 },
});

function BIPage() {
  const { user } = useSession();
  const perms = usePermissions(user?.id);
  const canView = perms.isGestor || perms.isManutencao;

  const { data, isLoading } = useQuery({
    queryKey: ["bi-barris"],
    enabled: canView,
    queryFn: async () => {
      const { data: bars, error } = await supabase
        .from("bars")
        .select("id,name")
        .in("bar_type", ["bar_venda", "bar_parceiro"])
        .order("name");
      if (error) throw error;
      const ids = (bars ?? []).map((b) => b.id);

      const [{ data: stds }, { data: invs }, { data: stock }, { data: whs }] = await Promise.all([
        supabase.from("bar_stock_standard").select("bar_id,brand,barris_padrao").in("bar_id", ids),
        supabase
          .from("inventories")
          .select("bar_id,performed_at,inventory_items(brand,status,quantidade)")
          .in("bar_id", ids)
          .order("performed_at", { ascending: false }),
        supabase.from("warehouse_stock").select("warehouse_id,brand,barrels"),
        supabase.from("warehouses").select("id,code,name"),
      ]);

      // Rotas são opcionais: se a migration ainda não foi aplicada, ignoramos.
      let rotaByBar: Record<string, string> = {};
      try {
        const res = await (supabase as any).from("bars").select("id,rota_id").in("id", ids);
        const rotasRes = await (supabase as any).from("rotas").select("id,nome");
        if (!res.error && !rotasRes.error) {
          const rotaName: Record<string, string> = {};
          (rotasRes.data ?? []).forEach((r: any) => (rotaName[r.id] = r.nome));
          (res.data ?? []).forEach((b: any) => {
            if (b.rota_id && rotaName[b.rota_id]) rotaByBar[b.id] = rotaName[b.rota_id];
          });
        }
      } catch {
        rotaByBar = {};
      }

      const lastInv = new Map<string, any>();
      (invs ?? []).forEach((i: any) => {
        if (!lastInv.has(i.bar_id)) lastInv.set(i.bar_id, i);
      });

      const padraoBy: Record<string, Record<Brand, number>> = {};
      (stds ?? []).forEach((s: any) => {
        padraoBy[s.bar_id] ??= { heineken: 0, amstel: 0 };
        padraoBy[s.bar_id][s.brand as Brand] = s.barris_padrao ?? 0;
      });

      const barsBI: BarBI[] = (bars ?? []).map((b: any) => {
        const inv = lastInv.get(b.id);
        const counts = emptyCounts();
        (inv?.inventory_items ?? []).forEach((it: any) => {
          if (counts[it.brand as Brand] && it.status in counts[it.brand as Brand]) {
            counts[it.brand as Brand][it.status as State] += it.quantidade ?? 0;
          }
        });
        return {
          id: b.id,
          name: b.name,
          rota: rotaByBar[b.id] ?? null,
          counts,
          padrao: padraoBy[b.id] ?? { heineken: 0, amstel: 0 },
          hasInv: !!inv,
        };
      });

      // Totais nos bares por marca/estado
      const barsTotals = emptyCounts();
      barsBI.forEach((b) =>
        BRANDS.forEach((br) =>
          (["plugado", "fechado", "vazio"] as State[]).forEach(
            (st) => (barsTotals[br][st] += b.counts[br][st]),
          ),
        ),
      );

      // Estoque por armazém
      const whName: Record<string, string> = {};
      const whCode: Record<string, string> = {};
      (whs ?? []).forEach((w: any) => {
        whName[w.id] = w.name;
        whCode[w.id] = w.code;
      });
      const stockBy: Record<string, Record<Brand, number>> = {};
      (stock ?? []).forEach((s: any) => {
        stockBy[s.warehouse_id] ??= { heineken: 0, amstel: 0 };
        stockBy[s.warehouse_id][s.brand as Brand] = s.barrels ?? 0;
      });
      const warehouses = (whs ?? []).map((w: any) => ({
        code: whCode[w.id],
        name: whName[w.id],
        stock: stockBy[w.id] ?? { heineken: 0, amstel: 0 },
      }));

      // Total geral por marca (bares cheios + vazios + estoque)
      const stockTotal: Record<Brand, number> = { heineken: 0, amstel: 0 };
      warehouses.forEach((w) =>
        BRANDS.forEach((br) => (stockTotal[br] += w.stock[br as Brand] ?? 0)),
      );

      const grand: Record<
        Brand,
        { cheios: number; vazios: number; estoque: number; total: number }
      > = {
        heineken: { cheios: 0, vazios: 0, estoque: 0, total: 0 },
        amstel: { cheios: 0, vazios: 0, estoque: 0, total: 0 },
      };
      BRANDS.forEach((br) => {
        const cheios = barsTotals[br].plugado + barsTotals[br].fechado;
        const vazios = barsTotals[br].vazio;
        const estoque = stockTotal[br];
        grand[br] = { cheios, vazios, estoque, total: cheios + vazios + estoque };
      });

      // Sugestão de reposição por rota (no padrão, reposição = vazios)
      const hasRotas = barsBI.some((b) => b.rota);
      const groups: Record<string, BarBI[]> = {};
      barsBI.forEach((b) => {
        const key = b.rota ?? (hasRotas ? "Sem rota" : "Todos os bares");
        (groups[key] ??= []).push(b);
      });

      return { barsBI, barsTotals, warehouses, grand, groups, hasRotas };
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
    <div className="mx-auto max-w-6xl p-4 space-y-4">
      <div>
        <h1 className="font-display text-2xl tracking-wider flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> BI — CONTROLE DE BARRIS
        </h1>
        <p className="text-xs text-muted-foreground">
          Quantidade exata de barris por marca e estado, estoques e sugestão de reposição por rota.
        </p>
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}

      {!isLoading && data && (
        <>
          {/* Total geral por marca */}
          <div className="grid gap-3 sm:grid-cols-2">
            {BRANDS.map((br) => {
              const g = data.grand[br];
              return (
                <Card key={br} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Beer className="h-4 w-4 text-primary" />
                    <span className="font-display tracking-wider">{BRAND_LABEL[br]}</span>
                    <Badge variant="outline" className="ml-auto">
                      {g.total} barris no total
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Metric label="Cheios (bares)" value={g.cheios} />
                    <Metric label="Vazios (bares)" value={g.vazios} accent />
                    <Metric label="Estoque" value={g.estoque} />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Barris por estado nos bares */}
          <Card className="p-4">
            <h2 className="font-display text-sm tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <PackageOpen className="h-4 w-4" /> BARRIS NOS BARES (por estado)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-2">Marca</th>
                    <th className="py-1 px-2 text-right">Plugado</th>
                    <th className="py-1 px-2 text-right">Fechado</th>
                    <th className="py-1 px-2 text-right">Vazio</th>
                    <th className="py-1 pl-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {BRANDS.map((br) => {
                    const t = data.barsTotals[br];
                    return (
                      <tr key={br} className="border-t border-border/50">
                        <td className="py-1.5 pr-2 uppercase">{BRAND_LABEL[br]}</td>
                        <td className="py-1.5 px-2 text-right">{t.plugado}</td>
                        <td className="py-1.5 px-2 text-right">{t.fechado}</td>
                        <td className="py-1.5 px-2 text-right font-bold text-accent">{t.vazio}</td>
                        <td className="py-1.5 pl-2 text-right font-bold">
                          {t.plugado + t.fechado + t.vazio}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Estoques */}
          <Card className="p-4">
            <h2 className="font-display text-sm tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <Warehouse className="h-4 w-4" /> ESTOQUES
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.warehouses.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum armazém cadastrado.</p>
              )}
              {data.warehouses.map((w) => (
                <div key={w.code} className="rounded border border-border p-3">
                  <div className="font-display text-sm tracking-wider">{w.name}</div>
                  <div className="text-[10px] text-muted-foreground uppercase mb-2">{w.code}</div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    {BRANDS.map((br) => (
                      <Metric key={br} label={BRAND_LABEL[br]} value={w.stock[br]} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Sugestão de reposição por rota */}
          <Card className="p-4">
            <h2 className="font-display text-sm tracking-widest text-muted-foreground mb-1">
              SUGESTÃO DE REPOSIÇÃO {data.hasRotas ? "POR ROTA" : ""}
            </h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              <b>Carregar</b> = barris a levar para voltar ao padrão (padrão − cheios). ·{" "}
              <b>Vazios</b> = a recolher. No padrão, os dois são iguais. Use o total da rota para
              montar o pallet.
            </p>
            {!data.hasRotas && (
              <p className="text-[11px] text-amber-600 mb-3">
                Rotas ainda não configuradas — aplique a migration de rotas para agrupar por rota.
              </p>
            )}
            <div className="space-y-4">
              {Object.entries(data.groups)
                .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
                .map(([rota, list]) => {
                  const gapOf = (b: BarBI, br: Brand) =>
                    Math.max(0, b.padrao[br] - (b.counts[br].plugado + b.counts[br].fechado));
                  const carH = list.reduce((s, b) => s + gapOf(b, "heineken"), 0);
                  const carA = list.reduce((s, b) => s + gapOf(b, "amstel"), 0);
                  const vazH = list.reduce((s, b) => s + b.counts.heineken.vazio, 0);
                  const vazA = list.reduce((s, b) => s + b.counts.amstel.vazio, 0);
                  return (
                    <div key={rota}>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-display text-sm tracking-wider">{rota}</span>
                        <Badge className="text-[10px] bg-primary/15 text-primary hover:bg-primary/15">
                          Carregar {carH}H · {carA}A
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          Vazios {vazH}H · {vazA}A
                        </Badge>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-muted-foreground">
                              <th className="py-1 pr-2">Bar</th>
                              <th className="py-1 px-2 text-right">Carregar</th>
                              <th className="py-1 px-2 text-right">Vazios</th>
                              <th className="py-1 pl-2 text-right">Padrão</th>
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((b) => (
                              <tr key={b.id} className="border-t border-border/50">
                                <td className="py-1.5 pr-2">
                                  {b.name}
                                  {!b.hasInv && (
                                    <span className="ml-1 text-[10px] text-muted-foreground">
                                      (sem inventário)
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 px-2 text-right font-medium text-primary">
                                  {gapOf(b, "heineken")}H · {gapOf(b, "amstel")}A
                                </td>
                                <td className="py-1.5 px-2 text-right">
                                  {b.counts.heineken.vazio}H · {b.counts.amstel.vazio}A
                                </td>
                                <td className="py-1.5 pl-2 text-right text-muted-foreground">
                                  {b.padrao.heineken}H · {b.padrao.amstel}A
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded bg-muted/40 py-2">
      <div className={`font-display text-xl ${accent ? "text-accent" : ""}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}
