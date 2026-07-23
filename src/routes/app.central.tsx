import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useSession";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Warehouse,
  FileText,
  Upload,
  Truck,
  Package,
  ArrowRight,
  ArrowRightLeft,
  PackageOpen,
} from "lucide-react";

export const Route = createFileRoute("/app/central")({ component: CentralPage });

const BRANDS = ["heineken", "amstel"] as const;
type Brand = (typeof BRANDS)[number];
const BRAND_LABEL: Record<Brand, string> = { heineken: "Heineken", amstel: "Amstel" };

function CentralPage() {
  const { user } = useSession();
  const perms = usePermissions(user?.id);
  const canView = perms.isGestor || perms.isManutencao;

  const { data, isLoading } = useQuery({
    queryKey: ["central-estoque"],
    enabled: canView,
    queryFn: async () => {
      const { data: bars } = await supabase
        .from("bars")
        .select("id")
        .in("bar_type", ["bar_venda", "bar_parceiro"]);
      const ids = (bars ?? []).map((b) => b.id);

      const [{ data: stds }, { data: invs }, { data: stock }, { data: whs }, { data: nfs }] =
        await Promise.all([
          supabase
            .from("bar_stock_standard")
            .select("bar_id,brand,barris_padrao")
            .in("bar_id", ids),
          supabase
            .from("inventories")
            .select("bar_id,performed_at,inventory_items(brand,status,quantidade)")
            .in("bar_id", ids)
            .order("performed_at", { ascending: false }),
          supabase.from("warehouse_stock").select("warehouse_id,brand,barrels"),
          supabase.from("warehouses").select("id,code,name"),
          supabase.from("notas_fiscais").select("id,status").eq("status", "pendente_revisao"),
        ]);

      const lastInv = new Map<string, any>();
      (invs ?? []).forEach((i: any) => {
        if (!lastInv.has(i.bar_id)) lastInv.set(i.bar_id, i);
      });

      const padraoBy: Record<string, Record<Brand, number>> = {};
      (stds ?? []).forEach((s: any) => {
        padraoBy[s.bar_id] ??= { heineken: 0, amstel: 0 };
        padraoBy[s.bar_id][s.brand as Brand] = s.barris_padrao ?? 0;
      });

      // Necessidade para manter os bares no padrão + vazios a retornar
      const needed: Record<Brand, number> = { heineken: 0, amstel: 0 };
      const vaziosBares: Record<Brand, number> = { heineken: 0, amstel: 0 };
      (bars ?? []).forEach((b: any) => {
        const inv = lastInv.get(b.id);
        const cheios: Record<Brand, number> = { heineken: 0, amstel: 0 };
        (inv?.inventory_items ?? []).forEach((it: any) => {
          if (it.status === "plugado" || it.status === "fechado") {
            cheios[it.brand as Brand] += it.quantidade ?? 0;
          } else if (it.status === "vazio") {
            vaziosBares[it.brand as Brand] += it.quantidade ?? 0;
          }
        });
        BRANDS.forEach((br) => {
          const padrao = padraoBy[b.id]?.[br] ?? 0;
          needed[br] += Math.max(0, padrao - cheios[br]);
        });
      });

      const whInfo: Record<string, { code: string; name: string }> = {};
      (whs ?? []).forEach((w: any) => (whInfo[w.id] = { code: w.code, name: w.name }));
      const stockBy: Record<string, Record<Brand, number>> = {};
      (stock ?? []).forEach((s: any) => {
        stockBy[s.warehouse_id] ??= { heineken: 0, amstel: 0 };
        stockBy[s.warehouse_id][s.brand as Brand] = s.barrels ?? 0;
      });
      const warehouses = (whs ?? [])
        .map((w: any) => ({
          code: whInfo[w.id].code,
          name: whInfo[w.id].name,
          stock: stockBy[w.id] ?? { heineken: 0, amstel: 0 },
        }))
        .sort((a, b) => (a.code === "dispel" ? -1 : b.code === "dispel" ? 1 : 0));

      return { warehouses, needed, vaziosBares, nfsPendentes: (nfs ?? []).length };
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
          <Warehouse className="h-6 w-6 text-primary" /> CENTRAL DE ESTOQUE
        </h1>
        <p className="text-xs text-muted-foreground">
          Fluxo único: Nota Fiscal → Estoque DISPEL → Bar / Allstar → volta vazio pro estoque.
        </p>
      </div>

      {/* Fluxo */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-display tracking-wider">
          <FlowStep icon={FileText} label="NOTA FISCAL" />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <FlowStep icon={Warehouse} label="ESTOQUE DISPEL" />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <FlowStep icon={Package} label="BAR / ALLSTAR" />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <FlowStep icon={PackageOpen} label="VAZIO → ESTOQUE" />
        </div>
      </Card>

      {isLoading && <Skeleton className="h-40" />}

      {!isLoading && data && (
        <>
          {/* Estoques ao vivo */}
          <div className="grid gap-3 sm:grid-cols-2">
            {data.warehouses.map((w) => (
              <Card key={w.code} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-display tracking-wider">{w.name}</div>
                  <Badge variant="outline" className="uppercase text-[10px]">
                    {w.code}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  {BRANDS.map((br) => (
                    <div key={br} className="rounded bg-muted/40 py-2">
                      <div className="font-display text-2xl">{w.stock[br]}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">
                        {BRAND_LABEL[br]}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          {/* Indicadores operacionais */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Falta p/ manter no padrão
              </div>
              <div className="font-display text-lg">
                {data.needed.heineken}H · {data.needed.amstel}A
              </div>
              <div className="text-[11px] text-muted-foreground">
                Barris a sair do estoque para os bares.
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Vazios nos bares
              </div>
              <div className="font-display text-lg text-accent">
                {data.vaziosBares.heineken}H · {data.vaziosBares.amstel}A
              </div>
              <div className="text-[11px] text-muted-foreground">
                A recolher e retornar ao estoque.
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Notas fiscais pendentes
              </div>
              <div className="font-display text-lg">{data.nfsPendentes}</div>
              <div className="text-[11px] text-muted-foreground">Aguardando conciliação.</div>
            </Card>
          </div>

          {/* Ações consolidadas */}
          <Card className="p-4">
            <h2 className="font-display text-sm tracking-widest text-muted-foreground mb-3">
              AÇÕES
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <ActionLink to="/app/notas" icon={FileText} title="Entrada por Nota Fiscal">
                Registrar NF (PDF/manual) e conciliar entrada no estoque.
              </ActionLink>
              <ActionLink to="/app/cargas" icon={Truck} title="Cargas Heineken">
                Recebimento de cargas e vasilhames (comodato).
              </ActionLink>
              <ActionLink to="/app/estoque" icon={ArrowRightLeft} title="Estoque & Transferências">
                Entradas/saídas e transferência DISPEL → Allstar.
              </ActionLink>
              <ActionLink to="/app/importar" icon={Upload} title="Importar em lote">
                Planilha/CSV de entradas de estoque e padrões.
              </ActionLink>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function FlowStep({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1.5">
      <Icon className="h-3.5 w-3.5 text-primary" />
      {label}
    </span>
  );
}

function ActionLink({
  to,
  icon: Icon,
  title,
  children,
}: {
  to: string;
  icon: any;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 rounded border border-border p-3 hover:border-primary transition"
    >
      <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div>
        <div className="font-display text-sm tracking-wide">{title}</div>
        <div className="text-[11px] text-muted-foreground">{children}</div>
      </div>
    </Link>
  );
}
