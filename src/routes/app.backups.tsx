import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useSession";
import { Download, MessageCircle, RefreshCw, PlayCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

type BackupRun = {
  id: string;
  run_date: string;
  status: string;
  storage_path: string | null;
  signed_url: string | null;
  size_bytes: number | null;
  tables_count: number | null;
  rows_total: number | null;
  error: string | null;
  triggered_by: string;
  created_at: string;
};

function formatSize(n: number | null) {
  if (!n) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function BackupsPage() {
  const { user } = useSession();
  const perms = usePermissions(user?.id);
  const [runs, setRuns] = useState<BackupRun[] | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("backup_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) toast.error("Erro ao carregar backups: " + error.message);
    setRuns((data as any) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function refreshSigned(run: BackupRun) {
    if (!run.storage_path) return;
    try {
      const { data, error } = await supabase.storage
        .from("operacao-fotos")
        .createSignedUrl(run.storage_path, 60 * 60 * 24 * 7);
      if (error) throw error;
      await (supabase as any)
        .from("backup_runs")
        .update({ signed_url: data.signedUrl })
        .eq("id", run.id);
      toast.success("Link renovado");
      load();
    } catch (e: any) {
      toast.error("Erro ao renovar link: " + e.message);
    }
  }

  async function generateNow() {
    setRunning(true);
    try {
      const res = await fetch("/api/public/backup/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggeredBy: user?.email ?? "manual" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Falha ao gerar backup");
      toast.success(`Backup gerado · ${json.tables} tabelas · ${json.rows} linhas`);
      await load();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setRunning(false);
    }
  }

  function shareWhatsApp(run: BackupRun) {
    if (!run.signed_url) {
      toast.error("Sem link disponível — renove primeiro");
      return;
    }
    const msg = `📦 Backup DISPEL OPERAÇÃO\nData: ${run.run_date}\nTabelas: ${run.tables_count} · Linhas: ${run.rows_total}\nBaixar ZIP (válido 7 dias):\n${run.signed_url}`;
    const url = `https://wa.me/5516997051425?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  if (perms.loading) {
    return (
      <AppShell>
        <div className="p-4 space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!perms.isGestor) {
    return (
      <AppShell>
        <div className="p-6">
          <Card className="p-6 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
            <p className="text-sm">Acesso restrito a gestores.</p>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-4 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-display text-xl tracking-[0.15em]">BACKUPS</h1>
            <p className="text-xs text-muted-foreground">
              ZIP diário com todas as tabelas críticas · gerado automaticamente às 23:30
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-1" /> ATUALIZAR
            </Button>
            <Button size="sm" onClick={generateNow} disabled={running}>
              <PlayCircle className="h-4 w-4 mr-1" />
              {running ? "GERANDO..." : "GERAR AGORA"}
            </Button>
          </div>
        </div>

        {runs === null ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : runs.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nenhum backup ainda. Clique em <strong>GERAR AGORA</strong> para criar o primeiro.
          </Card>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => (
              <Card key={r.id} className="p-3 flex items-start gap-3 flex-wrap">
                <div className="mt-1">
                  {r.status === "success" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm">{r.run_date}</span>
                    <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-muted">
                      {r.triggered_by}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-muted">
                      {new Date(r.created_at).toLocaleTimeString("pt-BR")}
                    </span>
                  </div>
                  {r.status === "success" ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.tables_count} tabelas · {r.rows_total} linhas · {formatSize(r.size_bytes)}
                    </p>
                  ) : (
                    <p className="text-xs text-red-600 mt-1 break-all">{r.error}</p>
                  )}
                </div>
                {r.status === "success" && (
                  <div className="flex gap-1 flex-wrap">
                    {r.signed_url ? (
                      <a
                        href={r.signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 h-8 px-2 rounded-md border text-xs hover:bg-muted"
                      >
                        <Download className="h-3.5 w-3.5" /> BAIXAR
                      </a>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => refreshSigned(r)}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> RENOVAR LINK
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shareWhatsApp(r)}
                      disabled={!r.signed_url}
                    >
                      <MessageCircle className="h-3.5 w-3.5 mr-1" /> WHATSAPP
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export const Route = createFileRoute("/app/backups")({
  component: BackupsPage,
});
