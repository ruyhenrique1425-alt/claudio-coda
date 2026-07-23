import { createFileRoute } from "@tanstack/react-router";
import JSZip from "jszip";

// Tables to include in the daily backup. Order matters only for readability.
const TABLES = [
  "bars",
  "bar_stock_standard",
  "bar_machines",
  "bar_installations",
  "bar_maintenance_logs",
  "inventories",
  "inventory_items",
  "refills",
  "refill_items",
  "empties_removed",
  "bar_transfers",
  "bar_transfer_items",
  "heineken_cargas",
  "warehouse_movements",
  "warehouse_stock",
  "warehouses",
  "bar_temperature_checks",
  "bar_organization_checks",
  "bar_staff_checks",
  "bar_card_machine_sessions",
  "bar_shifts",
  "public_maintenance_requests",
  "profiles",
  "user_roles",
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") v = JSON.stringify(v);
  const s = String(v);
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const header = cols.join(",");
  const body = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

async function runBackup(triggeredBy: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const zip = new JSZip();
  let rowsTotal = 0;
  let tablesCount = 0;
  const summary: Array<{ table: string; rows: number; error?: string }> = [];

  const admin = supabaseAdmin as any;
  for (const table of TABLES) {
    try {
      const { data, error } = await admin.from(table).select("*");
      if (error) {
        summary.push({ table, rows: 0, error: error.message });
        continue;
      }
      const rows = data ?? [];
      const csv = rows.length ? toCsv(rows) : "";
      zip.file(`${table}.csv`, csv || `-- vazio --\n`);
      rowsTotal += rows.length;
      tablesCount += 1;
      summary.push({ table, rows: rows.length });
    } catch (e: any) {
      summary.push({ table, rows: 0, error: e?.message ?? "unknown" });
    }
  }

  zip.file(
    "_manifest.json",
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        triggeredBy,
        tablesCount,
        rowsTotal,
        tables: summary,
      },
      null,
      2,
    ),
  );

  const zipBuf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const dateStr = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, "-");
  const path = `backups/${dateStr}_${timeStr}.zip`;

  const { error: upErr } = await supabaseAdmin.storage
    .from("operacao-fotos")
    .upload(path, zipBuf, { contentType: "application/zip", upsert: true });
  if (upErr) throw new Error(`upload: ${upErr.message}`);

  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from("operacao-fotos")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signErr) throw new Error(`signed url: ${signErr.message}`);

  const { data: inserted, error: insErr } = await admin
    .from("backup_runs")
    .insert({
      status: "success",
      storage_path: path,
      signed_url: signed?.signedUrl ?? null,
      size_bytes: zipBuf.byteLength,
      tables_count: tablesCount,
      rows_total: rowsTotal,
      triggered_by: triggeredBy,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(`insert: ${insErr.message}`);

  return {
    ok: true,
    id: inserted?.id,
    path,
    url: signed?.signedUrl,
    size: zipBuf.byteLength,
    tables: tablesCount,
    rows: rowsTotal,
  };
}

async function handle(triggeredBy: string) {
  try {
    const result = await runBackup(triggeredBy);
    return Response.json(result);
  } catch (e: any) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any).from("backup_runs").insert({
        status: "error",
        error: e?.message ?? "unknown",
        triggered_by: triggeredBy,
      });
    } catch {}
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? "unknown" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/public/backup/daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let triggeredBy = "cron";
        try {
          const body = await request.json();
          if (body?.triggeredBy) triggeredBy = String(body.triggeredBy);
        } catch {}
        return handle(triggeredBy);
      },
      GET: async () => handle("manual"),
    },
  },
});
