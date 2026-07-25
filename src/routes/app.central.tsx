import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BAR_TYPES_OPERACAO,
  recolhidosAposInventario,
  vaziosARecolher,
} from "@/lib/operacao";
import { useSession, usePermissions } from "@/hooks/useSession";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Warehouse, FileText, Package, ArrowRight, RefreshCcw, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/central")({ component: CentralPage });

// Telas reais carregadas sob demanda (só quando a aba é aberta).
const EstoquePanel = lazy(() => import("./app.estoque").then((m) => ({ default: m.EstoquePage })));
const CargasPanel = lazy(() =>
  import("./app.cargas").then((m) => ({ default: m.CargasHeinekenPage })),
);
const NotasPanel = lazy(() => import("./app.notas").then((m) => ({ default: m.NotasPage })));
const ImportarPanel = lazy(() =>
  import("./app.importar").then((m) => ({ default: m.ImportarPage })),
);
const BalancoPanel = lazy(() => import("./app.balanco").then((m) => ({ default: m.BalancoPage })));

const BRANDS = ["heineken", "amstel"] as const;
type Brand = (typeof BRANDS)[number];
const BRAND_LABEL: Record<Brand, string> = { heineken: "Heineken", amstel: "Amstel" };

function TabFallback() {
  return (
    <div className="p-8 text-center text-muted-foreground">
      <Loader2 className="inline animate-spin mr-2" />
      Carregando…
    </div>
  );
}

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
        .in("bar_type", [...BAR_TYPES_OPERACAO]);
      const ids = (bars ?? []).map((b) => b.id);

      const [
        { data: stds },
        { data: invs },
        { data: stock },
        { data: whs },
        { data: nfs },
        { data: comodato },
        { data: emps },
      ] = await Promise.all([
        supabase.from("bar_stock_standard").select("bar_id,brand,barris_padrao").in("bar_id", ids),
        supabase
          .from("inventories")
          .select("bar_id,performed_at,inventory_items(brand,status,quantidade)")
          .in("bar_id", ids)
          .order("performed_at", { ascending: false }),
        supabase.from("warehouse_stock").select("warehouse_id,brand,barrels"),
        supabase.from("warehouses").select("id,code,name"),
        supabase.from("notas_fiscais").select("id,status").eq("status", "pendente_revisao"),
        supabase
          .from("controle_comodato_global")
          .select(
            "marca,cheios_recebidos_acumulados,vazios_devolvidos_acumulados,vazios_disponiveis",
          ),
        supabase
          .from("empties_removed")
          .select("bar_id,brand,quantidade,performed_at")
          .in("bar_id", ids),
      ]);

      const lastInv = new Map<string, any>();
      (invs ?? []).forEach((i: any) => {
        if (!lastInv.has(i.bar_id)) lastInv.set(i.bar_id, i);
      });

      // "Vazios nos bares" desconta o que já foi recolhido depois da foto do
      // inventário — recolher não reescreve o inventário. Ver lib/operacao.
      const invAtPorBar = new Map<string, string | null>();
      lastInv.forEach((inv, barId) => invAtPorBar.set(barId, inv?.performed_at ?? null));
      const recolhidosApos = recolhidosAposInventario((emps ?? []) as any, invAtPorBar);

      const padraoBy: Record<string, Record<Brand, number>> = {};
      (stds ?? []).forEach((s: any) => {
        padraoBy[s.bar_id] ??= { heineken: 0, amstel: 0 };
        padraoBy[s.bar_id][s.brand as Brand] = s.barris_padrao ?? 0;
      });

      const needed: Record<Brand, number> = { heineken: 0, amstel: 0 };
      const vaziosBares: Record<Brand, number> = { heineken: 0, amstel: 0 };
      (bars ?? []).forEach((b: any) => {
        const inv = lastInv.get(b.id);
        const cheios: Record<Brand, number> = { heineken: 0, amstel: 0 };
        (inv?.inventory_items ?? []).forEach((it: any) => {
          if (it.status === "plugado" || it.status === "fechado") {
            cheios[it.brand as Brand] += it.quantidade ?? 0;
          } else if (it.status === "vazio") {
            vaziosBares[it.brand as Brand] += vaziosARecolher(
              it.quantidade ?? 0,
              b.id,
              it.brand as Brand,
              recolhidosApos,
            );
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

      // Comodato por marca: nunca devolver mais vazios do que os cheios recebidos.
      const comodatoBy: Record<
        Brand,
        { recebidos: number; devolvidos: number; aDevolver: number }
      > = {
        heineken: { recebidos: 0, devolvidos: 0, aDevolver: 0 },
        amstel: { recebidos: 0, devolvidos: 0, aDevolver: 0 },
      };
      (comodato ?? []).forEach((c: any) => {
        const br = String(c.marca).toLowerCase() as Brand;
        if (!comodatoBy[br]) return;
        const recebidos = c.cheios_recebidos_acumulados ?? 0;
        const devolvidos = c.vazios_devolvidos_acumulados ?? 0;
        comodatoBy[br] = {
          recebidos,
          devolvidos,
          aDevolver: Math.max(0, recebidos - devolvidos),
        };
      });

      return { warehouses, needed, vaziosBares, nfsPendentes: (nfs ?? []).length, comodatoBy };
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
          <Warehouse className="h-6 w-6 text-primary" /> CENTRAL DE ESTOQUE
        </h1>
        <p className="text-xs text-muted-foreground">
          Estoque, entradas (cargas/NF), comodato e importação — tudo em um lugar. Fluxo: Nota
          Fiscal → Estoque DISPEL → Bar / Allstar → volta vazio.
        </p>
      </div>

      <Tabs defaultValue="visao">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="visao" className="text-[11px] font-display tracking-wider">
            VISÃO GERAL
          </TabsTrigger>
          <TabsTrigger value="estoque" className="text-[11px] font-display tracking-wider">
            ESTOQUE
          </TabsTrigger>
          <TabsTrigger value="entradas" className="text-[11px] font-display tracking-wider">
            ENTRADAS
          </TabsTrigger>
          <TabsTrigger value="balanco" className="text-[11px] font-display tracking-wider">
            BALANÇO
          </TabsTrigger>
        </TabsList>

        {/* ---------------- Visão geral ---------------- */}
        <TabsContent value="visao" className="mt-4 space-y-4">
          {/* Fluxo */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-display tracking-wider">
              <FlowStep icon={FileText} label="NOTA FISCAL / CARGA" />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <FlowStep icon={Warehouse} label="ESTOQUE DISPEL" />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <FlowStep icon={Package} label="BAR / ALLSTAR" />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <FlowStep icon={RefreshCcw} label="VAZIO → HEINEKEN" />
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

              {/* Indicadores */}
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

              {/* Comodato */}
              <Card className="p-4">
                <h2 className="font-display text-sm tracking-widest text-muted-foreground mb-1">
                  COMODATO HEINEKEN
                </h2>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Todo barril cheio que entra deve voltar vazio. Não se pode devolver mais vazios do
                  que os cheios recebidos.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {BRANDS.map((br) => {
                    const c = data.comodatoBy[br];
                    return (
                      <div key={br} className="rounded border border-border p-3">
                        <div className="font-display text-sm tracking-wider uppercase mb-2">
                          {BRAND_LABEL[br]}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <Metric label="Recebidos" value={c.recebidos} />
                          <Metric label="Devolvidos" value={c.devolvidos} />
                          <Metric label="A devolver" value={c.aDevolver} accent />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <div className="text-[11px] text-muted-foreground">
                Precisa da contagem por bar e estado?{" "}
                <Link to="/app/operacao" className="text-primary underline underline-offset-2">
                  Abrir Barris (contagem)
                </Link>
                .
              </div>
            </>
          )}
        </TabsContent>

        {/* ---------------- Telas reais ---------------- */}
        <TabsContent value="estoque" className="mt-2">
          <Suspense fallback={<TabFallback />}>
            <EstoquePanel />
          </Suspense>
        </TabsContent>
        <TabsContent value="entradas" className="mt-2">
          <p className="text-[11px] text-muted-foreground mb-3">
            Três jeitos de dar entrada de barril no estoque — todos alimentam o mesmo lugar.
            Escolha pelo que você tem em mãos.
          </p>
          <Tabs defaultValue="manual">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="manual" className="text-[10px] font-display tracking-wider">
                MANUAL / CARGA
              </TabsTrigger>
              <TabsTrigger value="nf" className="text-[10px] font-display tracking-wider">
                NOTA FISCAL
              </TabsTrigger>
              <TabsTrigger value="csv" className="text-[10px] font-display tracking-wider">
                IMPORTAR CSV
              </TabsTrigger>
            </TabsList>
            <TabsContent value="manual" className="mt-2">
              <p className="text-[10px] text-muted-foreground mb-2">
                Entrada rápida, digitando a quantidade e anexando foto. Para o dia a dia.
              </p>
              <Suspense fallback={<TabFallback />}>
                <CargasPanel />
              </Suspense>
            </TabsContent>
            <TabsContent value="nf" className="mt-2">
              <p className="text-[10px] text-muted-foreground mb-2">
                Cadastra a NF (PDF ou foto) e concilia para virar entrada. Deixa o documento
                anexado para auditoria.
              </p>
              <Suspense fallback={<TabFallback />}>
                <NotasPanel />
              </Suspense>
            </TabsContent>
            <TabsContent value="csv" className="mt-2">
              <p className="text-[10px] text-muted-foreground mb-2">
                Várias entradas de uma vez, via planilha. Use quando tiver muitas notas juntas
                (ex.: o CSV consolidado das NFs).
              </p>
              <Suspense fallback={<TabFallback />}>
                <ImportarPanel />
              </Suspense>
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="balanco" className="mt-2">
          <Suspense fallback={<TabFallback />}>
            <BalancoPanel />
          </Suspense>
        </TabsContent>
      </Tabs>
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

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded bg-muted/40 py-2">
      <div className={`font-display text-xl ${accent ? "text-accent" : ""}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}
