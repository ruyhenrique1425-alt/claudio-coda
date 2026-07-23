import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wrench, ShoppingCart, MapPin, Camera, Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/r/$barId")({
  component: PublicPanel,
  head: () => ({
    meta: [{ title: "Atendimento Dispel" }, { name: "robots", content: "noindex" }],
  }),
});

// WhatsApp destinations
const JESSICA_WA = "5531999159662";
const JESSICA_LABEL = "Dispel · Suporte";
const ALLSTAR_WA = "553198095282";
const ALLSTAR_LABEL = "All Star · Pedidos";

function PublicPanel() {
  const { barId } = Route.useParams();
  const [bar, setBar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase
      .from("bars")
      .select("id,name,bar_type")
      .eq("id", barId)
      .maybeSingle()
      .then(({ data }) => {
        setBar(data);
        setLoading(false);
      });
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (e) => setGeoErr(e.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    }
  }, [barId]);

  async function uploadPublicPhoto(f: File): Promise<string | null> {
    const path = `public-reports/${barId}/${Date.now()}_${f.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage
      .from("operacao-fotos")
      .upload(path, f, { upsert: false });
    if (error) {
      toast.error("Erro ao enviar foto: " + error.message);
      return null;
    }
    return path;
  }

  async function submitMaintenance() {
    if (!desc.trim()) return toast.error("Descreva o que aconteceu");
    setSending(true);
    let photo: string | null = null;
    if (file) {
      photo = await uploadPublicPhoto(file);
      if (!photo) {
        setSending(false);
        return;
      }
    }
    const { error } = await supabase.from("public_maintenance_requests").insert({
      bar_id: barId,
      requester_name: nome.trim() || null,
      description: desc.trim(),
      photo_path: photo,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
    });
    if (error) {
      setSending(false);
      return toast.error(error.message);
    }
    setSent(true);
    setSending(false);

    // Build WhatsApp message for Dispel support
    const gmaps = coords ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}` : null;
    const msg =
      `Olá Dispel, preciso de manutenção da minha choppeira.\n\n` +
      `• Local: ${bar?.name ?? "—"}${bar?.bar_type ? ` (${bar.bar_type})` : ""}\n` +
      (nome ? `• Solicitante: ${nome}\n` : "") +
      `• Ocorrência: ${desc.trim()}\n` +
      (gmaps ? `• Localização: ${gmaps}\n` : "• Localização: não disponível\n") +
      `\n(mensagem gerada pelo QR Code Dispel)`;

    const url = `https://wa.me/${JESSICA_WA}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  function askProducts() {
    const msg =
      `Olá All Star, gostaria de fazer um pedido de bebidas.\n\n` +
      `• Local: ${bar?.name ?? "—"}${bar?.bar_type ? ` (${bar.bar_type})` : ""}\n` +
      (nome ? `• Solicitante: ${nome}\n` : "");
    const url = `https://wa.me/${ALLSTAR_WA}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!bar) return <div className="p-8 text-center">Choppeira não localizada.</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6 pb-24">
        <div className="text-center mb-6">
          <div className="inline-block bg-primary text-primary-foreground px-4 py-1 rounded-full text-[10px] tracking-widest font-display mb-2">
            DISPEL · ATENDIMENTO
          </div>
          <h1 className="font-display text-2xl tracking-wider">{bar.name}</h1>
          <div className="text-xs text-muted-foreground uppercase mt-1">{bar.bar_type}</div>
          <p className="mt-4 font-brand text-lg text-primary leading-snug">
            A excelência não termina na entrega.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Nossa equipe técnica está pronta para manter sua operação sempre no mais alto nível.
          </p>
        </div>

        {/* Location status */}
        <Card className="p-3 mb-4 flex items-center gap-2">
          <MapPin className={`w-4 h-4 ${coords ? "text-primary" : "text-muted-foreground"}`} />
          <div className="text-xs flex-1">
            {coords ? (
              <>
                Localização captada{" "}
                <span className="text-muted-foreground">
                  ({coords.lat.toFixed(5)}, {coords.lng.toFixed(5)})
                </span>
              </>
            ) : geoErr ? (
              <span className="text-destructive">Não foi possível obter localização: {geoErr}</span>
            ) : (
              <span className="text-muted-foreground">Obtendo localização…</span>
            )}
          </div>
        </Card>

        {sent ? (
          <Card className="p-6 border-primary text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
            <div className="font-display tracking-wider">CHAMADO ENVIADO</div>
            <p className="text-sm text-muted-foreground">
              A equipe Dispel já foi notificada no WhatsApp. Se a mensagem não abriu
              automaticamente, toque no botão abaixo.
            </p>
            <Button onClick={submitMaintenance} variant="outline" className="w-full">
              Reabrir WhatsApp
            </Button>
          </Card>
        ) : (
          <>
            <Card className="p-4 space-y-3 border-accent/40">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-accent" />
                <div className="font-display tracking-wider text-sm">PEDIR MANUTENÇÃO</div>
                <Badge variant="outline" className="text-[9px] ml-auto">
                  {JESSICA_LABEL}
                </Badge>
              </div>
              <div>
                <Label className="text-xs">Seu nome (opcional)</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
              </div>
              <div>
                <Label className="text-xs">O que aconteceu? *</Label>
                <Textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="Ex: choppeira parou, gás acabou, sem espuma, vazamento…"
                />
              </div>
              <div>
                <Label className="text-xs">Foto da máquina (opcional)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button onClick={submitMaintenance} disabled={sending} className="w-full">
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Wrench className="w-4 h-4 mr-2" />
                    Chamar manutenção (WhatsApp)
                  </>
                )}
              </Button>
            </Card>

            <div className="text-center text-[11px] text-muted-foreground my-4">— OU —</div>

            <Card className="p-4 space-y-3 border-primary/40">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-primary" />
                <div className="font-display tracking-wider text-sm">PEDIR MAIS PRODUTOS</div>
                <Badge variant="outline" className="text-[9px] ml-auto">
                  {ALLSTAR_LABEL}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Envia diretamente para o WhatsApp da All Star com a mensagem "Olá, gostaria de fazer
                um pedido de bebidas".
              </p>
              <Button
                onClick={askProducts}
                variant="outline"
                className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Pedir bebidas
              </Button>
            </Card>
          </>
        )}

        <div className="text-center text-[10px] text-muted-foreground mt-8">
          Powered by DISPEL DELIVERY
        </div>
      </div>
    </div>
  );
}
