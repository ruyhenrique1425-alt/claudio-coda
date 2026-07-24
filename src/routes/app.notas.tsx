import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Beer,
  Recycle,
  Download,
  Eye,
} from "lucide-react";
import { downloadCsv, timestampSlug } from "@/lib/exportCsv";

export const Route = createFileRoute("/app/notas")({
  component: NotasPage,
  head: () => ({
    meta: [
      { title: "Notas Fiscais · Dispel Operação" },
      {
        name: "description",
        content: "Central de notas fiscais e controle de comodato de barris.",
      },
    ],
  }),
});

type Marca = "heineken" | "amstel";
type Comodato = {
  marca: Marca;
  vazios_disponiveis: number;
  cheios_recebidos_acumulados: number;
  vazios_devolvidos_acumulados: number;
};
type NF = {
  id: string;
  numero_nf: string;
  fornecedor: string;
  data_emissao: string | null;
  arquivo_url: string | null;
  status: "pendente_revisao" | "conciliado" | "rejeitado";
  status_comodato: "quitado" | "pendente_cascos";
  heineken_cheios: number;
  amstel_cheios: number;
  heineken_vazios: number;
  amstel_vazios: number;
  barris_cheios_solicitados: number;
  barris_vazios_devolvidos: number;
  notes: string | null;
  created_at: string;
  conciliado_at: string | null;
};

