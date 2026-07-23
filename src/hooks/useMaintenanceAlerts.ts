import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const LS_KEY = "dispel:manutencao:lastSeen";

function playBeep() {
  try {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const tones = [880, 1175, 880];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {}
}

export type MaintenanceAlertPayload = {
  id: string;
  description: string | null;
  bar_id: string | null;
  requester_name: string | null;
  created_at: string;
};


export function useMaintenanceAlerts(enabled: boolean) {
  const [unread, setUnread] = useState(0);
  const [latestAlert, setLatestAlert] = useState<MaintenanceAlertPayload | null>(null);
  const lastSeenRef = useRef<string>(
    typeof window !== "undefined" ? localStorage.getItem(LS_KEY) || new Date(0).toISOString() : new Date(0).toISOString()
  );

  // Initial unread count based on lastSeen
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("public_maintenance_requests")
        .select("id", { count: "exact", head: true })
        .gt("created_at", lastSeenRef.current);
      if (!cancelled && typeof count === "number") setUnread(count);
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  // Realtime subscription
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`maintenance-alerts-${Math.random().toString(36).slice(2)}`)

      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "public_maintenance_requests" },
        (payload) => {
          const row: any = payload.new;
          setUnread((n) => n + 1);
          setLatestAlert({
            id: row?.id,
            description: row?.description ?? null,
            bar_id: row?.bar_id ?? null,
            requester_name: row?.requester_name ?? null,
            created_at: row?.created_at ?? new Date().toISOString(),
          });

          playBeep();
          toast.warning("🔧 Nova solicitação de manutenção", {
            description: row?.description
              ? String(row.description).slice(0, 120)
              : "Verifique o painel de MANUTENÇÃO",
            duration: 10000,
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled]);

  const clear = useCallback(() => {
    const now = new Date().toISOString();
    lastSeenRef.current = now;
    try { localStorage.setItem(LS_KEY, now); } catch {}
    setUnread(0);
  }, []);

  const dismissAlert = useCallback(() => setLatestAlert(null), []);

  return { unread, clear, latestAlert, dismissAlert };
}

