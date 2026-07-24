import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useSession";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { downloadCsv, timestampSlug } from "@/lib/exportCsv";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/app/importar")({ component: ImportarPage });

type Row = Record<string, any>;
type Mode = "padroes" | "bares" | "abastecimento" | "estoque" | "meep";

export function ImportarPage() {
  const { user } = useSession();
  const { isGestor } = usePermissions(user?.id);
  const isManager = isGestor;
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [mode, setMode] = useState<Mode>("padroes");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);

  if (!isManager) {
    return (
      <div className="p-4">
        <Card className="p-6 text-sm text-muted-foreground">
          Apenas gestores podem importar planilhas.
        </Card>
      </div>
    );
  }

  const onFile = async (f: File | null) => {
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    try {
      const buf = await f.arrayBuffer();
      // xlsx é pesado (~560 kB); só carrega quando um arquivo é escolhido.
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
      setRows(json);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível ler a planilha");
    }
  };

  const downloadTemplate = () => {
    if (mode === "padroes") {
      downloadCsv(`template-padroes-${timestampSlug()}.csv`, [
        { bar_code: "BAR-001", brand: "heineken", barris_padrao: 10 },
        { bar_code: "BAR-001", brand: "amstel", barris_padrao: 8 },
      ]);
    } else if (mode === "bares") {
      downloadCsv(`template-bares-${timestampSlug()}.csv`, [
        { code: "BAR-001", name: "Bar Praça", type: "bar_venda", lat: -19.9, lng: -43.9 },
      ]);
    } else if (mode === "abastecimento") {
      downloadCsv(`template-abastecimento-${timestampSlug()}.csv`, [
        {
          bar_code: "BAR-001",
          heineken_barris: 4,
          amstel_barris: 2,
          observacoes: "Reposição manhã",
        },
        { bar_code: "BAR-002", heineken_barris: 3, amstel_barris: 1, observacoes: "" },
      ]);
    } else if (mode === "estoque") {
      downloadCsv(`template-estoque-${timestampSlug()}.csv`, [
        {
          warehouse_code: "dispel",
          brand: "heineken",
          quantidade: 20,
          direction: 1,
          observacoes: "Entrada NF 001043514",
        },
        {
          warehouse_code: "dispel",
          brand: "amstel",
          quantidade: 10,
          direction: 1,
          observacoes: "Entrada NF 001043514",
        },
        {
          warehouse_code: "allstar",
          brand: "heineken",
          quantidade: 5,
          direction: -1,
          observacoes: "Ajuste de inventário",
        },
      ]);
    } else if (mode === "meep") {
      downloadCsv(`template-meep-${timestampSlug()}.csv`, [
        {
          cartao: "ARQ_01",
          data: "2026-07-21",
          categoria: "BEBIDAS BAR",
          produto: "CHOPP HEINEKEN 400ML [BAR]",
          quantidade: 42,
          valor: 798,
        },
        {
          cartao: "ARQ_01",
          data: "2026-07-21",
          categoria: "BEBIDAS BAR",
          produto: "CHOPP AMSTEL 400ML [BAR]",
          quantidade: 30,
          valor: 540,
        },
      ]);
    }
  };

  const runImport = async () => {
    if (!rows.length) return toast.error("Nenhuma linha para importar");
    setImporting(true);
    const errors: string[] = [];
    let ok = 0;
    try {
      if (mode === "padroes") {
        const { data: bars } = await supabase.from("bars").select("id, code");
        const byCode = new Map((bars ?? []).map((b: any) => [String(b.code).trim(), b.id]));
        for (const r of rows) {
          const code = String(r.bar_code ?? r.code ?? "").trim();
          const brand = String(r.brand ?? "")
            .trim()
            .toLowerCase();
          const padrao = Number(r.barris_padrao ?? r.padrao ?? 0);
          const barId = byCode.get(code);
          if (!barId) {
            errors.push(`Bar não encontrado: ${code}`);
            continue;
          }
          if (!["heineken", "amstel"].includes(brand)) {
            errors.push(`Marca inválida: ${brand} (${code})`);
            continue;
          }
          const { error } = await supabase
            .from("bar_stock_standard")
            .upsert({ bar_id: barId, brand, barris_padrao: padrao } as any, {
              onConflict: "bar_id,brand",
            });
          if (error) errors.push(`${code}/${brand}: ${error.message}`);
          else ok++;
        }
      } else if (mode === "bares") {
        for (const r of rows) {
          const payload: any = {
            code: String(r.code ?? "").trim(),
            name: String(r.name ?? "").trim(),
            type: String(r.type ?? "bar_venda").trim(),
            lat: r.lat != null ? Number(r.lat) : null,
            lng: r.lng != null ? Number(r.lng) : null,
          };
          if (!payload.code || !payload.name) {
            errors.push(`Linha inválida: ${JSON.stringify(r)}`);
            continue;
          }
          const { error } = await supabase
            .from("bars")
            .upsert(payload as any, { onConflict: "code" });
          if (error) errors.push(`${payload.code}: ${error.message}`);
          else ok++;
        }
      } else if (mode === "abastecimento") {
        // ABASTECIMENTO EM LOTE — cria um refill por linha com heineken/amstel
        const { data: bars } = await supabase.from("bars").select("id, code");
        const byCode = new Map((bars ?? []).map((b: any) => [String(b.code).trim(), b.id]));
        const uid = user?.id ?? null;
        for (const r of rows) {
          const code = String(r.bar_code ?? r.code ?? "").trim();
          const h = Number(r.heineken_barris ?? r.heineken ?? 0);
          const a = Number(r.amstel_barris ?? r.amstel ?? 0);
          const obs = r.observacoes ?? r.notes ?? null;
          const barId = byCode.get(code);
          if (!barId) {
            errors.push(`Bar não encontrado: ${code}`);
            continue;
          }
          if (h <= 0 && a <= 0) {
            errors.push(`${code}: nenhum barril informado`);
            continue;
          }

          const { data: refill, error: rerr } = await supabase
            .from("refills")
            .insert({
              bar_id: barId,
              performed_by: uid,
              notes: obs ?? `Importação em lote ${new Date().toLocaleString("pt-BR")}`,
            } as any)
            .select("id")
            .single();
          if (rerr || !refill) {
            errors.push(`${code}: ${rerr?.message ?? "falha ao criar reposição"}`);
            continue;
          }

          const items: any[] = [];
          if (h > 0) items.push({ refill_id: refill.id, brand: "heineken", quantidade: h });
          if (a > 0) items.push({ refill_id: refill.id, brand: "amstel", quantidade: a });
          const { error: ierr } = await supabase.from("refill_items").insert(items);
          if (ierr) {
            errors.push(`${code}: ${ierr.message}`);
            continue;
          }
          ok++;
        }
        await logAudit({
          acao: "import_abastecimento",
          tabela: "refills",
          detalhe: { linhas: rows.length, ok, fail: errors.length },
        });
      } else if (mode === "estoque") {
        // ESTOQUE — entradas/saídas em warehouses via warehouse_movements
        const { data: whs } = await supabase.from("warehouses").select("id, code");
        const byCode = new Map(
          (whs ?? []).map((w: any) => [String(w.code).trim().toLowerCase(), w.id]),
        );
        const uid = user?.id ?? null;
        for (const r of rows) {
          const code = String(r.warehouse_code ?? r.code ?? "")
            .trim()
            .toLowerCase();
          const brand = String(r.brand ?? "")
            .trim()
            .toLowerCase();
          const qtd = Number(r.quantidade ?? r.qtd ?? 0);
          const dir = Number(r.direction ?? r.direcao ?? 1) === -1 ? -1 : 1;
          const obs = r.observacoes ?? r.notes ?? null;
          const whId = byCode.get(code);
          if (!whId) {
            errors.push(`Estoque não encontrado: ${code}`);
            continue;
          }
          if (!["heineken", "amstel"].includes(brand)) {
            errors.push(`Marca inválida: ${brand}`);
            continue;
          }
          if (!qtd || qtd <= 0) {
            errors.push(`${code}/${brand}: quantidade inválida`);
            continue;
          }
          const move_type = dir === 1 ? "recebimento_heineken" : "ajuste";
          const { error } = await supabase.from("warehouse_movements").insert({
            warehouse_id: whId,
            brand,
            quantidade: qtd,
            direction: dir,
            move_type,
            performed_by: uid,
            notes: obs ?? `Importação em lote ${new Date().toLocaleString("pt-BR")}`,
          } as any);
          if (error) errors.push(`${code}/${brand}: ${error.message}`);
          else ok++;
        }
        await logAudit({
          acao: "import_estoque",
          tabela: "warehouse_movements",
          detalhe: { linhas: rows.length, ok, fail: errors.length },
        });
      } else if (mode === "meep") {
        // MEEP — vendas por bar (só chopps). Resolve bar por cartão ou nome.
        const { data: bars } = await supabase.from("bars").select("id,name");
        const byCartao = new Map<string, string>();
        const byName = new Map<string, string>();
        (bars ?? []).forEach((b: any) => {
          const cm = (b as any).cartao_meep;
          if (cm) byCartao.set(String(cm).trim().toLowerCase(), b.id);
          byName.set(String(b.name).trim().toLowerCase(), b.id);
        });
        const parseDate = (v: any): string | null => {
          const s = String(v ?? "").trim();
          if (!s) return null;
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
          const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
          if (br) return `${br[3]}-${br[2]}-${br[1]}`;
          const d = new Date(s);
          return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
        };
        const payload: any[] = [];
        for (const r of rows) {
          const produto = String(r.produto ?? r.product ?? "").trim();
          if (!produto || !/chopp/i.test(produto)) continue; // só chopps
          const cartao = String(r.cartao ?? r.card ?? r.bar ?? "").trim();
          const data = parseDate(r.data ?? r.date ?? r.dia);
          if (!data) {
            errors.push(`Data inválida: ${JSON.stringify(r.data ?? r.date ?? "")}`);
            continue;
          }
          const quantidade = Number(r.quantidade ?? r.qtd ?? r.unidade ?? 0) || 0;
          const valor = Number(r.valor ?? r.total ?? 0) || 0;
          const barId =
            byCartao.get(cartao.toLowerCase()) ?? byName.get(cartao.toLowerCase()) ?? null;
          payload.push({
            bar_id: barId,
            cartao: cartao || null,
            data,
            categoria: r.categoria ?? r.category ?? null,
            produto,
            quantidade,
            valor,
            is_chopp: true,
          });
        }
        if (payload.length) {
          const { error } = await (supabase as any)
            .from("meep_vendas_bar")
            .upsert(payload, { onConflict: "cartao,data,produto" });
          if (error) errors.push(error.message);
          else ok = payload.length;
        }
        await logAudit({
          acao: "import_meep",
          tabela: "meep_vendas_bar",
          detalhe: { linhas: rows.length, chopps: payload.length, ok, fail: errors.length },
        });
      }
      setResult({ ok, fail: errors.length, errors });
      if (errors.length === 0) toast.success(`${ok} registros importados`);
      else toast.warning(`${ok} ok · ${errors.length} com erro`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na importação");
    } finally {
      setImporting(false);
    }
  };

  const modeLabels: Record<Mode, string> = {
    padroes: "Padrões de estoque",
    bares: "Cadastro de bares",
    abastecimento: "Abastecimento em lote",
    estoque: "Entradas/saídas de estoque",
    meep: "Vendas MEEP (chopps)",
  };

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="font-display text-2xl tracking-wider">IMPORTAR PLANILHA</h1>
        <p className="text-xs text-muted-foreground">
          Excel (.xlsx) ou CSV. Pré-visualize antes de confirmar.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(modeLabels) as Mode[]).map((m) => (
            <Button
              key={m}
              variant={mode === m ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMode(m);
                setRows([]);
                setResult(null);
                setFileName("");
              }}
            >
              {modeLabels[m]}
            </Button>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="w-4 h-4 mr-2" /> Baixar modelo CSV
        </Button>

        <div className="border-2 border-dashed rounded p-4 text-center">
          <FileSpreadsheet className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          {fileName && (
            <p className="text-xs mt-2 text-muted-foreground">
              {fileName} · {rows.length} linhas detectadas
            </p>
          )}
        </div>

        {rows.length > 0 && (
          <>
            <div className="max-h-60 overflow-auto text-[11px] border rounded">
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    {Object.keys(rows[0]).map((k) => (
                      <th key={k} className="text-left px-2 py-1">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t">
                      {Object.keys(rows[0]).map((k) => (
                        <td key={k} className="px-2 py-1">
                          {String(r[k] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 20 && (
                <div className="p-2 text-center text-muted-foreground">
                  … +{rows.length - 20} linhas
                </div>
              )}
            </div>
            <Button onClick={runImport} disabled={importing} className="w-full min-h-[48px]">
              <Upload className="w-4 h-4 mr-2" />
              {importing ? "Importando…" : `Importar ${rows.length} linhas`}
            </Button>
          </>
        )}

        {result && (
          <Card className="p-3 space-y-2 bg-muted/40">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <b>{result.ok}</b> registros importados
              {result.fail > 0 && (
                <span className="text-destructive">· {result.fail} com erro</span>
              )}
            </div>
            {result.errors.length > 0 && (
              <ul className="text-[11px] text-destructive max-h-40 overflow-auto space-y-1">
                {result.errors.slice(0, 50).map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </Card>
    </div>
  );
}