export function NotasPage() {
  const { user } = useSession();
  const perms = usePermissions(user?.id);
  const [notas, setNotas] = useState<NF[]>([]);
  const [comodato, setComodato] = useState<Comodato[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [reviewNf, setReviewNf] = useState<NF | null>(null);

  const canWrite = perms.isGestor || perms.isAdmin || perms.isManutencao;

  const load = async () => {
    const [n, c] = await Promise.all([
      (supabase as any)
        .from("notas_fiscais")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      (supabase as any).from("controle_comodato_global").select("*"),
    ]);
    setNotas((n.data ?? []) as NF[]);
    setComodato((c.data ?? []) as Comodato[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (!perms.loading && perms.roles.length > 0 && !canWrite && !perms.canAccessDashboard)
    return <Navigate to="/app" />;

  const saldo = (m: Marca) => comodato.find((c) => c.marca === m)?.vazios_disponiveis ?? 0;
  const acumCheios = (m: Marca) =>
    comodato.find((c) => c.marca === m)?.cheios_recebidos_acumulados ?? 0;
  const acumVazios = (m: Marca) =>
    comodato.find((c) => c.marca === m)?.vazios_devolvidos_acumulados ?? 0;

  const pendentes = notas.filter((n) => n.status === "pendente_revisao").length;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <header className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-primary" />
        <div>
          <h1 className="font-display text-2xl tracking-widest">NOTAS FISCAIS</h1>
          <p className="text-xs text-muted-foreground">Central de ingestão + comodato 1:1</p>
        </div>
        {canWrite && (
          <Button className="ml-auto" onClick={() => setOpenNew(true)}>
            <Upload className="w-4 h-4 mr-2" /> NOVA NF
          </Button>
        )}
      </header>

      {/* Saldos de comodato */}
      <div className="grid md:grid-cols-2 gap-4">
        {(["heineken", "amstel"] as Marca[]).map((m) => {
          const disp = saldo(m);
          const cheios = acumCheios(m);
          const vazios = acumVazios(m);
          const pend = cheios - vazios;
          return (
            <Card key={m} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Beer className="w-4 h-4" />
                <div className="font-display tracking-widest text-sm uppercase">{m}</div>
                <span
                  className={`ml-auto text-[10px] font-display tracking-widest px-2 py-0.5 rounded-full ring-1 ${pend > 0 ? "bg-amber-50 text-amber-700 ring-amber-300" : "bg-emerald-50 text-emerald-700 ring-emerald-300"}`}
                >
                  {pend > 0 ? `${pend} CASCOS PENDENTES` : "COMODATO EM DIA"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/40 p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">
                    Vazios disponíveis
                  </div>
                  <div className="text-2xl font-brand text-primary">{disp}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">
                    Cheios recebidos
                  </div>
                  <div className="text-2xl font-brand">{cheios}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">
                    Vazios devolvidos
                  </div>
                  <div className="text-2xl font-brand">{vazios}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Lista NFs */}
      <section className="bg-card rounded-xl border p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-display tracking-widest text-sm">NOTAS ({notas.length})</h2>
          {pendentes > 0 && (
            <span className="text-[10px] font-display tracking-widest px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-300">
              {pendentes} PENDENTES
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() =>
              downloadCsv(
                `notas-fiscais-${timestampSlug()}.csv`,
                notas.map((n) => ({
                  numero: n.numero_nf,
                  fornecedor: n.fornecedor,
                  data: n.data_emissao ?? "",
                  status: n.status,
                  comodato: n.status_comodato,
                  hei_cheios: n.heineken_cheios,
                  ams_cheios: n.amstel_cheios,
                  hei_vazios: n.heineken_vazios,
                  ams_vazios: n.amstel_vazios,
                  conciliado_em: n.conciliado_at ?? "",
                })),
              )
            }
          >
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : notas.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma NF cadastrada. {canWrite && "Clique em NOVA NF para adicionar."}
          </div>
        ) : (
          <div className="divide-y">
            {notas.map((n) => (
              <div key={n.id} className="py-3 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">NF {n.numero_nf}</span>
                    <span className="text-xs text-muted-foreground">· {n.fornecedor}</span>
                    <StatusBadge status={n.status} />
                    {n.status === "conciliado" && <ComodatoBadge status={n.status_comodato} />}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {n.data_emissao
                      ? new Date(n.data_emissao).toLocaleDateString("pt-BR")
                      : "sem data"}{" "}
                    · Cheios: <b>{n.barris_cheios_solicitados}</b> · Vazios:{" "}
                    <b>{n.barris_vazios_devolvidos}</b>
                  </div>
                </div>
                {n.arquivo_url && (
                  <a
                    href={n.arquivo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline text-primary"
                  >
                    <Eye className="w-3 h-3 inline mr-1" /> anexo
                  </a>
                )}
                {canWrite && n.status === "pendente_revisao" && (
                  <Button size="sm" onClick={() => setReviewNf(n)}>
                    REVISAR
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {openNew && (
        <NewNfDialog
          onClose={() => setOpenNew(false)}
          onSaved={() => {
            setOpenNew(false);
            load();
          }}
          userId={user?.id}
        />
      )}
      {reviewNf && (
        <ReviewDialog
          nf={reviewNf}
          saldoHei={saldo("heineken")}
          saldoAms={saldo("amstel")}
          onClose={() => setReviewNf(null)}
          onDone={() => {
            setReviewNf(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: NF["status"] }) {
  const map: Record<NF["status"], { label: string; cls: string; Icon: any }> = {
    pendente_revisao: {
      label: "PENDENTE",
      cls: "bg-amber-50 text-amber-700 ring-amber-300",
      Icon: AlertTriangle,
    },
    conciliado: {
      label: "CONCILIADO",
      cls: "bg-emerald-50 text-emerald-700 ring-emerald-300",
      Icon: CheckCircle2,
    },
    rejeitado: { label: "REJEITADO", cls: "bg-red-50 text-red-700 ring-red-300", Icon: XCircle },
  };
  const { label, cls, Icon } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-display tracking-widest px-2 py-0.5 rounded-full ring-1 ${cls}`}
    >
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

function ComodatoBadge({ status }: { status: NF["status_comodato"] }) {
  const isOk = status === "quitado";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-display tracking-widest px-2 py-0.5 rounded-full ring-1 ${isOk ? "bg-emerald-50 text-emerald-700 ring-emerald-300" : "bg-amber-50 text-amber-700 ring-amber-300"}`}
    >
      <Recycle className="w-3 h-3" /> {isOk ? "COMODATO OK" : "CASCOS PENDENTES"}
    </span>
  );
}

function NewNfDialog({
  onClose,
  onSaved,
  userId,
}: {
  onClose: () => void;
  onSaved: () => void;
  userId?: string;
}) {
  const [numero, setNumero] = useState("");
  const [fornecedor, setFornecedor] = useState("HEINEKEN");
  const [data, setData] = useState<string>(new Date().toISOString().slice(0, 10));
  const [hei, setHei] = useState(0);
  const [ams, setAms] = useState(0);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!numero.trim()) {
      toast.error("Informe o número da NF");
      return;
    }
    setSaving(true);
    try {
      let arquivo_url: string | null = null;
      if (file) {
        const path = `notas_fiscais/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const up = await supabase.storage.from("operacao-fotos").upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (up.error) throw up.error;
        const { data: signed } = await supabase.storage
          .from("operacao-fotos")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        arquivo_url = signed?.signedUrl ?? null;
      }
      const { error } = await (supabase as any).from("notas_fiscais").insert({
        numero_nf: numero.trim(),
        fornecedor: fornecedor.trim() || "HEINEKEN",
        data_emissao: data || null,
        arquivo_url,
        heineken_cheios: hei,
        amstel_cheios: ams,
        barris_cheios_solicitados: hei + ams,
        notes: notes || null,
        created_by: userId,
      });
      if (error) throw error;
      toast.success("NF cadastrada — revise para conciliar");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar NF");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Nota Fiscal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Número da NF</Label>
              <Input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="ex: 123456"
              />
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Data de emissão</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Heineken (cheios)</Label>
              <Input
                type="number"
                min={0}
                value={hei}
                onChange={(e) => setHei(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div>
              <Label>Amstel (cheios)</Label>
              <Input
                type="number"
                min={0}
                value={ams}
                onChange={(e) => setAms(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>
          <div>
            <Label>Anexo (PDF ou foto)</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar NF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({
  nf,
  saldoHei,
  saldoAms,
  onClose,
  onDone,
}: {
  nf: NF;
  saldoHei: number;
  saldoAms: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [heiCheios, setHeiCheios] = useState(nf.heineken_cheios);
  const [amsCheios, setAmsCheios] = useState(nf.amstel_cheios);
  const [heiVazios, setHeiVazios] = useState(nf.heineken_vazios);
  const [amsVazios, setAmsVazios] = useState(nf.amstel_vazios);
  const [saving, setSaving] = useState(false);

  const totalCheios = heiCheios + amsCheios;
  const totalVazios = heiVazios + amsVazios;
  const pendente = totalCheios - totalVazios;

  const semSaldoHei = heiVazios > saldoHei;
  const semSaldoAms = amsVazios > saldoAms;
  const bloqueado = semSaldoHei || semSaldoAms;

  const conciliar = async () => {
    if (bloqueado) {
      toast.error("Vazios informados excedem o saldo de comodato");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc("conciliar_nota_fiscal", {
        _nf_id: nf.id,
        _heineken_cheios: heiCheios,
        _amstel_cheios: amsCheios,
        _heineken_vazios: heiVazios,
        _amstel_vazios: amsVazios,
      });
      if (error) throw error;
      toast.success(
        pendente > 0
          ? `NF conciliada · ${pendente} cascos pendentes`
          : "NF conciliada · comodato quitado 1:1",
      );
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao conciliar");
    } finally {
      setSaving(false);
    }
  };

  const rejeitar = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("notas_fiscais")
        .update({ status: "rejeitado" })
        .eq("id", nf.id);
      if (error) throw error;
      toast.success("NF rejeitada");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Conciliar NF {nf.numero_nf}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Fornecedor: <b>{nf.fornecedor}</b> · Emissão:{" "}
            {nf.data_emissao ? new Date(nf.data_emissao).toLocaleDateString("pt-BR") : "—"}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="border rounded-lg p-3 space-y-2">
              <div className="font-display tracking-widest text-xs">HEINEKEN</div>
              <div>
                <Label className="text-[10px]">Cheios recebidos</Label>
                <Input
                  type="number"
                  min={0}
                  value={heiCheios}
                  onChange={(e) => setHeiCheios(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div>
                <Label className="text-[10px]">Vazios devolvidos (saldo: {saldoHei})</Label>
                <Input
                  type="number"
                  min={0}
                  value={heiVazios}
                  onChange={(e) => setHeiVazios(Math.max(0, Number(e.target.value) || 0))}
                  className={semSaldoHei ? "border-red-500" : ""}
                />
                {semSaldoHei && (
                  <p className="text-[10px] text-red-600 mt-1">Excede o saldo disponível</p>
                )}
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-2">
              <div className="font-display tracking-widest text-xs">AMSTEL</div>
              <div>
                <Label className="text-[10px]">Cheios recebidos</Label>
                <Input
                  type="number"
                  min={0}
                  value={amsCheios}
                  onChange={(e) => setAmsCheios(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div>
                <Label className="text-[10px]">Vazios devolvidos (saldo: {saldoAms})</Label>
                <Input
                  type="number"
                  min={0}
                  value={amsVazios}
                  onChange={(e) => setAmsVazios(Math.max(0, Number(e.target.value) || 0))}
                  className={semSaldoAms ? "border-red-500" : ""}
                />
                {semSaldoAms && (
                  <p className="text-[10px] text-red-600 mt-1">Excede o saldo disponível</p>
                )}
              </div>
            </div>
          </div>

          <div
            className={`rounded-lg p-3 text-sm ${pendente > 0 ? "bg-amber-50 text-amber-800 ring-1 ring-amber-300" : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300"}`}
          >
            {pendente > 0 ? (
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <div>
                  <b>Atenção:</b> {pendente} casco(s) sem devolução equivalente. NF será marcada
                  como <b>pendente_cascos</b>.
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5" />
                <div>
                  Comodato 1:1 quitado. Cheios ({totalCheios}) = Vazios ({totalVazios}).
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <Button variant="outline" onClick={rejeitar} disabled={saving}>
            Rejeitar
          </Button>
          <Button onClick={conciliar} disabled={saving || bloqueado}>
            {saving ? "Conciliando…" : "Confirmar e Conciliar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
