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
import {
  Gauge,
  TriangleAlert,
  Truck,
  Warehouse,
  Recycle,
  Beer,
  TrendingUp,
  CircleCheck,
} from "lucide-react";

export const Route = createFileRoute("/app/operacao")({ component: BarrisHub });

// O BI de barris vira aba aqui: as duas telas repetiam a reposição por rota.
// A rota /app/bi continua existindo, então links antigos seguem funcionando.
const BIPanel = lazy(() => import("./app.bi").then((m) => ({ default: m.BIPage })));

function BarrisHub() {
  const { user } = useSession();
  const perms = usePermissions(user?.id);
  const canView = perms.isGestor || perms.isManutencao;

  if (!canView) {
    return (
      <div className="p-4">
        <Card className="p-6 text-sm text-muted-foreground">Acesso restrito.</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="mb-3">
        <h1 className="font-display text-2xl tracking-wider flex items-center gap-2">
          <Gauge className="h-6 w-6 text-primary" /> BARRIS
        </h1>
        <p className="text-xs text-muted-foreground">
          Planejamento da rodada e a contagem exata que a sustenta.
        </p>
      </div>
      <Tabs defaultValue="cobertura">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="cobertura" className="text-[11px] font-display tracking-wider">
            COBERTURA &amp; ROTAS
          </TabsTrigger>
          <TabsTrigger value="contagem" className="text-[11px] font-display tracking-wider">
            CONTAGEM (BI)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="cobertura" className="mt-2">
          <OperacaoPage />
        </TabsContent>
        <TabsContent value="contagem" className="mt-2">
          <Suspense
            fallback={<div className="p-8 text-center text-muted-foreground">Carregando…</div>}
          >
            <BIPanel />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const BRANDS = ["heineken", "amstel"] as const;
type Brand = (typeof BRANDS)[number];
type State = "plugado" | "fechado" | "vazio";

type BarOp = {
  id: string;
  name: string;
  rota: string | null;
  cheios: Record<Brand, number>;
  vazios: Record<Brand, number>;
  padrao: Record<Brand, number>;
  /** barris a carregar para voltar ao padrão (padrão − cheios), por marca */
  repor: Record<Brand, number>;
  /** % do padrão atendido considerando as duas marcas (0..1). null = sem padrão definido */
  atendimento: number | null;
  hasInv: boolean;
};

type Severidade = "critico" | "atencao" | "ok";

const zero = (): Record<Brand, number> => ({ heineken: 0, amstel: 0 });

export function OperacaoPage() {
  const { user } = useSession();
  const perms = usePermissions(user?.id);
  const canView = perms.isGestor || perms.isManutencao;

  const { data, isLoading } = useQuery({
    queryKey: ["central-operacao"],
    enabled: canView,
    refetchInterval: 60_000, // operação ao vivo: atualiza sozinho a cada minuto
    queryFn: async () => {
      const { data: bars, error } = await supabase
        .from("bars")
        .select("id,name")
        .in("bar_type", [...BAR_TYPES_OPERACAO])
        .order("name");
      if (error) throw error;
      const ids = (bars ?? []).map((b) => b.id);

      const [{ data: stds }, { data: invs }, { data: stock }, { data: whs }, { data: emps }] =
        await Promise.all([
        supabase.from("bar_stock_standard").select("bar_id,brand,barris_padrao").in("bar_id", ids),
        supabase
          .from("inventories")
          .select("bar_id,performed_at,inventory_items(brand,status,quantidade)")
          .in("bar_id", ids)
          .order("performed_at", { ascending: false }),
        supabase.from("warehouse_stock").select("warehouse_id,brand,barrels"),
        supabase.from("warehouses").select("id,code,name"),
        // Para descontar da foto do inventário o que já foi recolhido depois
        // dela — ver recolhidosAposInventario() em lib/operacao.
        supabase
          .from("empties_removed")
          .select("bar_id,brand,quantidade,performed_at")
          .in("bar_id", ids),
      ]);

      // --- Rotas (opcional: migration pode não ter sido aplicada) ---
      const rotaByBar: Record<string, string> = {};
      try {
        const [resBars, resRotas] = await Promise.all([
          (supabase as any).from("bars").select("id,rota_id").in("id", ids),
          (supabase as any).from("rotas").select("id,nome"),
        ]);
        if (!resBars.error && !resRotas.error) {
          const rotaName: Record<string, string> = {};
          (resRotas.data ?? []).forEach((r: any) => (rotaName[r.id] = r.nome));
          (resBars.data ?? []).forEach((b: any) => {
            if (b.rota_id && rotaName[b.rota_id]) rotaByBar[b.id] = rotaName[b.rota_id];
          });
        }
      } catch {
        /* sem rotas: agrupa tudo junto */
      }

      // --- Consumo real MEEP (opcional) ---
      let consumoRows: { data: string; marca: string; barris: number }[] = [];
      let consumoReady = true;
      try {
        const res = await (supabase as any)
          .from("meep_consumo_bar")
          .select("data,marca,barris")
          .order("data", { ascending: true });
        if (res.error) consumoReady = false;
        else consumoRows = res.data ?? [];
      } catch {
        consumoReady = false;
      }

      // --- Vazios parados no estoque (estágio intermediário do fluxo) ---
      // Tabela nova: leitura resiliente, a migration pode não ter sido aplicada.
      // No DISPEL o vazio vira VASILHAME e perde a marca (pool). Na Allstar
      // o vazio ainda é separado por marca. Somamos os dois para o estágio 2.
      let vaziosEstoqueTotal = 0;
      let vaziosEstoqueOk = false;
      try {
        const [pool, porMarca] = await Promise.all([
          (supabase as any).from("warehouse_vasilhames").select("barrels"),
          (supabase as any).from("warehouse_empty_stock").select("barrels"),
        ]);
        if (!pool.error) {
          vaziosEstoqueOk = true;
          (pool.data ?? []).forEach((r: any) => {
            vaziosEstoqueTotal += Number(r.barrels) || 0;
          });
        }
        if (!porMarca.error) {
          (porMarca.data ?? []).forEach((r: any) => {
            vaziosEstoqueTotal += Number(r.barrels) || 0;
          });
        }
      } catch {
        /* migrations do fluxo de vazios ainda não aplicadas */
      }

      // --- Comodato (opcional) ---
      let comodato: {
        marca: string;
        cheios_recebidos_acumulados: number;
        vazios_devolvidos_acumulados: number;
        vazios_disponiveis: number;
      }[] = [];
      try {
        const res = await (supabase as any)
          .from("controle_comodato_global")
          .select(
            "marca,cheios_recebidos_acumulados,vazios_devolvidos_acumulados,vazios_disponiveis",
          );
        if (!res.error) comodato = res.data ?? [];
      } catch {
        /* sem comodato */
      }

      // --- Último inventário por bar ---
      const lastInv = new Map<string, any>();
      (invs ?? []).forEach((i: any) => {
        if (!lastInv.has(i.bar_id)) lastInv.set(i.bar_id, i);
      });

      // Data do último inventário por bar → base para corrigir os vazios.
      const invAtPorBar = new Map<string, string | null>();
      lastInv.forEach((inv, barId) => invAtPorBar.set(barId, inv?.performed_at ?? null));
      const recolhidosApos = recolhidosAposInventario((emps ?? []) as any, invAtPorBar);

      const padraoBy: Record<string, Record<Brand, number>> = {};
      (stds ?? []).forEach((s: any) => {
        padraoBy[s.bar_id] ??= zero();
        padraoBy[s.bar_id][s.brand as Brand] = s.barris_padrao ?? 0;
      });

      // --- Monta a visão por bar ---
      const barsOp: BarOp[] = (bars ?? []).map((b: any) => {
        const inv = lastInv.get(b.id);
        const counts: Record<Brand, Record<State, number>> = {
          heineken: { plugado: 0, fechado: 0, vazio: 0 },
          amstel: { plugado: 0, fechado: 0, vazio: 0 },
        };
        (inv?.inventory_items ?? []).forEach((it: any) => {
          const br = it.brand as Brand;
          const st = it.status as State;
          if (counts[br] && st in counts[br]) counts[br][st] += it.quantidade ?? 0;
        });

        const padrao = padraoBy[b.id] ?? zero();
        const cheios = zero();
        const vazios = zero();
        const repor = zero();
        BRANDS.forEach((br) => {
          cheios[br] = counts[br].plugado + counts[br].fechado;
          vazios[br] = vaziosARecolher(counts[br].vazio, b.id, br, recolhidosApos);
          repor[br] = Math.max(0, padrao[br] - cheios[br]);
        });

        const padraoTotal = padrao.heineken + padrao.amstel;
        const cheiosTotal = cheios.heineken + cheios.amstel;
        const atendimento =
          padraoTotal > 0 ? Math.min(1, cheiosTotal / padraoTotal) : null;

        return {
          id: b.id,
          name: b.name,
          rota: rotaByBar[b.id] ?? null,
          cheios,
          vazios,
          padrao,
          repor,
          atendimento,
          hasInv: !!inv,
        };
      });

      // --- Totais operacionais ---
      const aRepor = zero();
      const vaziosRecolher = zero();
      const cheiosCampo = zero();
      const padraoTotalMarca = zero();
      barsOp.forEach((b) =>
        BRANDS.forEach((br) => {
          aRepor[br] += b.repor[br];
          vaziosRecolher[br] += b.vazios[br];
          cheiosCampo[br] += b.cheios[br];
          padraoTotalMarca[br] += b.padrao[br];
        }),
      );

      // --- Estoques ---
      const stockBy: Record<string, Record<Brand, number>> = {};
      (stock ?? []).forEach((s: any) => {
        stockBy[s.warehouse_id] ??= zero();
        stockBy[s.warehouse_id][s.brand as Brand] = s.barrels ?? 0;
      });
      const warehouses = (whs ?? []).map((w: any) => ({
        code: String(w.code ?? ""),
        name: String(w.name ?? ""),
        stock: stockBy[w.id] ?? zero(),
      }));
      const estoqueTotal = zero();
      warehouses.forEach((w) => BRANDS.forEach((br) => (estoqueTotal[br] += w.stock[br])));
      const estoqueDispel =
        warehouses.find((w) => w.code.toLowerCase() === "dispel")?.stock ?? zero();

      // --- Consumo: ritmo diário (só visualização — não dirige reposição) ---
      const byDay: Record<string, Record<Brand, number>> = {};
      consumoRows.forEach((r) => {
        const br = r.marca === "heineken" ? "heineken" : r.marca === "amstel" ? "amstel" : null;
        if (!br) return;
        byDay[r.data] ??= zero();
        byDay[r.data][br] += Number(r.barris) || 0;
      });
      const dias = Object.keys(byDay)
        .sort()
        .map((d) => ({
          data: d,
          heineken: byDay[d].heineken,
          amstel: byDay[d].amstel,
          total: byDay[d].heineken + byDay[d].amstel,
        }));
      const consumoTotal = zero();
      dias.forEach((d) => BRANDS.forEach((br) => (consumoTotal[br] += d[br])));
      const consumoGeral = consumoTotal.heineken + consumoTotal.amstel;
      const nDias = dias.length;
      const mediaDia = nDias > 0 ? consumoGeral / nDias : 0;
      const ultimoDia = nDias > 0 ? dias[nDias - 1] : null;
      const picoDia = dias.reduce<(typeof dias)[number] | null>(
        (max, d) => (!max || d.total > max.total ? d : max),
        null,
      );
      // Ritmo: último dia vs média dos anteriores (evita comparar o dia consigo mesmo)
      const anteriores = dias.slice(0, -1);
      const mediaAnterior =
        anteriores.length > 0
          ? anteriores.reduce((s, d) => s + d.total, 0) / anteriores.length
          : 0;
      const variacao =
        ultimoDia && mediaAnterior > 0 ? ultimoDia.total / mediaAnterior - 1 : null;

      // Cobertura: quantos dias o estoque aguenta no ritmo médio observado.
      const estoqueGeral = estoqueTotal.heineken + estoqueTotal.amstel;
      const coberturaDias = mediaDia > 0 ? estoqueGeral / mediaDia : null;

      // --- Nível de serviço: bares dentro do padrão ---
      const comPadrao = barsOp.filter((b) => b.atendimento !== null);
      const noPadrao = comPadrao.filter((b) => (b.atendimento ?? 0) >= 1).length;
      const nivelServico = comPadrao.length > 0 ? noPadrao / comPadrao.length : null;

      // --- Alertas (triagem) ---
      type Alerta = { sev: Severidade; titulo: string; detalhe: string };
      const alertas: Alerta[] = [];

      BRANDS.forEach((br) => {
        if (aRepor[br] > 0 && estoqueDispel[br] < aRepor[br]) {
          alertas.push({
            sev: "critico",
            titulo: `Estoque DISPEL não cobre a reposição de ${label(br)}`,
            detalhe: `Precisa de ${aRepor[br]} barris para voltar ao padrão e há ${estoqueDispel[br]} no DISPEL (falta ${aRepor[br] - estoqueDispel[br]}).`,
          });
        }
      });

      comodato.forEach((c) => {
        const recebidos = Number(c.cheios_recebidos_acumulados) || 0;
        const devolvidos = Number(c.vazios_devolvidos_acumulados) || 0;
        if (devolvidos > recebidos) {
          alertas.push({
            sev: "critico",
            titulo: `Comodato ${label(c.marca as Brand)}: vazios devolvidos acima dos cheios recebidos`,
            detalhe: `Devolvidos ${devolvidos} contra ${recebidos} recebidos. Invariante do comodato violada — conferir antes de devolver mais.`,
          });
        }
      });

      const zerados = barsOp.filter(
        (b) => b.atendimento !== null && b.cheios.heineken + b.cheios.amstel === 0,
      );
      if (zerados.length > 0) {
        alertas.push({
          sev: "critico",
          titulo: `${zerados.length} ${zerados.length === 1 ? "bar sem barril cheio" : "bares sem barril cheio"}`,
          detalhe: zerados.map((b) => b.name).join(", "),
        });
      }

      const semInv = barsOp.filter((b) => !b.hasInv);
      if (semInv.length > 0) {
        alertas.push({
          sev: "atencao",
          titulo: `${semInv.length} ${semInv.length === 1 ? "bar sem inventário" : "bares sem inventário"}`,
          detalhe: `Os números abaixo não contam esses bares: ${semInv.map((b) => b.name).join(", ")}.`,
        });
      }

      const semPadrao = barsOp.filter((b) => b.atendimento === null);
      if (semPadrao.length > 0) {
        alertas.push({
          sev: "atencao",
          titulo: `${semPadrao.length} ${semPadrao.length === 1 ? "bar sem padrão definido" : "bares sem padrão definido"}`,
          detalhe: `Sem padrão não dá para calcular reposição: ${semPadrao.map((b) => b.name).join(", ")}.`,
        });
      }

      if (coberturaDias !== null && coberturaDias < 1) {
        alertas.push({
          sev: "critico",
          titulo: "Menos de um dia de cobertura de estoque",
          detalhe: `No ritmo médio de ${fmt(mediaDia)} barris/dia, o estoque atual (${estoqueGeral}) cobre ${fmt(coberturaDias)} dia.`,
        });
      } else if (coberturaDias !== null && coberturaDias < 2) {
        alertas.push({
          sev: "atencao",
          titulo: "Cobertura de estoque abaixo de dois dias",
          detalhe: `No ritmo médio de ${fmt(mediaDia)} barris/dia, o estoque atual cobre ${fmt(coberturaDias)} dias.`,
        });
      }

      // --- Agrupamento por rota (o pallet a montar) ---
      const hasRotas = barsOp.some((b) => b.rota);
      const rotasMap: Record<string, BarOp[]> = {};
      barsOp.forEach((b) => {
        const key = b.rota ?? (hasRotas ? "Sem rota" : "Todos os bares");
        (rotasMap[key] ??= []).push(b);
      });
      const rotas = Object.entries(rotasMap)
        .map(([nome, list]) => {
          const carregar = zero();
          const vaz = zero();
          list.forEach((b) =>
            BRANDS.forEach((br) => {
              carregar[br] += b.repor[br];
              vaz[br] += b.vazios[br];
            }),
          );
          const criticos = list.filter(
            (b) => b.atendimento !== null && b.atendimento < 0.5,
          ).length;
          return {
            nome,
            list,
            carregar,
            vazios: vaz,
            criticos,
            total: carregar.heineken + carregar.amstel,
          };
        })
        // rota que mais precisa de barril primeiro: é a ordem de sair com o pallet
        .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));

      // --- Ranking de bares por urgência (só quem tem padrão) ---
      const criticos = comPadrao
        .slice()
        .sort((a, b) => (a.atendimento ?? 1) - (b.atendimento ?? 1))
        .slice(0, 8);

      return {
        barsOp,
        aRepor,
        vaziosRecolher,
        cheiosCampo,
        padraoTotalMarca,
        estoqueTotal,
        estoqueDispel,
        warehouses,
        consumoReady,
        consumoTotal,
        consumoGeral,
        dias,
        mediaDia,
        ultimoDia,
        picoDia,
        variacao,
        coberturaDias,
        nivelServico,
        noPadrao,
        totalComPadrao: comPadrao.length,
        vaziosEstoqueTotal,
        vaziosEstoqueOk,
        alertas,
        rotas,
        hasRotas,
        criticos,
        comodato,
      };
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
    <div className="mx-auto max-w-6xl space-y-4">
      <p className="text-xs text-muted-foreground">
        O pallet de cada rota, quem está para secar e quantos dias o estoque aguenta. Atualiza
        sozinho a cada minuto.
      </p>

      {isLoading && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64" />
        </div>
      )}

      {!isLoading && data && (
        <>
          {/* ---------- Faixa de decisão ---------- */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<Truck className="h-4 w-4" />}
              label="Carregar agora"
              value={data.aRepor.heineken + data.aRepor.amstel}
              unit="barris"
              detail={`${data.aRepor.heineken}H · ${data.aRepor.amstel}A para voltar ao padrão`}
              tone="primary"
            />
            <KpiCard
              icon={<Recycle className="h-4 w-4" />}
              label="Vazios a recolher"
              value={data.vaziosRecolher.heineken + data.vaziosRecolher.amstel}
              unit="barris"
              detail={`${data.vaziosRecolher.heineken}H · ${data.vaziosRecolher.amstel}A nos bares`}
              tone="accent"
            />
            <KpiCard
              icon={<Warehouse className="h-4 w-4" />}
              label="Estoque disponível"
              value={data.estoqueTotal.heineken + data.estoqueTotal.amstel}
              unit="barris"
              detail={`DISPEL ${data.estoqueDispel.heineken}H · ${data.estoqueDispel.amstel}A`}
            />
            <KpiCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Cobertura de estoque"
              value={data.coberturaDias === null ? "—" : fmt(data.coberturaDias)}
              unit={data.coberturaDias === null ? "sem consumo" : "dias"}
              detail={
                data.coberturaDias === null
                  ? "Importe o consumo para estimar"
                  : `No ritmo de ${fmt(data.mediaDia)} barris/dia`
              }
              tone={
                data.coberturaDias !== null && data.coberturaDias < 2 ? "destructive" : undefined
              }
            />
          </div>

          {/* ---------- Alertas ---------- */}
          <Card className="p-4">
            <h2 className="font-display text-sm tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <TriangleAlert className="h-4 w-4" /> O QUE EXIGE DECISÃO
            </h2>
            {data.alertas.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-primary">
                <CircleCheck className="h-4 w-4" />
                Nada pendente: todos os bares com padrão definido, inventário em dia e estoque
                suficiente para a reposição.
              </div>
            ) : (
              <ul className="space-y-2">
                {data.alertas.map((a, i) => (
                  <li
                    key={i}
                    className={`rounded border-l-2 bg-muted/30 px-3 py-2 ${
                      a.sev === "critico" ? "border-destructive" : "border-accent"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Badge
                        variant="outline"
                        className={`mt-0.5 shrink-0 text-[10px] uppercase tracking-wider ${
                          a.sev === "critico"
                            ? "border-destructive/40 text-destructive"
                            : "border-accent/50 text-accent-foreground"
                        }`}
                      >
                        {a.sev === "critico" ? "Crítico" : "Atenção"}
                      </Badge>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{a.titulo}</div>
                        <div className="text-[11px] text-muted-foreground break-words">
                          {a.detalhe}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ---------- Pallet por rota ---------- */}
          <Card className="p-4">
            <h2 className="font-display text-sm tracking-widest text-muted-foreground mb-1 flex items-center gap-2">
              <Truck className="h-4 w-4" /> PALLET POR ROTA
            </h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              Rota que mais precisa de barril aparece primeiro. <b>Carregar</b> = padrão − cheios.{" "}
              <b>Vazios</b> = a trazer de volta. No padrão, os dois se igualam.
            </p>
            {!data.hasRotas && (
              <p className="text-[11px] text-accent-foreground mb-3">
                Rotas ainda não configuradas — aplique a migration de rotas para separar os
                pallets.
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {data.rotas.map((r) => (
                <div key={r.nome} className="rounded border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-display tracking-wider">{r.nome}</span>
                    {r.criticos > 0 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-destructive/40 text-destructive"
                      >
                        {r.criticos} {r.criticos === 1 ? "bar crítico" : "bares críticos"}
                      </Badge>
                    )}
                    <Badge className="ml-auto text-[10px] bg-primary/15 text-primary hover:bg-primary/15">
                      Carregar {r.carregar.heineken}H · {r.carregar.amstel}A
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mb-2">
                    Recolher {r.vazios.heineken}H · {r.vazios.amstel}A de vazios
                  </div>
                  <ul className="space-y-1">
                    {r.list
                      .slice()
                      .sort((a, b) => (a.atendimento ?? 1) - (b.atendimento ?? 1))
                      .map((b) => (
                        <li key={b.id} className="flex items-center gap-2 text-xs">
                          <Link
                            to="/app/bars/$barId"
                            params={{ barId: b.id }}
                            search={{ tab: "reposicao" }}
                            className="truncate hover:text-primary hover:underline underline-offset-2"
                          >
                            {b.name}
                          </Link>
                          <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                            {b.repor.heineken}H · {b.repor.amstel}A
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          {/* ---------- Bares por urgência (elemento-assinatura) ---------- */}
          <Card className="p-4">
            <h2 className="font-display text-sm tracking-widest text-muted-foreground mb-1">
              QUEM ESTÁ PARA SECAR
            </h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              Barris cheios em relação ao padrão do bar, do mais vazio para o mais cheio.
              {data.nivelServico !== null && (
                <>
                  {" "}
                  Hoje <b>{data.noPadrao}</b> de <b>{data.totalComPadrao}</b> bares estão no padrão
                  ({Math.round(data.nivelServico * 100)}%).
                </>
              )}
            </p>
            {data.criticos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum bar com padrão definido ainda.
              </p>
            ) : (
              <div className="space-y-2.5">
                {data.criticos.map((b) => {
                  const pct = b.atendimento ?? 0;
                  const sev: Severidade = pct < 0.5 ? "critico" : pct < 1 ? "atencao" : "ok";
                  const barColor =
                    sev === "critico"
                      ? "bg-destructive"
                      : sev === "atencao"
                        ? "bg-accent"
                        : "bg-primary";
                  return (
                    <div key={b.id}>
                      <div className="flex items-center gap-2 text-xs mb-1">
                        <Link
                          to="/app/bars/$barId"
                          params={{ barId: b.id }}
                          search={{ tab: "reposicao" }}
                          className="font-medium truncate hover:text-primary hover:underline underline-offset-2"
                        >
                          {b.name}
                        </Link>
                        {b.rota && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {b.rota}
                          </span>
                        )}
                        <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                          {b.cheios.heineken + b.cheios.amstel}/
                          {b.padrao.heineken + b.padrao.amstel} cheios
                        </span>
                      </div>
                      <div
                        className="h-2 w-full overflow-hidden rounded-full bg-muted"
                        role="meter"
                        aria-valuenow={Math.round(pct * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${b.name}: ${Math.round(pct * 100)}% do padrão`}
                      >
                        <div
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${Math.max(2, Math.round(pct * 100))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ---------- Consumo / ritmo ---------- */}
          <Card className="p-4">
            <h2 className="font-display text-sm tracking-widest text-muted-foreground mb-1 flex items-center gap-2">
              <Beer className="h-4 w-4" /> CONSUMO E RITMO
            </h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              Consumo real da MEEP, só para leitura do ritmo — não entra no cálculo de reposição,
              que vem do inventário.
            </p>
            {!data.consumoReady || data.dias.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem consumo importado.{" "}
                <Link to="/app/central" className="text-primary underline underline-offset-2">
                  Central → Importar
                </Link>{" "}
                aceita o .xls bruto da MEEP.
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
                  <MiniStat
                    label="Consumido no total"
                    value={`${fmt(data.consumoGeral)}`}
                    sub={`${fmt(data.consumoTotal.heineken)}H · ${fmt(data.consumoTotal.amstel)}A`}
                  />
                  <MiniStat label="Média por dia" value={fmt(data.mediaDia)} sub="barris/dia" />
                  <MiniStat
                    label="Último dia"
                    value={data.ultimoDia ? fmt(data.ultimoDia.total) : "—"}
                    sub={data.ultimoDia ? dataBR(data.ultimoDia.data) : ""}
                    trend={data.variacao}
                  />
                  <MiniStat
                    label="Pico"
                    value={data.picoDia ? fmt(data.picoDia.total) : "—"}
                    sub={data.picoDia ? dataBR(data.picoDia.data) : ""}
                  />
                </div>

                {/* série diária */}
                <div className="flex items-end gap-1 h-24">
                  {data.dias.map((d) => {
                    const max = data.picoDia?.total || 1;
                    const h = Math.max(3, Math.round((d.total / max) * 100));
                    return (
                      <div key={d.data} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors"
                          style={{ height: `${h}%` }}
                          title={`${dataBR(d.data)}: ${fmt(d.total)} barris (${fmt(d.heineken)}H · ${fmt(d.amstel)}A)`}
                        />
                        <span className="text-[9px] text-muted-foreground tabular-nums">
                          {d.data.slice(8, 10)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          {/* ---------- Fluxo do barril vazio ---------- */}
          <Card className="p-4">
            <h2 className="font-display text-sm tracking-widest text-muted-foreground mb-1">
              FLUXO DO BARRIL VAZIO
            </h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              Os dois primeiros estágios são <b>operação</b> — o vasilhame andando entre o bar e o
              galpão. Só o último é <b>comodato</b>, a conta com a cervejaria.
            </p>

            <div className="grid gap-2 sm:grid-cols-3">
              <EstagioVazio
                n={1}
                titulo="No bar"
                sub="a recolher"
                h={data.vaziosRecolher.heineken}
                a={data.vaziosRecolher.amstel}
                nota="Contados no inventário, já descontado o que foi recolhido depois dele."
              />
              <EstagioVazio
                n={2}
                titulo="No estoque"
                sub="aguardando a Heineken"
                total={data.vaziosEstoqueTotal}
                nota={
                  data.vaziosEstoqueOk
                    ? "Recolhidos e ainda no galpão. No DISPEL viram vasilhame e perdem a marca — por isso este estágio é um número só."
                    : "Aplique a migration do fluxo de vazios para este número existir."
                }
                indisponivel={!data.vaziosEstoqueOk}
              />
              <EstagioVazio
                n={3}
                titulo="Devolvidos"
                sub="retirados pela carga"
                total={data.comodato.reduce(
                  (acc, c) => acc + (Number(c.vazios_devolvidos_acumulados) || 0),
                  0,
                )}
                nota="Vasilhames que já voltaram para a cervejaria. Este é o número do comodato."
                comodato
              />
            </div>
          </Card>

          {/* ---------- Comodato ---------- */}
          {data.comodato.length > 0 && (
            <Card className="p-4">
              <h2 className="font-display text-sm tracking-widest text-muted-foreground mb-3">
                COMODATO HEINEKEN
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.comodato.map((c) => {
                  const rec = Number(c.cheios_recebidos_acumulados) || 0;
                  const dev = Number(c.vazios_devolvidos_acumulados) || 0;
                  const emAberto = rec - dev;
                  return (
                    <div key={c.marca} className="rounded border border-border p-3">
                      <div className="font-display tracking-wider mb-2">
                        {label(c.marca as Brand)}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <MiniBox label="Cheios recebidos" value={rec} />
                        <MiniBox label="Vazios devolvidos" value={dev} />
                        <MiniBox
                          label="Em aberto"
                          value={emAberto}
                          tone={emAberto < 0 ? "destructive" : undefined}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Em aberto = barris cheios recebidos que ainda não voltaram vazios. Nunca
                        pode ficar negativo.
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- helpers ---------------- */

function EstagioVazio({
  n,
  titulo,
  sub,
  h,
  a,
  total,
  nota,
  comodato,
  indisponivel,
}: {
  n: number;
  titulo: string;
  sub: string;
  /** quando o estágio ainda separa por marca */
  h?: number;
  a?: number;
  /** quando o estágio é pool sem marca (vasilhames) */
  total?: number;
  nota: string;
  comodato?: boolean;
  indisponivel?: boolean;
}) {
  const soma = total ?? (h ?? 0) + (a ?? 0);
  return (
    <div
      className={`rounded border p-3 ${comodato ? "border-primary/40 bg-primary/5" : "border-border"}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-5 h-5 shrink-0 grid place-items-center rounded-full font-display text-[10px] ${
            comodato ? "bg-primary text-primary-foreground" : "bg-muted"
          }`}
        >
          {n}
        </span>
        <span className="font-display tracking-wider text-sm">{titulo}</span>
      </div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{sub}</div>
      {indisponivel ? (
        <div className="font-display text-2xl text-muted-foreground">—</div>
      ) : (
        <div className="font-display text-2xl tabular-nums">
          {soma}
          {total === undefined && (
            <span className="text-[11px] text-muted-foreground ml-1.5">
              {h}H · {a}A
            </span>
          )}
          {total !== undefined && (
            <span className="text-[10px] text-muted-foreground ml-1.5 uppercase tracking-wider">
              vasilhames
            </span>
          )}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{nota}</p>
    </div>
  );
}

function label(br: Brand): string {
  return br === "heineken" ? "Heineken" : "Amstel";
}

function fmt(n: number): string {
  if (!isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function dataBR(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : iso;
}

function KpiCard({
  icon,
  label,
  value,
  unit,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  unit?: string;
  detail?: string;
  tone?: "primary" | "accent" | "destructive";
}) {
  const valueColor =
    tone === "primary"
      ? "text-primary"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "accent"
          ? "text-accent-foreground"
          : "";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`font-display text-3xl tabular-nums ${valueColor}`}>{value}</span>
        {unit && <span className="text-[11px] text-muted-foreground">{unit}</span>}
      </div>
      {detail && <div className="text-[11px] text-muted-foreground mt-1">{detail}</div>}
    </Card>
  );
}

function MiniStat({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number | null;
}) {
  return (
    <div className="rounded bg-muted/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-2xl tabular-nums">{value}</span>
        {trend != null && isFinite(trend) && (
          <span
            className={`text-[11px] tabular-nums ${trend >= 0 ? "text-primary" : "text-muted-foreground"}`}
          >
            {trend >= 0 ? "+" : ""}
            {Math.round(trend * 100)}%
          </span>
        )}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function MiniBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "destructive";
}) {
  return (
    <div className="rounded bg-muted/40 py-2">
      <div
        className={`font-display text-xl tabular-nums ${tone === "destructive" ? "text-destructive" : ""}`}
      >
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider leading-tight">
        {label}
      </div>
    </div>
  );
}
