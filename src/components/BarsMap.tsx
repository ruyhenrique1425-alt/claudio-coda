import { useEffect, useRef, useState } from "react";

type Bar = {
  id: string;
  name: string;
  bar_type: "camarote" | "stand" | "haras" | "bar_venda" | "bar_parceiro";

  latitude: number;
  longitude: number;
};

const TYPE_COLORS: Record<Bar["bar_type"], string> = {
  bar_venda: "#1B6E3A",
  bar_parceiro: "#8B5CF6",
  camarote: "#F4B942",
  stand: "#3B82F6",
  haras: "#EF4444",
};

declare global {
  interface Window { google?: any; __initDispelMap?: () => void; gm_authFailure?: () => void; }
}

let mapsLoadPromise: Promise<void> | null = null;
function hasGoogleMaps() {
  return !!window.google?.maps?.Map && !!window.google?.maps?.Marker;
}

function loadGoogleMaps(key: string, channel?: string) {
  if (mapsLoadPromise) return mapsLoadPromise;
  if (typeof window !== "undefined" && hasGoogleMaps()) return Promise.resolve();
  mapsLoadPromise = new Promise<void>((resolve, reject) => {
    const previousAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      previousAuthFailure?.();
      mapsLoadPromise = null;
      reject(new Error("Mapa indisponível neste aparelho. Use a localização atual ou preencha as coordenadas manualmente."));
    };
    window.__initDispelMap = () => {
      const startedAt = Date.now();
      const waitForMaps = () => {
        if (hasGoogleMaps()) {
          resolve();
          return;
        }
        if (Date.now() - startedAt > 5000) {
          mapsLoadPromise = null;
          reject(new Error("Google Maps não terminou de carregar neste aparelho"));
          return;
        }
        window.setTimeout(waitForMaps, 100);
      };
      waitForMaps();
    };
    const s = document.createElement("script");
    const url = new URL("https://maps.googleapis.com/maps/api/js");
    url.searchParams.set("key", key);
    url.searchParams.set("loading", "async");
    url.searchParams.set("callback", "__initDispelMap");
    if (channel) url.searchParams.set("channel", channel);
    s.src = url.toString();
    s.async = true;
    s.onerror = () => {
      mapsLoadPromise = null;
      reject(new Error("Falha ao carregar Google Maps"));
    };
    document.head.appendChild(s);
  });
  return mapsLoadPromise;
}

export function BarsMap({
  bars,
  onSelectBar,
  onMapClick,
  pickedPoint,
}: {
  bars: Bar[];
  onSelectBar?: (id: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  pickedPoint?: { lat: number; lng: number } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const pickedMarkerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const userAccuracyRef = useRef<any>(null);
  const centeredOnUserRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
    if (!key) { setError("Google Maps não configurado."); return; }
    loadGoogleMaps(key, channel)
      .then(() => {
        if (!ref.current || mapRef.current) return;
        const g = window.google?.maps;
        if (!g?.Map) {
          setError("Mapa indisponível neste aparelho. Preencha as coordenadas manualmente.");
          return;
        }
        const center = bars[0]
          ? { lat: bars[0].latitude, lng: bars[0].longitude }
          : { lat: -23.5505, lng: -46.6333 };
        mapRef.current = new g.Map(ref.current, {
          center,
          zoom: bars.length ? 15 : 12,
          disableDefaultUI: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          styles: DARK_MAP_STYLE,
        });
        if (onMapClick) {
          mapRef.current.addListener("click", (e: any) => {
            onMapClick(e.latLng.lat(), e.latLng.lng());
          });
        }
        window.setTimeout(() => {
          const text = ref.current?.innerText ?? "";
          if (text.includes("This page didn't load Google Maps correctly")) {
            setError("Mapa indisponível neste aparelho. Use a localização atual ou preencha as coordenadas manualmente.");
          }
        }, 1200);
        startWatchingUser();
      })
      .catch((e) => setError(e.message));
    return () => {
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const watchIdRef = useRef<number | null>(null);
  function startWatchingUser() {
    if (!navigator.geolocation) return;
    const onPos = (pos: GeolocationPosition) => {
      const g = window.google?.maps;
      if (!mapRef.current || !g?.Marker || !g?.Circle || !g?.SymbolPath) return;
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!userMarkerRef.current) {
        userMarkerRef.current = new g.Marker({
          position: p,
          map: mapRef.current,
          title: "Você está aqui",
          zIndex: 999,
          icon: {
            path: g.SymbolPath.CIRCLE,
            fillColor: "#3B82F6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
            scale: 8,
          },
        });
        userAccuracyRef.current = new g.Circle({
          map: mapRef.current,
          center: p,
          radius: pos.coords.accuracy ?? 50,
          fillColor: "#3B82F6",
          fillOpacity: 0.12,
          strokeColor: "#3B82F6",
          strokeOpacity: 0.4,
          strokeWeight: 1,
        });
      } else {
        userMarkerRef.current.setPosition(p);
        userAccuracyRef.current?.setCenter(p);
        userAccuracyRef.current?.setRadius(pos.coords.accuracy ?? 50);
      }
      if (!centeredOnUserRef.current && bars.length === 0) {
        mapRef.current.setCenter(p);
        mapRef.current.setZoom(16);
        centeredOnUserRef.current = true;
      }
    };
    navigator.geolocation.getCurrentPosition(onPos, () => {}, { enableHighAccuracy: true, timeout: 8000 });
    watchIdRef.current = navigator.geolocation.watchPosition(onPos, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 5000,
    });
  }

  useEffect(() => {
    const g = window.google?.maps;
    if (!mapRef.current || !g?.Marker || !g?.SymbolPath) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = bars.map((b) => {
      const m = new g.Marker({
        position: { lat: b.latitude, lng: b.longitude },
        map: mapRef.current,
        title: b.name,
        icon: {
          path: g.SymbolPath.CIRCLE,
          fillColor: TYPE_COLORS[b.bar_type],
          fillOpacity: 1,
          strokeColor: "#0b0b0b",
          strokeWeight: 2,
          scale: 10,
        },
      });
      m.addListener("click", () => onSelectBar?.(b.id));
      return m;
    });
  }, [bars, onSelectBar]);

  useEffect(() => {
    const g = window.google?.maps;
    if (!mapRef.current || !g?.Marker || !g?.SymbolPath) return;
    if (pickedMarkerRef.current) { pickedMarkerRef.current.setMap(null); pickedMarkerRef.current = null; }
    if (pickedPoint) {
      pickedMarkerRef.current = new g.Marker({
        position: pickedPoint,
        map: mapRef.current,
        icon: {
          path: g.SymbolPath.BACKWARD_CLOSED_ARROW,
          fillColor: "#F4B942",
          fillOpacity: 1,
          strokeColor: "#0b0b0b",
          strokeWeight: 2,
          scale: 6,
        },
      });
      mapRef.current.panTo(pickedPoint);
    }
  }, [pickedPoint]);

  if (error) return <div className="p-4 text-destructive">{error}</div>;
  return <div ref={ref} className="w-full h-full min-h-[400px] rounded-lg overflow-hidden border border-border" />;
}

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1d2926" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1d2926" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#a3b3ab" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a3733" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#c9d3ce" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1a17" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];
