import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { BarsMap } from "@/components/BarsMap";
import { toast } from "sonner";
import {
  Wrench, ChevronRight, AlertTriangle, Plus, CheckCircle2, MapPin, Loader2,
  Building2, Store, Trophy, MessageCircle, FileText, Phone, QrCode, Copy, ExternalLink, Pencil,
} from "lucide-react";
import contratoAsset from "@/assets/comodato_2026.pdf.asset.json";

export const Route = createFileRoute("/app/manutencao/")({
  component: ManutencaoIndex,
});

const TYPE_LABEL: Record<string, string> = {
  camarote: "Camarote",
  stand: "Stand",
  haras: "Haras",
  bar_venda: "Bar venda",
  bar_parceiro: "Bar parceiro",
};

const DISPEL_PHONE_LABEL = "(31) 99915-9662";
const DEFAULT_COORDS = { latitude: -19.930666, longitude: -43.985782 };

function ManutencaoIndex() {
  const { user } = useSession();
  const [bars, setBars] = useState<any[]>([]);
  const [installs, setInstalls] = useState<Record<string, any>>({});
  const [requests, setRequests] = useState<any[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [openNewReq, setOpenNewReq] = useState(false);
  const [openNewInstall, setOpenNewInstall] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [historyPhotoUrls, setHistoryPhotoUrls] = useState<Record<string, string>>({});
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  async function load() {
    const [{ data: b }, { data: i }, { data: r }] = await Promise.all([
      supabase.from("bars").select("id,name,bar_type,latitude,longitude,apoio_responsavel")
        .in("bar_type", ["camarote", "stand", "haras"])
        .order("name"),
      supabase.from("bar_installations").select("*"),
      supabase.from("public_maintenance_requests")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
    const map: Record<string, any> = {};
    (i ?? []).forEach((x: any) => (map[x.bar_id] = x));
    setBars(b ?? []);
    setInstalls(map);
    setRequests(r ?? []);

    const pend = (r ?? []).filter((x: any) => x.status === "pendente" && x.photo_path);
    const urls: Record<string, string> = {};
    for (const req of pend) {
      const { data } = await supabase.storage.from("operacao-fotos").createSignedUrl(req.photo_path as string, 3600);
      if (data?.signedUrl) urls[req.id] = data.signedUrl;
    }
    setPhotoUrls(urls);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const id = setInterval(() => { load(); }, 30000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const total: Record<string, number> = { camarote: 0, stand: 0, haras: 0 };
    const installed: Record<string, number> = { camarote: 0, stand: 0, haras: 0 };
    for (const b of bars) {
      total[b.bar_type] = (total[b.bar_type] ?? 0) + 1;
      if (installs[b.id]?.brand) installed[b.bar_type] = (installed[b.bar_type] ?? 0) + 1;
    }
    return { total, installed };
  }, [bars, installs]);

  const pending = requests.filter((r) => r.status === "pendente");
  const completed = requests.filter((r) => r.status === "concluida");
  const pendingByBar = useMemo(() => {
    const m: Record<string, number> = {};
    pending.forEach((p) => { m[p.bar_id] = (m[p.bar_id] ?? 0) + 1; });
    return m;
  }, [pending]);

  const mapBars = bars
    .filter((b) => b.latitude != null && b.longitude != null)
    .map((b) => ({ id: b.id, name: b.name, bar_type: b.bar_type, latitude: Number(b.latitude), longitude: Number(b.longitude) }));

  async function concluir(id: string) {
    if (!user?.id) return toast.error("Faça login");
    const { error } = await supabase.from("public_maintenance_requests").update({
      status: "concluida",
      completed_at: new Date().toISOString(),
      completed_by: user.id,
      completed_notes: notes.trim() || null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Manutenção finalizada");
    setCompletingId(null);
    setNotes("");
    load();
  }

  const installedBars = bars.filter((b) => installs[b.id]?.brand);
  const pendingInstallBars = bars.filter((b) => !installs[b.id]?.brand);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <Wrench className="w-6 h-6 text-accent" />
        <div className="flex-1">
          <h1 className="font-display text-2xl tracking-wider">MANUTENÇÃO & INSTALAÇÃO</h1>
          <p className="text-xs text-muted-foreground">Camarotes, Stands e Haras</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Building2 className="w-4 h-4" />} label="Camarotes" installed={stats.installed.camarote} total={stats.total.camarote} color="text-[#F4B942]" />
        <StatCard icon={<Store className="w-4 h-4" />} label="Stands" installed={stats.installed.stand} total={stats.total.stand} color="text-[#3B82F6]" />
        <StatCard icon={<Trophy className="w-4 h-4" />} label="Haras" installed={stats.installed.haras} total={stats.total.haras} color="text-[#EF4444]" />
        <button
          type="button"
          onClick={async () => {
            setOpenHistory(true);
            const withPhotos = completed.filter((r) => r.photo_path && !historyPhotoUrls[r.id]);
            if (withPhotos.length) {
              const urls: Record<string, string> = {};
              for (const req of withPhotos) {
                const { data } = await supabase.storage.from("operacao-fotos").createSignedUrl(req.photo_path as string, 3600);
                if (data?.signedUrl) urls[req.id] = data.signedUrl;
              }
              setHistoryPhotoUrls((prev) => ({ ...prev, ...urls }));
            }
          }}
          className="text-left"
        >
          <Card className="p-3 hover:border-accent transition cursor-pointer h-full">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Manutenções concluídas
            </div>
            <div className="text-2xl font-display tracking-wider mt-1">{completed.length}</div>
            <div className="text-[10px] text-muted-foreground">{pending.length} pendente{pending.length !== 1 ? "s" : ""} · ver histórico</div>
          </Card>
        </button>
      </div>

      <Dialog open={openHistory} onOpenChange={setOpenHistory}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">HISTÓRICO DE MANUTENÇÕES CONCLUÍDAS</DialogTitle>
          </DialogHeader>
          {completed.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma manutenção concluída ainda.</div>
          ) : (
            <div className="space-y-2">
              {completed.map((r) => {
                const bar = bars.find((b) => b.id === r.bar_id);
                return (
                  <div key={r.id} className="border border-border rounded p-3 space-y-2">
                    <div className="flex items-start gap-3">
                      {historyPhotoUrls[r.id] && (
                        <a href={historyPhotoUrls[r.id]} target="_blank" rel="noreferrer">
                          <img src={historyPhotoUrls[r.id]} className="w-16 h-16 rounded object-cover" />
                        </a>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-primary text-primary-foreground text-[9px]">CONCLUÍDA</Badge>
                          <span className="text-sm font-medium">{bar?.name ?? "—"}</span>
                          {bar && <Badge variant="outline" className="text-[9px]">{TYPE_LABEL[bar.bar_type]}</Badge>}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Aberta: {new Date(r.created_at).toLocaleString("pt-BR")}
                          {r.completed_at && <> · Concluída: {new Date(r.completed_at).toLocaleString("pt-BR")}</>}
                        </div>
                        {r.requester_name && (
                          <div className="text-[11px] text-muted-foreground">Solicitante: {r.requester_name}</div>
                        )}
                        <div className="text-sm mt-1"><b>Problema:</b> {r.description}</div>
                        {r.completed_notes && (
                          <div className="text-sm mt-1"><b>Resolução:</b> {r.completed_notes}</div>
                        )}
                        {r.latitude != null && r.longitude != null && (
                          <a
                            href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                            target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-accent mt-1"
                          >
                            <MapPin className="w-3 h-3" /> Ver localização
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Minimap */}
      {mapBars.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-2 flex items-center gap-2 border-b border-border">
            <MapPin className="w-4 h-4 text-accent" />
            <div className="font-display tracking-wider text-sm">MAPA</div>
            <div className="text-[10px] text-muted-foreground ml-auto flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#F4B942" }} /> Camarote
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#3B82F6" }} /> Stand
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#EF4444" }} /> Haras
            </div>
          </div>
          <div style={{ height: 280 }}>
            <BarsMap bars={mapBars as any} />
          </div>
        </Card>
      )}

      <Tabs defaultValue="manutencao">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="manutencao" className="gap-2">
            <Wrench className="w-3 h-3" /> MANUTENÇÃO
            {pending.length > 0 && <Badge variant="destructive" className="text-[9px] px-1">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="instalacao" className="gap-2">
            <Building2 className="w-3 h-3" /> INSTALAÇÃO
          </TabsTrigger>
        </TabsList>

        {/* ============ MANUTENÇÃO TAB ============ */}
        <TabsContent value="manutencao" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Alertas ativos</div>
            <NewRequestDialog open={openNewReq} onOpenChange={setOpenNewReq} bars={bars} userId={user?.id} onCreated={load} />
          </div>

          <Card className={`p-4 space-y-3 ${pending.length > 0 ? "border-destructive" : ""}`}>
            <div className="flex items-center gap-2">
              {pending.length > 0
                ? <AlertTriangle className="w-4 h-4 text-destructive" />
                : <CheckCircle2 className="w-4 h-4 text-primary" />}
              <div className="font-display tracking-wider text-sm">ALERTAS DE MANUTENÇÃO</div>
              {pending.length > 0 && <Badge variant="destructive" className="ml-auto">{pending.length}</Badge>}
            </div>

            {pending.length === 0 && (
              <div className="text-xs text-muted-foreground">Sem alertas pendentes.</div>
            )}

            {pending.map((r) => {
              const bar = bars.find((b) => b.id === r.bar_id);
              return (
                <div key={r.id} className="border border-destructive/40 rounded p-3 bg-destructive/5 space-y-2">
                  <div className="flex items-start gap-3">
                    {photoUrls[r.id] && (
                      <a href={photoUrls[r.id]} target="_blank" rel="noreferrer">
                        <img src={photoUrls[r.id]} className="w-16 h-16 rounded object-cover" />
                      </a>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="destructive" className="text-[9px]">
                          {r.source === "manual" ? "MANUAL" : "QR CODE"}
                        </Badge>
                        <span className="text-sm font-medium">{bar?.name ?? "—"}</span>
                        {bar && <Badge variant="outline" className="text-[9px]">{TYPE_LABEL[bar.bar_type]}</Badge>}
                        <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      {r.requester_name && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">Solicitante: {r.requester_name}</div>
                      )}
                      <div className="text-sm mt-1">{r.description}</div>
                      {r.latitude != null && r.longitude != null && (
                        <a
                          href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                          target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-accent mt-1"
                        >
                          <MapPin className="w-3 h-3" /> Ver localização
                        </a>
                      )}
                    </div>
                  </div>
                  {completingId === r.id ? (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="O que foi feito? (opcional)" />
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => { setCompletingId(null); setNotes(""); }}>Cancelar</Button>
                        <Button size="sm" className="flex-1" onClick={() => concluir(r.id)}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmar finalização
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setCompletingId(r.id)}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Manutenção finalizada
                      </Button>
                      {bar && (
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/app/manutencao/$barId" params={{ barId: bar.id }}>
                            Abrir bar <ChevronRight className="w-3 h-3 ml-1" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>

          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Todos os pontos</div>
            {loading && (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-1/3 bg-muted/70 animate-pulse rounded" />
                    </div>
                    <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                  </Card>
                ))}
              </div>
            )}
            {!loading && bars.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                Nenhum camarote/stand/haras cadastrado ainda.
              </Card>
            )}
            <div className="space-y-2">
              {bars.map((b) => {
                const inst = installs[b.id];
                const installed = !!inst?.brand;
                const pend = pendingByBar[b.id] ?? 0;
                return (
                  <Link key={b.id} to="/app/manutencao/$barId" params={{ barId: b.id }}>
                    <Card className={`p-4 flex items-center gap-3 hover:border-accent transition ${pend > 0 ? "border-destructive" : ""}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{b.name}</span>
                          <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[b.bar_type]}</Badge>
                          {pend > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                              <AlertTriangle className="w-3 h-3 mr-1" />{pend} pendente{pend !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {installed
                            ? `${inst.brand?.toUpperCase()} · ${inst.bicos ?? "?"} bico(s) · ${inst.responsavel_nome ?? "sem responsável"}`
                            : "Sem instalação registrada"}
                        </div>
                      </div>
                      {installed ? (
                        <Badge className="bg-primary text-primary-foreground">INSTALADO</Badge>
                      ) : (
                        <Badge variant="secondary">PENDENTE</Badge>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ============ INSTALAÇÃO TAB ============ */}
        <TabsContent value="instalacao" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Instalações cadastradas</div>
            <NewInstallationDialog
              open={openNewInstall}
              onOpenChange={setOpenNewInstall}
              userId={user?.id}
              onCreated={load}
            />
          </div>

          {pendingInstallBars.length > 0 && (
            <Card className="p-4 space-y-2 border-yellow-500/40 bg-yellow-500/5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <div className="font-display tracking-wider text-sm">SEM INSTALAÇÃO REGISTRADA</div>
                <Badge variant="outline" className="ml-auto">{pendingInstallBars.length}</Badge>
              </div>
              <div className="space-y-1">
                {pendingInstallBars.map((b) => (
                  <div key={b.id} className="rounded border border-border bg-background/50 p-2 space-y-2">
                    <Link to="/app/manutencao/$barId" params={{ barId: b.id }}
                      className="flex items-center gap-2 text-sm hover:text-accent">
                      <ChevronRight className="w-3 h-3" />
                      <span className="font-medium">{b.name}</span>
                      <Badge variant="outline" className="text-[9px]">{TYPE_LABEL[b.bar_type]}</Badge>
                    </Link>
                    <QrInlineBinder barId={b.id} barName={b.name} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <div className="font-display tracking-wider text-sm">INSTALAÇÕES ATIVAS</div>
              <Badge className="ml-auto bg-primary text-primary-foreground">{installedBars.length}</Badge>
            </div>
            {installedBars.length === 0 && (
              <div className="text-xs text-muted-foreground">Nenhuma instalação cadastrada ainda. Clique em <b>+ Nova Instalação</b>.</div>
            )}
            <div className="space-y-2">
              {installedBars.map((b) => {
                const inst = installs[b.id];
                return (
                  <Card key={b.id} className="p-3 space-y-2 hover:border-accent transition">
                    <div className="flex items-start gap-3">
                      <Link to="/app/manutencao/$barId" params={{ barId: b.id }} className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{b.name}</span>
                          <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[b.bar_type]}</Badge>
                          <Badge className="bg-primary/20 text-primary text-[10px]">{inst.brand?.toUpperCase()}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {inst.bicos ?? "?"} bico(s) · {inst.cilindro_qtd ?? 0} cilindro(s) · {inst.manometro_qtd ?? 0} manômetro(s)
                        </div>
                        {inst.responsavel_nome && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            <Phone className="inline w-3 h-3 mr-1" />
                            {inst.responsavel_nome}{inst.responsavel_telefone ? ` · ${inst.responsavel_telefone}` : ""}
                          </div>
                        )}
                      </Link>
                      <QrDialog barId={b.id} barName={b.name} />
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/app/manutencao/$barId" params={{ barId: b.id }}>
                          <Pencil className="w-3 h-3 mr-1" /> Editar
                        </Link>
                      </Button>
                    </div>
                    <QrInlineBinder barId={b.id} barName={b.name} />
                  </Card>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon, label, installed, total, color }: {
  icon: React.ReactNode; label: string; installed: number; total: number; color: string;
}) {
  return (
    <Card className="p-3">
      <div className={`flex items-center gap-2 text-xs text-muted-foreground`}>
        <span className={color}>{icon}</span> {label}
      </div>
      <div className="text-2xl font-display tracking-wider mt-1">
        {installed}<span className="text-sm text-muted-foreground">/{total}</span>
      </div>
      <div className="text-[10px] text-muted-foreground">instalados</div>
    </Card>
  );
}

function NewRequestDialog({
  open, onOpenChange, bars, userId, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bars: any[];
  userId?: string;
  onCreated: () => void;
}) {
  const [barId, setBarId] = useState<string>("");
  const [nome, setNome] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!barId) return toast.error("Selecione o local");
    if (!desc.trim()) return toast.error("Descreva o problema");
    if (!userId) return toast.error("Faça login");
    setSaving(true);
    try {
      const { error } = await supabase.from("public_maintenance_requests").insert({
        bar_id: barId,
        requester_name: nome.trim() || null,
        description: desc.trim(),
        source: "manual",
        status: "pendente",
      });
      if (error) return toast.error(error.message);
      toast.success("Solicitação registrada");
      setBarId(""); setNome(""); setDesc("");
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error("Falha ao registrar solicitação", { description: err?.message ?? "Verifique a conexão" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Plus className="w-4 h-4" /> Nova manutenção
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">NOVA MANUTENÇÃO</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Local *</Label>
            <select
              value={barId}
              onChange={(e) => setBarId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selecione…</option>
              {bars.map((b) => (
                <option key={b.id} value={b.id}>{b.name} — {TYPE_LABEL[b.bar_type]}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Solicitante (opcional)</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label className="text-xs">O que precisa de manutenção? *</Label>
            <Textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Criar alerta</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- New Installation Dialog ---------------- */

function NewInstallationDialog({
  open, onOpenChange, userId, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId?: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [barType, setBarType] = useState<"camarote" | "stand" | "haras">("camarote");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [brand, setBrand] = useState<"heineken" | "amstel">("heineken");
  const [bicos, setBicos] = useState(1);
  const [manometro, setManometro] = useState(1);
  const [cilindro, setCilindro] = useState(1);
  const [respNome, setRespNome] = useState("");
  const [respTel, setRespTel] = useState("");
  const [valores, setValores] = useState("");
  const [informacoes, setInformacoes] = useState("");
  const [contratoFile, setContratoFile] = useState<File | null>(null);
  const [qrCode, setQrCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [gettingLoc, setGettingLoc] = useState(false);

  function captureLocation() {
    if (!navigator.geolocation) return toast.error("Geolocalização não disponível");
    setGettingLoc(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setGettingLoc(false);
        toast.success("Localização capturada");
      },
      (err) => { setGettingLoc(false); toast.error("Erro localização: " + err.message); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function reset() {
    setName(""); setBarType("camarote"); setLat(""); setLng("");
    setBrand("heineken"); setBicos(1); setManometro(1); setCilindro(1);
    setRespNome(""); setRespTel(""); setValores(""); setInformacoes("");
    setContratoFile(null); setQrCode("");
  }

  async function submit(sendWa: boolean) {
    if (!name.trim()) return toast.error("Nome é obrigatório");
    if (!userId) return toast.error("Faça login");

    const code = qrCode.trim().toUpperCase();
    const latNumber = Number(lat);
    const lngNumber = Number(lng);
    const hasValidCoords = Number.isFinite(latNumber) && Number.isFinite(lngNumber);
    const coords = hasValidCoords ? { latitude: latNumber, longitude: lngNumber } : DEFAULT_COORDS;

    setSaving(true);
    let contratoPath: string | null = null;
    let qrWarning: string | null = null;

    try {
      const { data: bar, error: barErr } = await supabase.from("bars").insert({
        name: name.trim(),
        bar_type: barType,
        latitude: coords.latitude,
        longitude: coords.longitude,
        created_by: userId,
      }).select().single();

      if (barErr || !bar) throw new Error(barErr?.message ?? "Erro ao criar local");

      const { error: instErr } = await supabase.from("bar_installations").insert({
        bar_id: bar.id,
        brand,
        bicos,
        manometro_qtd: manometro,
        cilindro_qtd: cilindro,
        responsavel_nome: respNome.trim() || null,
        responsavel_telefone: respTel.trim() || null,
        valores: valores.trim() || null,
        informacoes: informacoes.trim() || null,
        contrato_photo_url: null,
        updated_by: userId,
      });
      if (instErr) throw new Error(instErr.message);

      if (code) {
        const { data: tok, error: tokErr } = await supabase
          .from("qr_tokens").select("id,bar_id").eq("code", code).maybeSingle();
        if (tokErr) {
          qrWarning = `Instalação salva, mas não consegui verificar o QR ${code}.`;
        } else if (!tok) {
          qrWarning = `Instalação salva, mas o QR ${code} não existe na folha DSP-0001 a DSP-0070.`;
        } else if (tok.bar_id) {
          qrWarning = `Instalação salva, mas o QR ${code} já estava vinculado a outro ponto.`;
        } else {
          const { error: qrErr } = await supabase
            .from("qr_tokens")
            .update({ bar_id: bar.id, assigned_at: new Date().toISOString() })
            .eq("code", code);
          if (qrErr) qrWarning = `Instalação salva, mas não consegui vincular o QR: ${qrErr.message}`;
        }
      }

      if (contratoFile) {
        const path = `${bar.id}/contrato/${Date.now()}_${contratoFile.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("operacao-fotos").upload(path, contratoFile);
        if (upErr) {
          toast.warning("Instalação salva, mas o contrato não subiu: " + upErr.message);
        } else {
          contratoPath = path;
          const { error: updateErr } = await supabase
            .from("bar_installations")
            .update({ contrato_photo_url: contratoPath, updated_by: userId })
            .eq("bar_id", bar.id);
          if (updateErr) toast.warning("Contrato enviado, mas não foi vinculado: " + updateErr.message);
        }
      }

      if (!hasValidCoords) toast.warning("Salvei com localização padrão. Depois ajuste a posição no mapa.");
      if (qrWarning) toast.warning(qrWarning);
      toast.success("Instalação cadastrada");

      if (sendWa) {
        if (!respTel) {
          toast.error("Sem telefone do responsável para enviar WhatsApp");
        } else {
          await openWhatsApp({
            name: name.trim(), respNome, respTel, brand, bicos,
            manometro, cilindro, valores, informacoes,
            contratoPath,
          });
        }
      }

      reset();
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      console.error("[new installation]", e);
      toast.error("Erro ao salvar instalação: " + (e?.message ?? "verifique a conexão"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus className="w-4 h-4" /> Nova Instalação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">NOVA INSTALAÇÃO</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Identidade */}
          <div className="space-y-2">
            <Label className="text-xs">Nome do local *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Camarote Premium 3" />
            <div>
              <Label className="text-xs">Tipo</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(["camarote", "stand", "haras"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setBarType(t)}
                    className={`px-2 py-2 rounded border text-xs uppercase ${barType === t ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Latitude</Label>
                <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="—" />
              </div>
              <div>
                <Label className="text-xs">Longitude</Label>
                <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="—" />
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={captureLocation} disabled={gettingLoc}>
              {gettingLoc ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <MapPin className="w-3 h-3 mr-2" />}
              Capturar localização atual
            </Button>
            <div className="pt-2">
              <Label className="text-xs flex items-center gap-1">
                <QrCode className="w-3 h-3 text-accent" /> Código QR da choppeira (DSP-XXXX) *
              </Label>
              <Input
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value.toUpperCase())}
                placeholder="DSP-0001"
                className="font-mono uppercase"
                maxLength={12}
              />
              <div className="text-[10px] text-muted-foreground mt-1">
                Digite o código impresso na etiqueta física que será colada nesta choppeira.
              </div>
            </div>
          </div>

          {/* Choppeira */}
          <div className="space-y-2 border-t border-border pt-3">
            <div className="font-display tracking-wider text-xs text-muted-foreground">CHOPPEIRA</div>
            <div className="grid grid-cols-2 gap-2">
              {(["heineken", "amstel"] as const).map((b) => (
                <button key={b} type="button" onClick={() => setBrand(b)}
                  className={`px-3 py-2 rounded border text-sm ${brand === b ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                  {b === "heineken" ? "Heineken" : "Amstel"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[1, 2].map((n) => (
                <button key={n} type="button" onClick={() => setBicos(n)}
                  className={`px-3 py-2 rounded border text-sm ${bicos === n ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                  {n} {n === 1 ? "bico" : "bicos"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Manômetros</Label>
                <Input type="number" min={0} inputMode="numeric" placeholder="0" value={manometro === 0 ? "" : String(manometro)} onChange={(e) => setManometro(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label className="text-xs">Cilindros</Label>
                <Input type="number" min={0} inputMode="numeric" placeholder="0" value={cilindro === 0 ? "" : String(cilindro)} onChange={(e) => setCilindro(Number(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          {/* Responsável */}
          <div className="space-y-2 border-t border-border pt-3">
            <div className="font-display tracking-wider text-xs text-muted-foreground">RESPONSÁVEL</div>
            <Input value={respNome} onChange={(e) => setRespNome(e.target.value)} placeholder="Nome do responsável" />
            <Input value={respTel} onChange={(e) => setRespTel(e.target.value)} placeholder="Telefone (11) 99999-9999" inputMode="tel" />
          </div>

          {/* Contrato */}
          <div className="space-y-2 border-t border-border pt-3">
            <div className="font-display tracking-wider text-xs text-muted-foreground">CONTRATO & INFORMAÇÕES</div>
            <div>
              <Label className="text-xs">Minuta / contrato assinado (PDF ou foto)</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setContratoFile(e.target.files?.[0] ?? null)} />
              <div className="text-[10px] text-muted-foreground mt-1">
                <FileText className="inline w-3 h-3 mr-1" />
                Contrato padrão Dispel também será enviado no WhatsApp.
              </div>
            </div>
            <div>
              <Label className="text-xs">Valores</Label>
              <Textarea rows={2} value={valores} onChange={(e) => setValores(e.target.value)} placeholder="Valores acordados, aluguel, consumo mínimo…" />
            </div>
            <div>
              <Label className="text-xs">Informações relevantes</Label>
              <Textarea rows={2} value={informacoes} onChange={(e) => setInformacoes(e.target.value)} placeholder="Observações, condições…" />
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground border-t border-border pt-2">
            Contato Dispel: <span className="text-accent">{DISPEL_PHONE_LABEL}</span>
          </div>
        </div>
        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={() => submit(false)} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Salvar</>}
          </Button>
          <Button onClick={() => submit(true)} disabled={saving} className="bg-[#25D366] hover:bg-[#1fb655] text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><MessageCircle className="w-4 h-4 mr-1" /> Salvar & Enviar WhatsApp</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function openWhatsApp(o: {
  name: string; respNome: string; respTel: string;
  brand: string; bicos: number; manometro: number; cilindro: number;
  valores: string; informacoes: string;
  contratoPath?: string | null;
}) {
  const clean = o.respTel.replace(/\D/g, "");
  const withCountry = clean.startsWith("55") ? clean : "55" + clean;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  let contratoLink = `${origin}${contratoAsset.url}`;
  let contratoLabel = "📄 *Contrato (minuta modelo):* ";
  if (o.contratoPath) {
    const { data } = await supabase.storage
      .from("operacao-fotos")
      .createSignedUrl(o.contratoPath, 60 * 60 * 24 * 365);
    if (data?.signedUrl) {
      contratoLink = data.signedUrl;
      contratoLabel = "📄 *Contrato assinado:* ";
    }
  }

  const lines = [
    `Olá ${o.respNome || ""}! Segue o contrato de comodato e informações da Dispel para o *${o.name}*.`,
    "",
    contratoLabel + contratoLink,
    "",
    "🍺 *Choppeira instalada:*",
    `• Marca: ${o.brand === "heineken" ? "Heineken" : "Amstel"}`,
    `• Bicos: ${o.bicos}`,
    `• Manômetros: ${o.manometro}`,
    `• Cilindros: ${o.cilindro}`,
    "",
    o.valores ? `💰 *Valores:*\n${o.valores}\n` : "",
    o.informacoes ? `ℹ️ *Informações:*\n${o.informacoes}\n` : "",
    "📱 *Precisa de manutenção?* Basta ler o *QR Code* fixado ao lado da sua choppeira — nossa equipe será acionada na hora.",
    "🍺 *Para pedidos de bebida*, envie uma mensagem para *(31) 99809-5282* (All Star).",
    "",
    `📞 Dúvidas e suporte: ${DISPEL_PHONE_LABEL}`,
    "",
    "✨ *A excelência não termina na entrega.*",
    "Nossa equipe técnica está pronta para manter sua operação sempre no mais alto nível.",
  ].filter(Boolean).join("\n");
  const url = `https://wa.me/${withCountry}?text=${encodeURIComponent(lines)}`;
  window.open(url, "_blank");
}

function QrInlineBinder({ barId, barName }: { barId: string; barName: string }) {
  const [linkedCodes, setLinkedCodes] = useState<string[]>([]);
  const [newCode, setNewCode] = useState("");
  const [linking, setLinking] = useState(false);

  async function loadLinked() {
    const { data } = await supabase
      .from("qr_tokens")
      .select("code")
      .eq("bar_id", barId)
      .order("code");
    setLinkedCodes((data ?? []).map((r: any) => r.code));
  }

  useEffect(() => { loadLinked(); }, [barId]);

  async function linkCode() {
    const code = newCode.trim().toUpperCase();
    if (!code) return toast.error("Digite o código DSP-XXXX");
    setLinking(true);
    const { data: existing } = await supabase
      .from("qr_tokens")
      .select("id,bar_id")
      .eq("code", code)
      .maybeSingle();
    if (!existing) {
      toast.error(`Código ${code} não existe. Use um da folha impressa (DSP-0001 a DSP-0070).`);
      setLinking(false);
      return;
    }
    if (existing.bar_id && existing.bar_id !== barId) {
      toast.error(`Código ${code} já está vinculado a outro ponto.`);
      setLinking(false);
      return;
    }
    const { error } = await supabase
      .from("qr_tokens")
      .update({ bar_id: barId, assigned_at: new Date().toISOString() })
      .eq("code", code);
    setLinking(false);
    if (error) return toast.error(error.message);
    toast.success(`QR ${code} vinculado a ${barName}`);
    setNewCode("");
    loadLinked();
  }

  async function unlinkCode(code: string) {
    const { error } = await supabase
      .from("qr_tokens")
      .update({ bar_id: null, assigned_at: null })
      .eq("code", code);
    if (error) return toast.error(error.message);
    toast.success(`QR ${code} desvinculado`);
    loadLinked();
  }

  return (
    <div className="rounded border border-accent/40 bg-muted/30 p-2 space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide">
        <QrCode className="w-3 h-3 text-accent" /> Cadastrar QR da choppeira
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="DSP-0001"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          className="h-9 uppercase font-mono text-xs"
        />
        <Button size="sm" className="h-9" onClick={linkCode} disabled={linking}>
          {linking ? <Loader2 className="w-3 h-3 animate-spin" /> : "Vincular"}
        </Button>
      </div>
      {linkedCodes.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {linkedCodes.map((c) => (
            <button
              key={c}
              onClick={() => unlinkCode(c)}
              className="text-[10px] font-mono bg-primary/15 text-primary px-2 py-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition"
              title="Clique para desvincular"
            >
              {c} ✕
            </button>
          ))}
        </div>
      ) : (
        <div className="text-[10px] text-muted-foreground">Digite o código impresso no QR físico e toque em Vincular.</div>
      )}
    </div>
  );
}

function QrDialog({ barId, barName }: { barId: string; barName: string }) {
  const [open, setOpen] = useState(false);
  const [linkedCodes, setLinkedCodes] = useState<string[]>([]);
  const [newCode, setNewCode] = useState("");
  const [linking, setLinking] = useState(false);

  async function loadLinked() {
    const { data } = await supabase
      .from("qr_tokens")
      .select("code")
      .eq("bar_id", barId)
      .order("code");
    setLinkedCodes((data ?? []).map((r: any) => r.code));
  }

  useEffect(() => { if (open) loadLinked(); }, [open, barId]);

  async function linkCode() {
    const code = newCode.trim().toUpperCase();
    if (!code) return;
    setLinking(true);
    const { data: existing } = await supabase
      .from("qr_tokens").select("id,bar_id").eq("code", code).maybeSingle();
    if (!existing) {
      toast.error(`Código ${code} não existe. Use um da folha impressa (DSP-0001 a DSP-0070).`);
      setLinking(false); return;
    }
    if (existing.bar_id && existing.bar_id !== barId) {
      toast.error(`Código ${code} já está vinculado a outro ponto.`);
      setLinking(false); return;
    }
    const { error } = await supabase
      .from("qr_tokens")
      .update({ bar_id: barId, assigned_at: new Date().toISOString() })
      .eq("code", code);
    setLinking(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`QR ${code} vinculado a ${barName}`);
    setNewCode("");
    loadLinked();
  }

  async function unlinkCode(code: string) {
    const { error } = await supabase
      .from("qr_tokens")
      .update({ bar_id: null, assigned_at: null })
      .eq("code", code);
    if (error) { toast.error(error.message); return; }
    toast.success(`QR ${code} desvinculado`);
    loadLinked();
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const primaryCode = linkedCodes[0];
  const url = primaryCode ? `${origin}/r/t/${primaryCode}` : `${origin}/r/${barId}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=12&data=${encodeURIComponent(url)}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        >
          <QrCode className="w-3 h-3" /> QR
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">QR CODE · {barName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded border border-border p-3 bg-muted/30 space-y-2">
            <div className="text-[11px] font-medium">Vincular código QR impresso</div>
            <div className="flex gap-2">
              <Input
                placeholder="DSP-0001"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="h-8 uppercase font-mono text-xs"
              />
              <Button size="sm" className="h-8" onClick={linkCode} disabled={linking}>
                {linking ? <Loader2 className="w-3 h-3 animate-spin" /> : "Vincular"}
              </Button>
            </div>
            {linkedCodes.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {linkedCodes.map((c) => (
                  <button
                    key={c}
                    onClick={() => unlinkCode(c)}
                    className="text-[10px] font-mono bg-primary/15 text-primary px-2 py-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition"
                    title="Clique para desvincular"
                  >
                    {c} ✕
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            {primaryCode
              ? `QR físico ${primaryCode}: ao escanear, cliente abre o painel público (Manutenção · Dispel / Pedido · All Star).`
              : "Sem código físico vinculado — usando link direto do ponto. Vincule um DSP-XXXX acima para usar a etiqueta impressa."}
          </p>
          <div className="flex justify-center">
            <img src={qrSrc} alt={`QR ${barName}`} className="w-56 h-56 border border-border rounded bg-white p-2" />
          </div>
          <div className="text-[10px] text-muted-foreground break-all font-mono text-center">{url}</div>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}>
              <Copy className="w-3 h-3 mr-1" /> Copiar
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={qrSrc} download={`qr-${barName.replace(/\s+/g, "-")}.png`}>
                <QrCode className="w-3 h-3 mr-1" /> Baixar
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="w-3 h-3 mr-1" /> Abrir
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
