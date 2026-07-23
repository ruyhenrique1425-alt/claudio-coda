import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Camera, Save, Plus, Phone, MessageCircle, FileText, Loader2, QrCode, MapPin, CheckCircle2, AlertTriangle, ExternalLink, Copy } from "lucide-react";
import contratoAsset from "@/assets/comodato_2026.pdf.asset.json";

export const Route = createFileRoute("/app/manutencao/$barId")({
  component: ManutencaoDetail,
});

const DISPEL_PHONE = "31999159662";
const DISPEL_PHONE_LABEL = "(31) 99915-9662";

const BRANDS = [
  { v: "heineken", l: "Heineken" },
  { v: "amstel", l: "Amstel" },
];

const INSTALL_TYPES = [
  { v: "camarote", l: "Camarote" },
  { v: "stand", l: "Stand" },
  { v: "haras", l: "Haras" },
];

async function uploadPhoto(barId: string, kind: string, file: File): Promise<string | null> {
  const path = `${barId}/${kind}/${Date.now()}_${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage.from("operacao-fotos").upload(path, file, { upsert: false });
  if (error) {
    toast.error("Erro upload: " + error.message);
    return null;
  }
  return path;
}

async function getSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("operacao-fotos").createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

function ManutencaoDetail() {
  const { barId } = Route.useParams();
  const { user } = useSession();
  const [bar, setBar] = useState<any>(null);
  const [inst, setInst] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: b }, { data: i }, { data: l }] = await Promise.all([
      supabase.from("bars").select("*").eq("id", barId).maybeSingle(),
      supabase.from("bar_installations").select("*").eq("bar_id", barId).maybeSingle(),
      supabase.from("bar_maintenance_logs").select("*").eq("bar_id", barId).order("performed_at", { ascending: false }),
    ]);
    setBar(b);
    setInst(i);
    setLogs(l ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [barId]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!bar) return <div className="p-8 text-center">Bar não encontrado</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-16">
      <Link to="/app/manutencao" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="w-3 h-3" /> Voltar
      </Link>
      <div className="flex items-center gap-2 mb-4">
        <h1 className="font-display text-xl tracking-wider">{bar.name}</h1>
        <Badge variant="outline" className="text-[10px]">{bar.bar_type?.toUpperCase()}</Badge>
      </div>

      <Tabs defaultValue="manutencao">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="manutencao">MANUTENÇÃO</TabsTrigger>
          <TabsTrigger value="instalacao">INSTALAÇÃO</TabsTrigger>
        </TabsList>

        <TabsContent value="manutencao" className="mt-4">
          <MaintenanceTab barId={barId} logs={logs} onDone={load} userId={user?.id} />
        </TabsContent>
        <TabsContent value="instalacao" className="mt-4">
          <InstallationTab bar={bar} inst={inst} onDone={load} userId={user?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- MAINTENANCE ---------------- */

function MaintenanceTab({ barId, logs, onDone, userId }: any) {
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const entries: [string, string][] = [];
      for (const l of logs) {
        if (l.photo_url) {
          const u = await getSignedUrl(l.photo_url);
          if (u) entries.push([l.id, u]);
        }
      }
      setUrls(Object.fromEntries(entries));
    })();
  }, [logs]);

  async function submit() {
    if (!desc.trim()) return toast.error("Descreva o que aconteceu");
    if (!userId) return;
    setSaving(true);
    try {
      let photo: string | null = null;
      if (file) {
        photo = await uploadPhoto(barId, "manutencao", file);
        if (!photo) return;
      }
      const { error } = await supabase.from("bar_maintenance_logs").insert({
        bar_id: barId,
        description: desc.trim(),
        photo_url: photo,
        performed_by: userId,
      });
      if (error) return toast.error(error.message);
      toast.success("Manutenção registrada");
      setDesc(""); setFile(null);
      onDone();
    } catch (err: any) {
      toast.error("Falha ao registrar manutenção", { description: err?.message ?? "Verifique a conexão" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PublicRequestsPanel barId={barId} userId={userId} />
      <Card className="p-4 space-y-3">
        <div className="font-display tracking-wider text-sm">REGISTRAR OCORRÊNCIA</div>
        <div>
          <Label>O que aconteceu?</Label>
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Descreva o problema, peça trocada, ajuste feito…" />
        </div>
        <div>
          <Label>Foto (opcional)</Label>
          <Input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button onClick={submit} disabled={saving} className="w-full">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Registrar</>}
        </Button>
      </Card>

      <div>
        <div className="font-display tracking-wider text-sm mb-2 text-muted-foreground">HISTÓRICO</div>
        {logs.length === 0 && <Card className="p-4 text-sm text-muted-foreground text-center">Nenhuma manutenção registrada.</Card>}
        <div className="space-y-2">
          {logs.map((l: any) => (
            <Card key={l.id} className="p-3">
              <div className="flex items-start gap-3">
                {urls[l.id] && (
                  <a href={urls[l.id]} target="_blank" rel="noreferrer">
                    <img src={urls[l.id]} className="w-16 h-16 object-cover rounded" />
                  </a>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{l.description}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {new Date(l.performed_at).toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- INSTALLATION ---------------- */

function InstallationTab({ bar, inst, onDone, userId }: any) {
  const { user } = useSession();
  const [localName, setLocalName] = useState<string>(bar?.name ?? "");
  const [barType, setBarType] = useState<string>(bar?.bar_type ?? "camarote");
  const [lat, setLat] = useState<string>(bar?.latitude != null ? String(bar.latitude) : "");
  const [lng, setLng] = useState<string>(bar?.longitude != null ? String(bar.longitude) : "");
  const [brand, setBrand] = useState<string>(inst?.brand ?? "heineken");
  const [bicos, setBicos] = useState<number>(inst?.bicos ?? 1);
  const [manometro, setManometro] = useState<number>(inst?.manometro_qtd ?? 0);
  const [cilindro, setCilindro] = useState<number>(inst?.cilindro_qtd ?? 0);
  const [respNome, setRespNome] = useState<string>(inst?.responsavel_nome ?? "");
  const [respTel, setRespTel] = useState<string>(inst?.responsavel_telefone ?? "");
  const [valores, setValores] = useState<string>(inst?.valores ?? "");
  const [informacoes, setInformacoes] = useState<string>(inst?.informacoes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [gettingLoc, setGettingLoc] = useState(false);
  const [contratoUrl, setContratoUrl] = useState<string | null>(null);

  useEffect(() => {
    setLocalName(bar?.name ?? "");
    setBarType(bar?.bar_type ?? "camarote");
    setLat(bar?.latitude != null ? String(bar.latitude) : "");
    setLng(bar?.longitude != null ? String(bar.longitude) : "");
  }, [bar?.id, bar?.name, bar?.bar_type, bar?.latitude, bar?.longitude]);

  useEffect(() => {
    setBrand(inst?.brand ?? "heineken");
    setBicos(inst?.bicos ?? 1);
    setManometro(inst?.manometro_qtd ?? 0);
    setCilindro(inst?.cilindro_qtd ?? 0);
    setRespNome(inst?.responsavel_nome ?? "");
    setRespTel(inst?.responsavel_telefone ?? "");
    setValores(inst?.valores ?? "");
    setInformacoes(inst?.informacoes ?? "");
    setFile(null);
  }, [inst?.id, inst?.updated_at]);

  useEffect(() => {
    if (inst?.contrato_photo_url) getSignedUrl(inst.contrato_photo_url).then(setContratoUrl);
    else setContratoUrl(null);
  }, [inst?.contrato_photo_url]);

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
      (err) => {
        setGettingLoc(false);
        toast.error("Erro localização: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function save() {
    if (!userId) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }
    setSaving(true);
    try {
      const latNumber = Number(lat);
      const lngNumber = Number(lng);
      const hasCoords = Number.isFinite(latNumber) && Number.isFinite(lngNumber);

      const { error: barError } = await supabase
        .from("bars")
        .update({
          name: localName.trim() || bar.name,
          bar_type: barType as any,
          ...(hasCoords ? { latitude: latNumber, longitude: lngNumber } : {}),
        })
        .eq("id", bar.id);
      if (barError) {
        console.error("[update installation bar]", barError);
        toast.error("Erro ao atualizar local: " + barError.message);
        return;
      }

      let contrato = inst?.contrato_photo_url ?? null;
      const payload: any = {
        bar_id: bar.id,
        brand,
        bicos,
        manometro_qtd: manometro,
        cilindro_qtd: cilindro,
        responsavel_nome: respNome || null,
        responsavel_telefone: respTel || null,
        valores: valores || null,
        informacoes: informacoes || null,
        contrato_photo_url: contrato,
        updated_by: userId,
      };
      const { error } = await supabase.from("bar_installations").upsert(payload, { onConflict: "bar_id" });
      if (error) {
        console.error("[save installation]", error);
        toast.error("Erro ao salvar: " + error.message);
        return;
      }
      if (file) {
        const p = await uploadPhoto(bar.id, "contrato", file);
        if (p) {
          contrato = p;
          const { error: contractError } = await supabase
            .from("bar_installations")
            .update({ contrato_photo_url: contrato, updated_by: userId })
            .eq("bar_id", bar.id);
          if (contractError) toast.warning("Informações salvas, mas o contrato não foi vinculado: " + contractError.message);
        } else {
          toast.warning("Informações salvas, mas o contrato não foi enviado.");
        }
      }
      toast.success(inst?.id ? "Instalação atualizada" : "Instalação salva");
      setFile(null);
      onDone();
    } catch (e: any) {
      console.error("[save installation] exception", e);
      toast.error("Erro inesperado: " + (e?.message ?? "verifique conexão"));
    } finally {
      setSaving(false);
    }
  }

  function callResp() {
    if (!respTel) return toast.error("Sem telefone cadastrado");
    window.location.href = `tel:${respTel.replace(/\D/g, "")}`;
  }

  async function sendWhatsApp() {
    if (!respTel) return toast.error("Cadastre o telefone do responsável");
    const clean = respTel.replace(/\D/g, "");
    const withCountry = clean.startsWith("55") ? clean : "55" + clean;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const meta = (user?.user_metadata ?? {}) as Record<string, any>;
    const rawName =
      meta.full_name || meta.name || meta.display_name ||
      (user?.email ? user.email.split("@")[0].replace(/[._-]+/g, " ") : "");
    const installerName = rawName
      ? rawName.replace(/\b\w/g, (c: string) => c.toUpperCase())
      : "equipe DISPEL";

    // Link do contrato: prioriza a foto/PDF do comodato anexado; se não houver, usa a minuta modelo.
    let contratoLink = `${origin}${contratoAsset.url}`;
    let contratoLabel = "📄 *Contrato (minuta modelo):* ";
    if (inst?.contrato_photo_url) {
      const { data } = await supabase.storage
        .from("operacao-fotos")
        .createSignedUrl(inst.contrato_photo_url, 60 * 60 * 24 * 365);
      if (data?.signedUrl) {
        contratoLink = data.signedUrl;
        contratoLabel = "📄 *Contrato assinado:* ";
      }
    } else {
      toast.warning("Nenhum comodato anexado — enviando a minuta modelo.");
    }

    const lines = [
      `Olá, ${respNome || ""}! Tudo bem?`,
      "",
      `Meu nome é ${installerName} e faço parte da equipe DISPEL. Serei um dos responsáveis pelo acompanhamento da sua choppeira, garantindo que ela esteja sempre operando com o máximo desempenho. É um prazer atender você!`,
      "",
      `Segue abaixo o contrato de comodato e as principais informações do seu equipamento — *${bar.name}*.`,
      "",
      contratoLabel + contratoLink,
      "",
      "*Equipamento instalado:*",
      `• Marca: ${brand === "heineken" ? "Heineken" : "Amstel"}`,
      `• ${bicos} bico${Number(bicos) === 1 ? "" : "s"}`,
      `• ${manometro} manômetro${Number(manometro) === 1 ? "" : "s"}`,
      `• ${cilindro} cilindro${Number(cilindro) === 1 ? "" : "s"}`,
      "",
      valores ? `💰 *Valores:*\n${valores}\n` : "",
      informacoes ? `ℹ️ *Informações:*\n${informacoes}\n` : "",
      "🛠️ *Precisou de manutenção?*",
      "Basta escanear o QR Code fixado ao lado da choppeira e nossa equipe técnica será acionada para atender você com rapidez.",
      "",
      "🍺 *Pedidos de bebida:*",
      "(31) 99809-5282 – All Star",
      "",
      `📞 *Suporte e dúvidas:* ${DISPEL_PHONE_LABEL}`,
      "",
      "✨ *A excelência não termina na entrega.* Nossa equipe técnica está pronta para manter sua operação sempre no mais alto nível.",
    ].filter(Boolean).join("\n");
    const url = `https://wa.me/${withCountry}?text=${encodeURIComponent(lines)}`;
    window.open(url, "_blank");
  }

  return (
    <div className="space-y-4">
      <QrCard barId={bar.id} barName={bar.name} />
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="font-display tracking-wider text-sm">EDITAR LOCAL</div>
          {inst?.id && <Badge className="bg-primary text-primary-foreground text-[10px]">INSTALADO</Badge>}
        </div>
        <div>
          <Label>Nome do local</Label>
          <Input value={localName} onChange={(e) => setLocalName(e.target.value)} placeholder="Nome do camarote, stand ou haras" />
        </div>
        <div>
          <Label>Tipo</Label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {INSTALL_TYPES.map((t) => (
              <button
                key={t.v}
                type="button"
                onClick={() => setBarType(t.v)}
                className={`px-2 py-2 rounded border text-xs uppercase ${barType === t.v ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
              >
                {t.l}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Latitude</Label>
            <Input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" placeholder="—" />
          </div>
          <div>
            <Label>Longitude</Label>
            <Input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" placeholder="—" />
          </div>
        </div>
        <Button type="button" variant="outline" onClick={captureLocation} disabled={gettingLoc} className="w-full">
          {gettingLoc ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MapPin className="w-4 h-4 mr-2" />}
          Atualizar localização atual
        </Button>
      </Card>
      <Card className="p-4 space-y-3">
        <div className="font-display tracking-wider text-sm">CHOPPEIRA</div>
        <div>
          <Label>Marca</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {BRANDS.map((b) => (
              <button
                key={b.v}
                type="button"
                onClick={() => setBrand(b.v)}
                className={`px-3 py-2 rounded border text-sm ${brand === b.v ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
              >
                {b.l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Bicos</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {[1, 2].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setBicos(n)}
                className={`px-3 py-2 rounded border text-sm ${bicos === n ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
              >
                {n} {n === 1 ? "bico" : "bicos"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Manômetros</Label>
            <Input type="number" min={0} inputMode="numeric" placeholder="0" value={manometro === 0 ? "" : String(manometro)} onChange={(e) => setManometro(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Cilindros</Label>
            <Input type="number" min={0} inputMode="numeric" placeholder="0" value={cilindro === 0 ? "" : String(cilindro)} onChange={(e) => setCilindro(Number(e.target.value) || 0)} />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-display tracking-wider text-sm">RESPONSÁVEL</div>
        <div>
          <Label>Nome</Label>
          <Input value={respNome} onChange={(e) => setRespNome(e.target.value)} placeholder="Nome do responsável" />
        </div>
        <div>
          <Label>Telefone</Label>
          <Input value={respTel} onChange={(e) => setRespTel(e.target.value)} placeholder="(31) 99999-9999" inputMode="tel" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={callResp}><Phone className="w-4 h-4 mr-2" /> Ligar</Button>
          <Button type="button" onClick={sendWhatsApp} className="bg-[#25D366] hover:bg-[#1fb655] text-white">
            <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
          </Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-display tracking-wider text-sm">CONTRATO & INFORMAÇÕES</div>
        <div>
          <Label>Foto do contrato assinado</Label>
          <Input type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {contratoUrl && (
            <a href={contratoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent mt-2">
              <FileText className="w-3 h-3" /> Ver contrato salvo
            </a>
          )}
        </div>
        <div>
          <Label>Valores</Label>
          <Textarea rows={2} value={valores} onChange={(e) => setValores(e.target.value)} placeholder="Valores acordados, aluguel, consumo mínimo…" />
        </div>
        <div>
          <Label>Informações relevantes</Label>
          <Textarea rows={3} value={informacoes} onChange={(e) => setInformacoes(e.target.value)} placeholder="Observações, condições, horários, etc." />
        </div>
        <div className="text-[11px] text-muted-foreground border-t border-border pt-2">
          Contato Dispel para manutenção: <span className="text-accent">{DISPEL_PHONE_LABEL}</span>
        </div>
      </Card>


      <Button onClick={save} disabled={saving} className="w-full" size="lg">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> {inst?.id ? "Atualizar instalação" : "Salvar instalação"}</>}
      </Button>
    </div>
  );
}

/* ---------------- QR Code card ---------------- */

function QrCard({ barId, barName }: { barId: string; barName: string }) {
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
  useEffect(() => { loadLinked(); /* eslint-disable-next-line */ }, [barId]);

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
    <Card className="p-4 space-y-3 border-accent/40">
      <div className="flex items-center gap-2">
        <QrCode className="w-4 h-4 text-accent" />
        <div className="font-display tracking-wider text-sm">QR CODE DA CHOPPEIRA</div>
      </div>

      <div className="rounded border border-border p-3 bg-muted/30 space-y-2">
        <div className="text-[11px] font-medium">Vincular código QR impresso (DSP-XXXX)</div>
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
        <p className="text-[10px] text-muted-foreground">
          {primaryCode
            ? `Etiqueta física ${primaryCode} ativa neste ponto.`
            : "Sem etiqueta física vinculada. Digite o código impresso na etiqueta (ex: DSP-0001) e toque em Vincular."}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <img src={qrSrc} alt={`QR ${barName}`} className="w-40 h-40 border border-border rounded bg-white p-1" />
        <div className="flex-1 space-y-2 w-full">
          <div className="text-[11px] text-muted-foreground break-all font-mono">{url}</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}>
              <Copy className="w-3 h-3 mr-1" /> Copiar
            </Button>
            <Button size="sm" variant="outline" className="flex-1" asChild>
              <a href={qrSrc} download={`qr-${barName.replace(/\s+/g, "-")}.png`}>
                <QrCode className="w-3 h-3 mr-1" /> Baixar
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3" /></a>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- Public QR requests panel ---------------- */

function PublicRequestsPanel({ barId, userId }: { barId: string; userId?: string }) {
  const [reqs, setReqs] = useState<any[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("public_maintenance_requests")
      .select("*")
      .eq("bar_id", barId)
      .order("created_at", { ascending: false });
    setReqs(data ?? []);
    const entries: [string, string][] = [];
    for (const r of data ?? []) {
      if (r.photo_path) {
        const u = await getSignedUrl(r.photo_path);
        if (u) entries.push([r.id, u]);
      }
    }
    setUrls(Object.fromEntries(entries));
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [barId]);

  async function completar(id: string) {
    if (!userId) return toast.error("Faça login");
    const { error } = await supabase.from("public_maintenance_requests").update({
      status: "concluida",
      completed_at: new Date().toISOString(),
      completed_by: userId,
      completed_notes: notes.trim() || null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Manutenção concluída");
    setCompletingId(null);
    setNotes("");
    load();
  }

  const pendentes = reqs.filter((r) => r.status === "pendente");
  const concluidas = reqs.filter((r) => r.status === "concluida");

  return (
    <Card className={`p-4 space-y-3 ${pendentes.length > 0 ? "border-destructive" : "border-border"}`}>
      <div className="flex items-center gap-2">
        {pendentes.length > 0 ? (
          <AlertTriangle className="w-4 h-4 text-destructive" />
        ) : (
          <QrCode className="w-4 h-4 text-muted-foreground" />
        )}
        <div className="font-display tracking-wider text-sm">
          PEDIDOS DO QR CODE
        </div>
        {pendentes.length > 0 && (
          <Badge variant="destructive" className="ml-auto">{pendentes.length} pendente{pendentes.length !== 1 ? "s" : ""}</Badge>
        )}
      </div>

      {loading && <div className="text-xs text-muted-foreground">Carregando…</div>}

      {!loading && reqs.length === 0 && (
        <div className="text-xs text-muted-foreground">Nenhum pedido recebido ainda pelo QR Code.</div>
      )}

      {pendentes.map((r) => (
        <div key={r.id} className="border border-destructive/40 rounded p-3 bg-destructive/5 space-y-2">
          <div className="flex items-start gap-3">
            {urls[r.id] && (
              <a href={urls[r.id]} target="_blank" rel="noreferrer">
                <img src={urls[r.id]} className="w-16 h-16 rounded object-cover" />
              </a>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="destructive" className="text-[9px]">PENDENTE</Badge>
                {r.requester_name && <span className="text-[11px] font-medium">{r.requester_name}</span>}
                <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
              </div>
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
                <Button size="sm" className="flex-1" onClick={() => completar(r.id)}>
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmar conclusão
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setCompletingId(r.id)}>
              <CheckCircle2 className="w-3 h-3 mr-1" /> Marcar como concluída
            </Button>
          )}
        </div>
      ))}

      {concluidas.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Histórico concluído ({concluidas.length})</summary>
          <div className="mt-2 space-y-2">
            {concluidas.map((r) => (
              <div key={r.id} className="border border-border rounded p-2 flex gap-2">
                {urls[r.id] && <img src={urls[r.id]} className="w-10 h-10 rounded object-cover" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary text-primary-foreground text-[9px]">CONCLUÍDA</Badge>
                    <span className="text-[10px] text-muted-foreground">{r.completed_at ? new Date(r.completed_at).toLocaleString("pt-BR") : ""}</span>
                  </div>
                  <div className="text-[12px]">{r.description}</div>
                  {r.completed_notes && <div className="text-[11px] italic text-muted-foreground">→ {r.completed_notes}</div>}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </Card>
  );
}
