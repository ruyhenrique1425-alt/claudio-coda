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
type Mode = "padroes" | "bares" | "abastecimento" | "estoque" | "meep" | "consumo" | "consumo_bruto";

// Mapa nome-na-MEEP → bar real, confirmado pelo gestor (ver SKILL.md).
// Usado só para pré-preencher o seletor do modo "Consumo MEEP (.xls bruto)";
// o nome final gravado é sempre o que estiver selecionado/editado no campo.
const MEEP_BAR_MAP: { origem: string; bar: string }[] = [
  { origem: "Villa 2 Bar 1", bar: "Vila 2 maior" },
  { origem: "Villa 2 Bar 2", bar: "Vila 2 menor" },
  { origem: "Villa 3 Bar 1", bar: "Vila 3 maior" },
  { origem: "Villa 3 Bar 2", bar: "Vila 3 menor" },
  { origem: "Arquibancada 1", bar: "Nova (arquibancada)" },
  { origem: "Arquibancada 2", bar: "Entrada (arquibancada)" },
  { origem: "Arquibancada 3", bar: "Meio (arquibancada)" },
  { origem: "Arquibancada 4", bar: "Fundo (arquibancada)" },
  { origem: "Vila 1 / Villa 1", bar: "Vila 1" },
  { origem: "Alameda dos núcleos", bar: "Núcleos" },
  { origem: "Chopperia", bar: "Choperia (1+2)" },
  { origem: "Churrascaria", bar: "Churrascaria" },
  { origem: "Zel cafe", bar: "Zel Café" },
  { origem: "Bar da pista", bar: "Bar da Pista" },
];

