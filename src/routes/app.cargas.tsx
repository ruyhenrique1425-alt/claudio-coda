import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Truck, Camera, Beer, Package, RotateCcw, Image as ImageIcon, Plus, Download } from "lucide-react";
import { downloadCsv, timestampSlug } from "@/lib/exportCsv";
import { enqueue } from "@/lib/offlineQueue";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export const Route = createFileRoute("/app/cargas")({ component: CargasHeinekenPage });

type Carga = {
  id: string;
  received_at: string;
  heineken_barris: number;
  amstel_barris: number;
  barris_comodato: number;
  vasilhames_recolhidos: number;
  invoice_number: string | null;
  invoice_photo_url: string | null;
  notes: string | null;
  performed_by: string | null;
};

function CargasHeinekenPage() {
  const { user } = useSession();
  const perms = usePermissions(user?.id);
  const [items, setItems] = useState<Carga[]>([]);
  const [emptiesCollected, setEmptiesCollected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [c, e] = await Promise.all([
      supabase.from("heineken_cargas").select("*").order("received_at", { ascending: false }),
      supabase.from("empties_removed").select("quantidade"),
    ]);
    setItems((c.data ?? []) as Carga[]);
    setEmptiesCollected(((e.data ?? []) as { quantidade: number }[]).reduce((s, r) => s + (r.quantidade || 0), 0));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (!perms.loading && perms.roles.length > 0 && !perms.isGestor && !perms.isManutencao) return <Navigate to="/app" />;

  const totals = items.reduce(
    (acc, i) => ({
      hei: acc.hei + i.heineken_barris,
      ams: acc.ams + i.amstel_barris,
      com: acc.com + i.barris_comodato,
      vas: acc.vas + i.vasilhames_recolhidos,
    }),
    { hei: 0, ams: 0, com: 0, vas: 0 },
  );
  const emptiesAvailable = Math.max(0, emptiesCollected - totals.vas);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Truck className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display text-2xl tracking-widest">CARGAS HEINEKEN</h1>
            <p className="text-xs text-muted-foreground">Recebimento de mercadorias e controle de comodato</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const rows = items.map((c: any) => ({
                data: new Date(c.received_at).toLocaleString("pt-BR"),
                nota_fiscal: c.invoice_number ?? "",
                heineken_barris: c.heineken_barris ?? 0,
                amstel_barris: c.amstel_barris ?? 0,
                barris_comodato: c.barris_comodato ?? 0,
                vasilhames_devolvidos: c.vasilhames_devolvidos ?? 0,
                observacoes: c.notes ?? "",
              }));
              downloadCsv(`cargas-heineken-${timestampSlug()}.csv`, rows);
            }}
          >
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> NOVA CARGA</Button>
            </DialogTrigger>
            <NovaCargaDialog onSaved={() => { setOpen(false); load(); }} userId={user?.id ?? null} emptiesAvailable={emptiesAvailable} />
          </Dialog>
        </div>
      </header>

      <Card className="p-4 border-primary/40 bg-primary/5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[10px] tracking-widest font-display text-muted-foreground">VAZIOS NO ESTOQUE DISPEL</div>
            <div className="text-3xl font-display">{emptiesAvailable} <span className="text-xs text-muted-foreground">barris</span></div>
          </div>
          <div className="text-xs text-muted-foreground text-right">
            Recolhidos nos bares: <b>{emptiesCollected}</b><br />
            Devolvidos à Heineken: <b>{totals.vas}</b>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={<Beer className="w-5 h-5" />} label="HEINEKEN RECEBIDOS" value={totals.hei} suffix="barris" tone="primary" />
        <SummaryCard icon={<Beer className="w-5 h-5" />} label="AMSTEL RECEBIDOS" value={totals.ams} suffix="barris" tone="accent" />
        <SummaryCard icon={<Package className="w-5 h-5" />} label="BARRIS EM COMODATO" value={totals.com} suffix="barris" />
        <SummaryCard icon={<RotateCcw className="w-5 h-5" />} label="VASILHAMES DEVOLVIDOS" value={totals.vas} suffix="unid." />
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-sm tracking-widest text-muted-foreground">HISTÓRICO</h2>
        {loading ? (
          <div className="text-muted-foreground">Carregando...</div>
        ) : items.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">Nenhuma carga registrada ainda.</Card>
        ) : (
          items.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-display text-sm tracking-wider">
                    {new Date(c.received_at).toLocaleString("pt-BR")}
                  </div>
                  {c.invoice_number && (
                    <div className="text-xs text-muted-foreground">NF: {c.invoice_number}</div>
                  )}
                </div>
                {c.invoice_photo_url && (
                  <Button variant="outline" size="sm" onClick={() => setPhotoPreview(c.invoice_photo_url!)}>
                    <ImageIcon className="w-4 h-4 mr-1" /> Nota fiscal
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-sm">
                <Metric label="Heineken" value={c.heineken_barris} />
                <Metric label="Amstel" value={c.amstel_barris} />
                <Metric label="Comodato" value={c.barris_comodato} />
                <Metric label="Vasilhames" value={c.vasilhames_recolhidos} />
              </div>
              {c.notes && <div className="mt-3 text-xs text-muted-foreground whitespace-pre-wrap">{c.notes}</div>}
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!photoPreview} onOpenChange={(o) => !o && setPhotoPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Nota fiscal</DialogTitle></DialogHeader>
          {photoPreview && <img src={photoPreview} alt="Nota fiscal" className="w-full h-auto rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon, label, value, suffix, tone }: { icon: React.ReactNode; label: string; value: number; suffix: string; tone?: "primary" | "accent" }) {
  const toneCls = tone === "primary" ? "bg-primary/5 border-primary/30" : tone === "accent" ? "bg-accent/5 border-accent/30" : "";
  return (
    <Card className={`p-4 ${toneCls}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-[10px] tracking-widest font-display">
        {icon} {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-display">{value}</span>
        <span className="text-xs text-muted-foreground">{suffix}</span>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-2">
      <div className="text-[10px] tracking-wider uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-display">{value}</div>
    </div>
  );
}

function NovaCargaDialog({ onSaved, userId, emptiesAvailable }: { onSaved: () => void; userId: string | null; emptiesAvailable: number }) {
  const [receivedAt, setReceivedAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [hei, setHei] = useState("");
  const [ams, setAms] = useState("");
  const [com, setCom] = useState("");
  const [vas, setVas] = useState("");
  const [invoice, setInvoice] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const n = (v: string) => parseInt(v || "0", 10) || 0;

  const save = async () => {
    if (!photo) {
      toast.error("Anexe a foto da nota fiscal");
      return;
    }
    if (n(vas) > emptiesAvailable) {
      toast.error(`Você só tem ${emptiesAvailable} vasilhames disponíveis no estoque Dispel`);
      return;
    }
    setSaving(true);
    try {
      const payloadBase = {
        received_at: new Date(receivedAt).toISOString(),
        heineken_barris: n(hei),
        amstel_barris: n(ams),
        barris_comodato: n(com),
        vasilhames_recolhidos: n(vas),
        invoice_number: invoice || null,
        notes: notes || null,
        userId,
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const photoBase64 = await fileToBase64(photo);
        await enqueue("carga.submit", { ...payloadBase, photoBase64 });
        toast.success("💾 Salvo offline — sincroniza ao voltar rede");
        onSaved();
        return;
      }

      const path = `cargas/${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const up = await supabase.storage.from("operacao-fotos").upload(path, photo, { upsert: false });
      if (up.error) throw up.error;
      const { data: signed } = await supabase.storage.from("operacao-fotos").createSignedUrl(path, 60 * 60 * 24 * 365);
      const photo_url = signed?.signedUrl ?? null;

      const { error } = await supabase.from("heineken_cargas").insert({
        received_at: payloadBase.received_at,
        heineken_barris: payloadBase.heineken_barris,
        amstel_barris: payloadBase.amstel_barris,
        barris_comodato: payloadBase.barris_comodato,
        vasilhames_recolhidos: payloadBase.vasilhames_recolhidos,
        invoice_number: payloadBase.invoice_number,
        invoice_photo_url: photo_url,
        notes: payloadBase.notes,
        performed_by: userId,
      });
      if (error) throw error;
      toast.success("Carga registrada");
      onSaved();
    } catch (e: unknown) {
      try {
        const msg = e instanceof Error ? e.message : "";
        if (!navigator.onLine || /network|fetch|failed/i.test(msg)) {
          const photoBase64 = await fileToBase64(photo);
          await enqueue("carga.submit", {
            received_at: new Date(receivedAt).toISOString(),
            heineken_barris: n(hei), amstel_barris: n(ams),
            barris_comodato: n(com), vasilhames_recolhidos: n(vas),
            invoice_number: invoice || null, notes: notes || null, userId, photoBase64,
          });
          toast.success("💾 Salvo offline — sincroniza ao voltar rede");
          onSaved();
          return;
        }
      } catch {}
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Nova carga Heineken</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Data/hora do recebimento</label>
          <Input type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Heineken (barris)</label>
            <Input inputMode="numeric" placeholder="0" value={hei} onChange={(e) => setHei(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Amstel (barris)</label>
            <Input inputMode="numeric" placeholder="0" value={ams} onChange={(e) => setAms(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Barris em comodato</label>
            <Input inputMode="numeric" placeholder="0" value={com} onChange={(e) => setCom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Vasilhames recolhidos</label>
            <Input inputMode="numeric" placeholder="0" value={vas} onChange={(e) => setVas(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Número da nota fiscal</label>
          <Input placeholder="NF-e nº" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1"><Camera className="w-3 h-3" /> Foto da nota fiscal (obrigatório)</label>
          <Input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Observações</label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "REGISTRAR CARGA"}
        </Button>
      </div>
    </DialogContent>
  );
}
