import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useSession";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileDown,
  FileText,
  AlertTriangle,
  Thermometer,
  CreditCard,
  Beer,
  Trophy,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/relatorio")({ component: RelatorioPage });

type Marca = "heineken" | "amstel";

function RelatorioPage() {
  const { user } = useSession();
  const perms = usePermissions(user?.id);
  const canView = perms.isGestor || perms.isManutencao;
  const [generating, setGenerating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["relatorio-executivo"],
    enabled: canView,
    queryFn: async () => {
      const [
        { data: bars },
        { data: emps },
        { data: stds },
        { data: temps },
        { data: invs },
        { data: sessions },
      ] = await Promise.all([
        supabase.from("bars").select("id,name,bar_type"),
        supabase.from("empties_removed").select("bar_id,brand,quantidade,performed_at"),
        supabase.from("bar_stock_standard").select("bar_id,brand,barris_padrao"),
        supabase
          .from("bar_temperature_checks")
          .select("bar_id,horario,temperatura,performed_at")
          .order("performed_at", { ascending: false })
          .limit(500),
        supabase
          .from("inventories")
          .select("id,bar_id,performed_at,inventory_items(brand,status,quantidade)")
          .order("performed_at", { ascending: false }),
        supabase
          .from("bar_card_machine_sessions")
          .select("bar_id,performed_at,quantidade_maquinas")
          .order("performed_at", { ascending: false }),
      ]);

      const nameById: Record<string, string> = {};
      const vendaBars = new Set<string>();
      (bars ?? []).forEach((b: any) => {
        nameById[b.id] = b.name;
        if (["bar_venda", "bar_parceiro"].includes(b.bar_type)) vendaBars.add(b.id);
      });

      // Consumo por marca (vazios recolhidos)
      const byBrand: Record<Marca, number> = { heineken: 0, amstel: 0 };
      const byBar: Record<string, number> = {};
      (emps ?? []).forEach((e: any) => {
        byBrand[e.brand as Marca] = (byBrand[e.brand as Marca] ?? 0) + (e.quantidade ?? 0);
        byBar[e.bar_id] = (byBar[e.bar_id] ?? 0) + (e.quantidade ?? 0);
      });
      const ranking = Object.entries(byBar)
        .map(([id, total]) => ({ id, name: nameById[id] ?? id.slice(0, 8), total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 15);

      // Padrão por bar
      const stdBy: Record<string, { heineken: number; amstel: number }> = {};
      (stds ?? []).forEach((s: any) => {
        stdBy[s.bar_id] ??= { heineken: 0, amstel: 0 };
        stdBy[s.bar_id][s.brand as Marca] = s.barris_padrao || 0;
      });

      // Último inventário por bar
      const lastInvByBar = new Map<string, any>();
      (invs ?? []).forEach((i: any) => {
        if (!lastInvByBar.has(i.bar_id)) lastInvByBar.set(i.bar_id, i);
      });

      const abaixoPadrao: {
        bar: string;
        marca: string;
        padrao: number;
        atual: number;
        delta: number;
      }[] = [];
      vendaBars.forEach((barId) => {
        const inv = lastInvByBar.get(barId);
        const std = stdBy[barId] ?? { heineken: 0, amstel: 0 };
        const items: any[] = inv?.inventory_items ?? [];
        (["heineken", "amstel"] as Marca[]).forEach((br) => {
          const total = items
            .filter((it) => it.brand === br && (it.status === "plugado" || it.status === "fechado"))
            .reduce((s, it) => s + (it.quantidade ?? 0), 0);
          if (std[br] > 0 && total < std[br]) {
            abaixoPadrao.push({
              bar: nameById[barId] ?? barId.slice(0, 8),
              marca: br,
              padrao: std[br],
              atual: total,
              delta: total - std[br],
            });
          }
        });
      });
      abaixoPadrao.sort((a, b) => a.delta - b.delta);

      // Temperaturas fora do padrão (>-1°C)
      const tempsFora = (temps ?? [])
        .filter((t: any) => typeof t.temperatura === "number" && t.temperatura > -1)
        .slice(0, 50)
        .map((t: any) => ({
          bar: nameById[t.bar_id] ?? t.bar_id.slice(0, 8),
          horario: t.horario,
          temp: t.temperatura,
          at: t.performed_at,
        }));

      // Máquinas em campo (última sessão por bar) vs faltantes
      const lastSessionByBar = new Map<string, any>();
      (sessions ?? []).forEach((s: any) => {
        if (!lastSessionByBar.has(s.bar_id)) lastSessionByBar.set(s.bar_id, s);
      });
      let machinesInField = 0;
      let barsMissing = 0;
      vendaBars.forEach((barId) => {
        const s = lastSessionByBar.get(barId);
        if (s?.quantidade_maquinas > 0) machinesInField += s.quantidade_maquinas;
        else barsMissing++;
      });

      return {
        totals: {
          totalConsumo: byBrand.heineken + byBrand.amstel,
          heineken: byBrand.heineken,
          amstel: byBrand.amstel,
          machinesInField,
          barsMissing,
          totalVendaBars: vendaBars.size,
          totalTempsFora: tempsFora.length,
        },
        ranking,
        abaixoPadrao,
        tempsFora,
      };
    },
  });

  const exportPdf = async () => {
    if (!data || generating) return;
    setGenerating(true);
    try {
      // jsPDF (+autoTable) são pesados (~600 kB); carregamos sob demanda.
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const now = new Date().toLocaleString("pt-BR");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("DISPEL OPERAÇÃO — Relatório Executivo", 40, 50);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Gerado em: ${now}`, 40, 68);

      // KPIs
      autoTable(doc, {
        startY: 90,
        head: [["Indicador", "Valor"]],
        body: [
          ["Consumo total (barris)", String(data.totals.totalConsumo)],
          ["Heineken", String(data.totals.heineken)],
          ["Amstel", String(data.totals.amstel)],
          ["Bares venda ativos", String(data.totals.totalVendaBars)],
          ["Maquininhas em campo", String(data.totals.machinesInField)],
          ["Bares sem maquininha", String(data.totals.barsMissing)],
          ["Temperaturas fora do padrão", String(data.totals.totalTempsFora)],
        ],
        styles: { fontSize: 10 },
        headStyles: { fillColor: [27, 110, 58] },
      });

      // Ranking
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [["#", "Bar", "Barris consumidos"]],
        body: data.ranking.map((r, i) => [String(i + 1), r.name, String(r.total)]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [244, 185, 66], textColor: 0 },
        didDrawPage: () => {
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text("Ranking de consumo", 40, (doc as any).lastAutoTable?.settings?.startY - 8);
        },
      });

      // Abaixo do padrão
      if (data.abaixoPadrao.length > 0) {
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 20,
          head: [["Bar", "Marca", "Padrão", "Atual", "Delta"]],
          body: data.abaixoPadrao.map((r) => [
            r.bar,
            r.marca,
            String(r.padrao),
            String(r.atual),
            String(r.delta),
          ]),
          styles: { fontSize: 10 },
          headStyles: { fillColor: [220, 38, 38] },
          didDrawPage: () => {
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text(
              "Bares abaixo do padrão",
              40,
              (doc as any).lastAutoTable?.settings?.startY - 8,
            );
          },
        });
      }

      // Temperaturas fora
      if (data.tempsFora.length > 0) {
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 20,
          head: [["Bar", "Horário", "Temp (°C)", "Quando"]],
          body: data.tempsFora.map((t) => [
            t.bar,
            t.horario,
            String(t.temp),
            new Date(t.at).toLocaleString("pt-BR"),
          ]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: [234, 88, 12] },
          didDrawPage: () => {
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text(
              "Temperaturas fora do padrão (> -1 °C)",
              40,
              (doc as any).lastAutoTable?.settings?.startY - 8,
            );
          },
        });
      }

      doc.save(`dispel-relatorio-executivo-${Date.now()}.pdf`);
      toast.success("Relatório PDF gerado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  };

  if (!canView) {
    return (
      <div className="p-4">
        <Card className="p-6 text-sm text-muted-foreground">Acesso restrito.</Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl tracking-wider flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> RELATÓRIO EXECUTIVO
          </h1>
          <p className="text-xs text-muted-foreground">
            Consolidado da operação — exporte em PDF para o comando.
          </p>
        </div>
        <Button
          onClick={exportPdf}
          disabled={!data || isLoading || generating}
          className="min-h-[44px]"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4 mr-2" />
          )}
          {generating ? "Gerando PDF…" : "Exportar PDF"}
        </Button>
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi
              icon={<Beer className="h-4 w-4" />}
              label="CONSUMO TOTAL"
              value={data.totals.totalConsumo}
              suffix="barris"
            />
            <Kpi
              icon={<Trophy className="h-4 w-4" />}
              label="HEINEKEN"
              value={data.totals.heineken}
              suffix="barris"
              tone="brand"
            />
            <Kpi
              icon={<Trophy className="h-4 w-4" />}
              label="AMSTEL"
              value={data.totals.amstel}
              suffix="barris"
              tone="gold"
            />
            <Kpi
              icon={<CreditCard className="h-4 w-4" />}
              label="MAQUININHAS"
              value={data.totals.machinesInField}
              suffix={`em ${data.totals.totalVendaBars} bares`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Kpi
              icon={<AlertTriangle className="h-4 w-4" />}
              label="BARES ABAIXO PADRÃO"
              value={data.abaixoPadrao.length}
              tone="danger"
            />
            <Kpi
              icon={<Thermometer className="h-4 w-4" />}
              label="TEMPS FORA DO PADRÃO"
              value={data.totals.totalTempsFora}
              tone="warn"
            />
            <Kpi
              icon={<CreditCard className="h-4 w-4" />}
              label="BARES SEM MAQUININHA"
              value={data.totals.barsMissing}
              tone={data.totals.barsMissing > 0 ? "warn" : undefined}
            />
          </div>

          <Card className="p-4">
            <h2 className="font-display text-sm tracking-widest mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> RANKING DE CONSUMO
            </h2>
            <div className="text-xs">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-2 py-1">#</th>
                    <th className="text-left px-2 py-1">Bar</th>
                    <th className="text-right px-2 py-1">Barris</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ranking.map((r, i) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-2 py-1 tabular-nums">{i + 1}</td>
                      <td className="px-2 py-1">{r.name}</td>
                      <td className="px-2 py-1 text-right tabular-nums font-medium">{r.total}</td>
                    </tr>
                  ))}
                  {data.ranking.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-4 text-muted-foreground">
                        Sem consumo registrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {data.abaixoPadrao.length > 0 && (
            <Card className="p-4 border-red-200">
              <h2 className="font-display text-sm tracking-widest mb-3 flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-4 w-4" /> BARES ABAIXO DO PADRÃO
              </h2>
              <div className="text-xs">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-2 py-1">Bar</th>
                      <th className="text-left px-2 py-1">Marca</th>
                      <th className="text-right px-2 py-1">Padrão</th>
                      <th className="text-right px-2 py-1">Atual</th>
                      <th className="text-right px-2 py-1">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.abaixoPadrao.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{r.bar}</td>
                        <td className="px-2 py-1 uppercase">{r.marca}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.padrao}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.atual}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-red-700 font-medium">
                          {r.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {data.tempsFora.length > 0 && (
            <Card className="p-4 border-orange-200">
              <h2 className="font-display text-sm tracking-widest mb-3 flex items-center gap-2 text-orange-700">
                <Thermometer className="h-4 w-4" /> TEMPERATURAS FORA DO PADRÃO
              </h2>
              <div className="text-xs max-h-80 overflow-auto">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1">Bar</th>
                      <th className="text-left px-2 py-1">Horário</th>
                      <th className="text-right px-2 py-1">Temp (°C)</th>
                      <th className="text-right px-2 py-1">Quando</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tempsFora.map((t, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{t.bar}</td>
                        <td className="px-2 py-1">{t.horario}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{t.temp}</td>
                        <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                          {new Date(t.at).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  suffix?: string;
  tone?: "brand" | "gold" | "danger" | "warn";
}) {
  const toneCls =
    tone === "brand"
      ? "bg-primary/10 text-primary"
      : tone === "gold"
        ? "bg-accent/20 text-accent"
        : tone === "danger"
          ? "bg-red-100 text-red-800"
          : tone === "warn"
            ? "bg-orange-100 text-orange-800"
            : "bg-muted text-foreground";
  return (
    <Card className={`p-4 ${toneCls}`}>
      <div className="flex items-center gap-2 opacity-80">
        {icon}
        <span className="text-[10px] font-display tracking-widest">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-brand tabular-nums">{value}</div>
      {suffix && <div className="text-[11px] opacity-70">{suffix}</div>}
    </Card>
  );
}