// Converte serial de data do Excel (base 1899-12-30) para "YYYY-MM-DD".
function excelSerialToISO(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

// Extrai quantidade embutida no nome do produto do .xls de CONSUMO da MEEP,
// ex.: "21.00000x CHOPP AMSTEL 50L" → { qtd: 21, nome: "CHOPP AMSTEL 50L" }.
// Estornos vêm com quantidade negativa (ex.: "-3.00000x ...").
function parseProdutoQtd(produto: string): { qtd: number; nome: string } | null {
  const m = String(produto ?? "").match(/^\s*(-?[\d]+(?:[.,]\d+)?)\s*x\s*(.+)$/i);
  if (!m) return null;
  const qtd = parseFloat(m[1].replace(",", "."));
  if (isNaN(qtd)) return null;
  return { qtd, nome: m[2].trim() };
}

export function ImportarPage() {
  const { user } = useSession();
  const { isGestor } = usePermissions(user?.id);
  const isManager = isGestor;
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [mode, setMode] = useState<Mode>("padroes");
  const [meepBarSelecionado, setMeepBarSelecionado] = useState<string>("");
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
      const sheetName = wb.SheetNames.find((n) => /consumo/i.test(n)) ?? wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];

      if (mode === "consumo_bruto") {
        if (!meepBarSelecionado) {
          toast.error("Selecione o bar (nome MEEP) antes de escolher o arquivo");
          return;
        }
        // Planilha bruta: cabeçalho variável no topo, tabela de produtos
        // começa na linha "Produto". Lê como matriz para achar isso sem
        // depender do número exato da linha.
        const aoa: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
        let headerRow = -1;
        let colProduto = -1;
        for (let i = 0; i < aoa.length; i++) {
          const idx = (aoa[i] ?? []).findIndex(
            (c) => String(c ?? "").trim().toLowerCase() === "produto",
          );
          if (idx >= 0) {
            headerRow = i;
            colProduto = idx;
            break;
          }
        }
        if (headerRow === -1) {
          toast.error('Não encontrei a coluna "Produto" na planilha — confira o arquivo');
          return;
        }
        const headerCells = (aoa[headerRow] ?? []).map((c) => String(c ?? "").trim().toLowerCase());
        const colData = headerCells.findIndex((c) => c.includes("data"));

        // Acumula por (data, marca) somando barris (estornos entram negativos).
        const acc = new Map<string, { data: string; marca: string; barris: number }>();
        for (let i = headerRow + 1; i < aoa.length; i++) {
          const row = aoa[i] ?? [];
          const produtoCell = row[colProduto];
          if (produtoCell == null || /^total/i.test(String(produtoCell).trim())) continue;
          const parsed = parseProdutoQtd(String(produtoCell));
          if (!parsed) continue;
          if (!/chopp/i.test(parsed.nome)) continue; // só chopps
          const marca = /heineken/i.test(parsed.nome)
            ? "heineken"
            : /amstel/i.test(parsed.nome)
              ? "amstel"
              : null;
          if (!marca) continue;
          let dataISO: string | null = null;
          if (colData >= 0) {
            const dv = row[colData];
            if (typeof dv === "number") dataISO = excelSerialToISO(dv);
            else if (dv) {
              const s = String(dv).trim();
              const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
              dataISO = br ? `${br[3]}-${br[2]}-${br[1]}` : s.slice(0, 10);
            }
          }
          if (!dataISO) continue;
          const key = `${dataISO}|${marca}`;
          const cur = acc.get(key) ?? { data: dataISO, marca, barris: 0 };
          cur.barris += parsed.qtd;
          acc.set(key, cur);
        }
        const aggregated = Array.from(acc.values()).map((v) => ({
          bar: meepBarSelecionado,
          data: v.data,
          marca: v.marca,
          barris: v.barris,
        }));
        if (!aggregated.length) {
          toast.error("Nenhuma linha de chopp reconhecida nesse arquivo");
          return;
        }
        setRows(aggregated);
        return;
      }

      const json = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
      setRows(json);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível ler a planilha");
    }
  };

  const downloadTemplate = () => {
    if (mode === "padroes") {
      downloadCsv(`template-padroes-${timestampSlug()}.csv`, [
        { bar: "Vila 1", brand: "heineken", barris_padrao: 10 },
        { bar: "Vila 1", brand: "amstel", barris_padrao: 8 },
      ]);
    } else if (mode === "bares") {
      downloadCsv(`template-bares-${timestampSlug()}.csv`, [
        {
          name: "Bar Praça",
          bar_type: "bar_venda",
          latitude: -19.9,
          longitude: -43.9,
          apoio_responsavel: "",
          notes: "",
        },
      ]);
    } else if (mode === "abastecimento") {
      downloadCsv(`template-abastecimento-${timestampSlug()}.csv`, [
        {
          bar: "Vila 1",
          heineken_barris: 4,
          amstel_barris: 2,
          observacoes: "Reposição manhã",
        },
        { bar: "Vila 2 maior", heineken_barris: 3, amstel_barris: 1, observacoes: "" },
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
    } else if (mode === "consumo") {
      downloadCsv(`template-consumo-${timestampSlug()}.csv`, [
        { bar: "Vila 1", data: "2026-07-21", marca: "heineken", barris: 12 },
        { bar: "Vila 1", data: "2026-07-21", marca: "amstel", barris: 14 },
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
        // bars não tem coluna `code` — casar por `name` (trim/lowercase).
        const { data: bars } = await supabase.from("bars").select("id, name");
        const byName = new Map(
          (bars ?? []).map((b: any) => [String(b.name).trim().toLowerCase(), b.id]),
        );
        for (const r of rows) {
          const nome = String(r.bar ?? r.bar_code ?? r.name ?? r.code ?? "").trim();
          const brand = String(r.brand ?? "")
            .trim()
            .toLowerCase();
          const padrao = Number(r.barris_padrao ?? r.padrao ?? 0);
          const barId = byName.get(nome.toLowerCase());
          if (!barId) {
            errors.push(`Bar não encontrado: ${nome}`);
            continue;
          }
          if (!["heineken", "amstel"].includes(brand)) {
            errors.push(`Marca inválida: ${brand} (${nome})`);
            continue;
          }
          const { error } = await supabase
            .from("bar_stock_standard")
            .upsert({ bar_id: barId, brand, barris_padrao: padrao } as any, {
              onConflict: "bar_id,brand",
            });
          if (error) errors.push(`${nome}/${brand}: ${error.message}`);
          else ok++;
        }
      } else if (mode === "bares") {
        // bars não tem `code`/`type`/`lat`/`lng` — colunas reais: name, bar_type,
        // latitude, longitude. Sem UNIQUE em `name`, então fazemos
        // buscar-e-atualizar (ou inserir) em vez de upsert por onConflict.
        for (const r of rows) {
          const name = String(r.name ?? r.nome ?? "").trim();
          const bar_type = String(r.bar_type ?? r.type ?? "bar_venda").trim();
          const latitude = r.latitude ?? r.lat;
          const longitude = r.longitude ?? r.lng;
          const apoio_responsavel = r.apoio_responsavel ?? r.apoio ?? null;
          const notes = r.notes ?? r.observacoes ?? null;
          if (!name || latitude == null || longitude == null) {
            errors.push(`Linha inválida (faltando name/latitude/longitude): ${JSON.stringify(r)}`);
            continue;
          }
          const payload: any = {
            name,
            bar_type,
            latitude: Number(latitude),
            longitude: Number(longitude),
            apoio_responsavel,
            notes,
          };
          const { data: existing } = await supabase
            .from("bars")
            .select("id")
            .ilike("name", name)
            .limit(1)
            .maybeSingle();
          const { error } = existing
            ? await supabase.from("bars").update(payload).eq("id", existing.id)
            : await supabase.from("bars").insert(payload as any);
          if (error) errors.push(`${name}: ${error.message}`);
          else ok++;
        }
      } else if (mode === "abastecimento") {
        // ABASTECIMENTO EM LOTE — cria um refill por linha com heineken/amstel.
        // bars não tem `code` — casar por `name`. `refills.photo_url` é
        // NOT NULL no schema original; a migration 20260724140000 tornou a
        // coluna opcional para permitir a importação em lote sem foto.
        const { data: bars } = await supabase.from("bars").select("id, name");
        const byName = new Map(
          (bars ?? []).map((b: any) => [String(b.name).trim().toLowerCase(), b.id]),
        );
        const uid = user?.id ?? null;
        for (const r of rows) {
          const nome = String(r.bar ?? r.bar_code ?? r.name ?? r.code ?? "").trim();
          const h = Number(r.heineken_barris ?? r.heineken ?? 0);
          const a = Number(r.amstel_barris ?? r.amstel ?? 0);
          const obs = r.observacoes ?? r.notes ?? null;
          const barId = byName.get(nome.toLowerCase());
          if (!barId) {
            errors.push(`Bar não encontrado: ${nome}`);
            continue;
          }
          if (h <= 0 && a <= 0) {
            errors.push(`${nome}: nenhum barril informado`);
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
            errors.push(`${nome}: ${rerr?.message ?? "falha ao criar reposição"}`);
            continue;
          }

          const items: any[] = [];
          if (h > 0) items.push({ refill_id: refill.id, brand: "heineken", quantidade: h });
          if (a > 0) items.push({ refill_id: refill.id, brand: "amstel", quantidade: a });
          const { error: ierr } = await supabase.from("refill_items").insert(items);
          if (ierr) {
            errors.push(`${nome}: ${ierr.message}`);
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
          // warehouse_move_type só aceita: entrada|transferencia|abastecimento_bar|ajuste
          const move_type = dir === 1 ? "entrada" : "ajuste";
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
        // (cartao_meep não é uma coluna tipada em types.ts — select via `as any`.)
        const { data: bars } = await (supabase as any).from("bars").select("id,name,cartao_meep");
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
      } else if (mode === "consumo" || mode === "consumo_bruto") {
        // CONSUMO MEEP — consumo real por bar/dia/marca (barris). Resolve bar por nome.
        // (consumo_bruto já chega aqui no mesmo formato {bar,data,marca,barris},
        // montado em onFile a partir do .xls cru da MEEP.)
        const { data: bars } = await supabase.from("bars").select("id,name");
        const byName = new Map<string, string>();
        (bars ?? []).forEach((b: any) => byName.set(String(b.name).trim().toLowerCase(), b.id));
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
          const bar = String(r.bar ?? r.nome ?? "").trim();
          const data = parseDate(r.data ?? r.date ?? r.dia);
          const marca = String(r.marca ?? r.brand ?? "")
            .trim()
            .toLowerCase();
          const barris = Number(r.barris ?? r.quantidade ?? r.qtd ?? 0) || 0;
          if (!bar || !data) {
            errors.push(`Linha inválida: ${JSON.stringify(r)}`);
            continue;
          }
          if (!["heineken", "amstel"].includes(marca)) {
            errors.push(`Marca inválida: ${marca} (${bar})`);
            continue;
          }
          payload.push({
            bar_id: byName.get(bar.toLowerCase()) ?? null,
            bar_nome: bar,
            data,
            marca,
            barris,
          });
        }
        if (payload.length) {
          const { error } = await (supabase as any)
            .from("meep_consumo_bar")
            .upsert(payload, { onConflict: "bar_nome,data,marca" });
          if (error) errors.push(error.message);
          else ok = payload.length;
        }
        await logAudit({
          acao: "import_consumo",
          tabela: "meep_consumo_bar",
          detalhe: { linhas: rows.length, ok, fail: errors.length },
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
    meep: "Abastecimento MEEP (chopps/bar)",
    consumo: "Consumo MEEP (real, por bar)",
    consumo_bruto: "Consumo MEEP (.xls bruto por bar)",
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

        {mode === "consumo_bruto" ? (
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              Sobe o <b>.xls bruto</b> exportado da MEEP (sheet "Consumos"), um arquivo por bar —
              sem precisar limpar/converter pra CSV antes. Escolha o bar correspondente ao arquivo
              (o mapa nome-MEEP → bar já vem preenchido conforme confirmado com o gestor).
            </p>
            <select
              className="w-full border rounded h-10 px-2 text-sm bg-background"
              value={meepBarSelecionado}
              onChange={(e) => setMeepBarSelecionado(e.target.value)}
            >
              <option value="">— selecione o bar deste arquivo —</option>
              {MEEP_BAR_MAP.map((m) => (
                <option key={m.bar} value={m.bar}>
                  {m.bar} (MEEP: {m.origem})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" /> Baixar modelo CSV
          </Button>
        )}

        <div className="border-2 border-dashed rounded p-4 text-center">
          <FileSpreadsheet className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={mode === "consumo_bruto" && !meepBarSelecionado}
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
