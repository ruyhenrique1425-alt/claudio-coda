import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { BarsMap } from "@/components/BarsMap";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/app/bars/new")({
  component: NewBarPage,
});

const TYPES = [
  { v: "bar_venda", l: "Bar venda" },
  { v: "bar_parceiro", l: "Bar parceiro (fichas)" },
  { v: "camarote", l: "Camarote" },
  { v: "stand", l: "Stand" },
  { v: "haras", l: "Haras" },
];

function NewBarPage() {
  const nav = useNavigate();
  const { user, loading: loadingSession } = useSession();
  const perms = usePermissions(user?.id);
  const canManage = perms.isGestor || perms.isManutencao;
  const loadingRole = perms.loading;

  const [name, setName] = useState("");
  const [barType, setBarType] = useState("bar_venda");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [apoio, setApoio] = useState("");
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locationBlocked, setLocationBlocked] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const autoTried = useRef(false);

  function captureLocation(silent = false) {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationBlocked(true);
      if (!silent) toast.error("Geolocalização não disponível neste dispositivo");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setAccuracy(pos.coords.accuracy ?? null);
        setLocating(false);
        setLocationBlocked(false);
        if (!silent) toast.success("Localização capturada");
      },
      (err) => {
        setLocating(false);
        setLocationBlocked(true);
        if (!silent) {
          if (err.code === err.PERMISSION_DENIED) {
            toast.error("Permissão de localização negada. Habilite no navegador.");
          } else {
            toast.error("Não foi possível obter a localização");
          }
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    captureLocation(true);
  }, []);

  if (loadingSession || loadingRole || !user) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!canManage) return (
    <div className="p-6 space-y-3">
      <p className="text-sm text-destructive">Apenas gestores podem cadastrar bares.</p>
      <Button variant="outline" onClick={() => nav({ to: "/app" })}>Voltar</Button>
    </div>
  );

  const latN = parseFloat(lat);
  const lngN = parseFloat(lng);
  const validCoords = Number.isFinite(latN) && Number.isFinite(lngN);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe o nome do bar");
    if (!validCoords) return toast.error("Coordenadas inválidas");
    setSaving(true);
    const { data, error } = await supabase
      .from("bars")
      .insert({
        name: name.trim(),
        bar_type: barType as any,
        latitude: latN,
        longitude: lngN,
        apoio_responsavel: apoio.trim() || null,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Bar cadastrado");
    nav({ to: "/app" });
  }

  const previewBar =
    validCoords && name
      ? [{ id: "preview", name, bar_type: barType, latitude: latN, longitude: lngN }]
      : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card className="p-5">
        <h1 className="font-display tracking-widest text-lg mb-4">NOVO BAR</h1>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Bar Central" />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setBarType(t.v)}
                  className={`text-xs font-display tracking-wider py-2 rounded border transition ${
                    barType === t.v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:border-primary"
                  }`}
                >
                  {t.l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {locationBlocked && !validCoords && (
              <Alert className="border-accent/40 bg-accent/10">
                <AlertDescription className="text-xs">
                  Se o celular bloquear a localização, preencha latitude/longitude manualmente ou toque no mapa.
                </AlertDescription>
              </Alert>
            )}
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => captureLocation(false)}
              disabled={locating}
            >
              {locating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Obtendo localização…</>
              ) : (
                <><MapPin className="w-4 h-4 mr-2" /> Usar minha localização atual</>
              )}
            </Button>
            {validCoords && (
              <p className="text-[11px] text-muted-foreground">
                📍 {latN.toFixed(6)}, {lngN.toFixed(6)}
                {accuracy != null && <> · precisão ~{Math.round(accuracy)}m</>}
              </p>
            )}
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer">Ajustar manualmente</summary>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Latitude</Label>
                  <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-23.5" inputMode="decimal" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Longitude</Label>
                  <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-46.6" inputMode="decimal" />
                </div>
              </div>
              <p className="mt-1">Ou toque no mapa para escolher outro ponto.</p>
            </details>
          </div>
          <div className="space-y-1.5">
            <Label>Apoio responsável</Label>
            <Input value={apoio} onChange={(e) => setApoio(e.target.value)} placeholder="Nome do apoio" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Salvando…" : "Cadastrar bar"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => nav({ to: "/app" })}>
              Cancelar
            </Button>
          </div>
        </form>
      </Card>

      <div className="min-h-[260px] lg:h-[560px] rounded-lg border border-border bg-muted/30 p-4">
        {showMap ? (
          <SafeBarsMap
            bars={previewBar as any}
            onMapClick={(latitude, longitude) => {
              setLat(latitude.toFixed(6));
              setLng(longitude.toFixed(6));
              setLocationBlocked(false);
            }}
          />
        ) : (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center gap-3 text-sm text-muted-foreground">
            <MapPin className="h-8 w-8 text-primary" />
            <p>Use o botão de localização atual para cadastrar o bar mais rápido.</p>
            <Button type="button" variant="outline" onClick={() => setShowMap(true)}>
              Abrir mapa para ajustar ponto
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

class SafeBarsMap extends React.Component<
  React.ComponentProps<typeof BarsMap>,
  { crashed: boolean }
> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Falha no mapa de cadastro", error);
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="w-full h-full min-h-[400px] rounded-lg border border-border bg-muted/40 p-4 flex items-center justify-center text-center text-sm text-muted-foreground">
          O mapa não abriu neste aparelho. Use “Ajustar manualmente” para informar as coordenadas e salvar o bar.
        </div>
      );
    }
    return <BarsMap {...this.props} />;
  }
}
