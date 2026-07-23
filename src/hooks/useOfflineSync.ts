import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { list, remove, update, count, type OfflineOp } from "@/lib/offlineQueue";
import { toast } from "sonner";

const MAX_ATTEMPTS = 5;

function base64ToBlob(base64: string, contentType = "image/jpeg"): Blob {
  const raw = base64.includes(",") ? base64.split(",").pop()! : base64;
  const byteChars = atob(raw);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

async function uploadPhoto(barId: string, kind: string, photoBase64: string): Promise<string> {
  const blob = base64ToBlob(photoBase64);
  const path = `${barId}/${kind}/${Date.now()}_offline.jpg`;
  const { error } = await supabase.storage
    .from("operacao-fotos")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

async function processInventory(op: OfflineOp) {
  const { barId, userId, itemsLong, photoBase64, notes } = op.payload;

  const { data: existing } = await (supabase as any)
    .from("inventories")
    .select("id")
    .eq("client_op_id", op.id)
    .maybeSingle();
  if (existing) return;

  const photo = await uploadPhoto(barId, "inventario", photoBase64);

  const { data: inv, error } = await (supabase as any)
    .from("inventories")
    .insert({
      bar_id: barId,
      performed_by: userId,
      photo_url: photo,
      notes: notes ?? null,
      client_op_id: op.id,
    })
    .select("id")
    .single();
  if (error) throw error;

  const rows = (itemsLong as any[]).map((it) => ({ ...it, inventory_id: inv.id }));
  const { error: e2 } = await (supabase as any).from("inventory_items").insert(rows);
  if (e2) throw e2;
}

async function processRefill(op: OfflineOp) {
  const { barId, userId, items, empties, photoBase64, notes } = op.payload;

  const { data: existing } = await (supabase as any)
    .from("refills")
    .select("id")
    .eq("client_op_id", op.id)
    .maybeSingle();
  if (existing) return;

  const photo = await uploadPhoto(barId, "reposicao", photoBase64);

  const { data: rf, error } = await (supabase as any)
    .from("refills")
    .insert({
      bar_id: barId,
      performed_by: userId,
      photo_url: photo,
      notes: notes ?? null,
      client_op_id: op.id,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (items?.length) {
    const rows = items.map((it: any) => ({ ...it, refill_id: rf.id }));
    const { error: e2 } = await (supabase as any).from("refill_items").insert(rows);
    if (e2) throw e2;
  }

  if (empties?.length) {
    const rows = empties.map((e: any) => ({
      ...e,
      refill_id: rf.id,
      performed_by: userId,
      photo_url: photo,
    }));
    const { error: e3 } = await (supabase as any).from("empties_removed").insert(rows);
    if (e3) throw e3;
  }
}

async function processEmpties(op: OfflineOp) {
  const { barId, userId, rows, photoBase64, notes } = op.payload;

  const { data: existing } = await (supabase as any)
    .from("empties_removed")
    .select("id")
    .eq("client_op_id", op.id)
    .maybeSingle();
  if (existing) return;

  const photo = await uploadPhoto(barId, "vazios", photoBase64);

  const finalRows = (rows as any[]).map((r, i) => ({
    ...r,
    bar_id: barId,
    performed_by: userId,
    photo_url: photo,
    notes: notes ?? null,
    // stamp client_op_id on first row only to avoid unique-index collision
    client_op_id: i === 0 ? op.id : null,
  }));

  const { error } = await (supabase as any).from("empties_removed").insert(finalRows);
  if (error) throw error;
}

async function processTemperature(op: OfflineOp) {
  const { barId, userId, slot, temperatura, photoBase64 } = op.payload;
  const { data: existing } = await (supabase as any)
    .from("bar_temperature_checks")
    .select("id")
    .eq("client_op_id", op.id)
    .maybeSingle();
  if (existing) return;
  const photo = await uploadPhoto(barId, "temperatura", photoBase64);
  const { error } = await (supabase as any).from("bar_temperature_checks").insert({
    bar_id: barId,
    slot,
    temperatura,
    photo_url: photo,
    performed_by: userId,
    client_op_id: op.id,
  });
  if (error) throw error;
}

async function processOrganization(op: OfflineOp) {
  const { barId, userId, state } = op.payload;
  const { data: existing } = await (supabase as any)
    .from("bar_organization_checks")
    .select("id")
    .eq("client_op_id", op.id)
    .maybeSingle();
  if (existing) return;
  const { error } = await (supabase as any).from("bar_organization_checks").insert({
    bar_id: barId,
    ...state,
    performed_by: userId,
    client_op_id: op.id,
  });
  if (error) throw error;
}

async function processCarga(op: OfflineOp) {
  const {
    userId,
    received_at,
    heineken_barris,
    amstel_barris,
    barris_comodato,
    vasilhames_recolhidos,
    invoice_number,
    notes,
    photoBase64,
  } = op.payload;
  const { data: existing } = await (supabase as any)
    .from("heineken_cargas")
    .select("id")
    .eq("client_op_id", op.id)
    .maybeSingle();
  if (existing) return;
  const path = `cargas/${Date.now()}_offline.jpg`;
  const blob = base64ToBlob(photoBase64);
  const up = await supabase.storage
    .from("operacao-fotos")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (up.error) throw up.error;
  const { data: signed } = await supabase.storage
    .from("operacao-fotos")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  const { error } = await (supabase as any).from("heineken_cargas").insert({
    received_at,
    heineken_barris,
    amstel_barris,
    barris_comodato,
    vasilhames_recolhidos,
    invoice_number: invoice_number ?? null,
    invoice_photo_url: signed?.signedUrl ?? null,
    notes: notes ?? null,
    performed_by: userId,
    client_op_id: op.id,
  });
  if (error) throw error;
}

async function processOne(op: OfflineOp) {
  switch (op.type) {
    case "inventory.submit":
      return processInventory(op);
    case "refill.submit":
      return processRefill(op);
    case "empties.remove":
      return processEmpties(op);
    case "temperature.submit":
      return processTemperature(op);
    case "organization.submit":
      return processOrganization(op);
    case "carga.submit":
      return processCarga(op);
  }
}

export function useOfflineSync() {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const runningRef = useRef(false);

  const refresh = useCallback(async () => {
    setPending(await count());
  }, []);

  const runSync = useCallback(async () => {
    if (runningRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    runningRef.current = true;
    setSyncing(true);
    try {
      const items = await list();
      let processed = 0;
      let failed = 0;
      for (const op of items) {
        if (op.attempts >= MAX_ATTEMPTS) continue;
        try {
          await processOne(op);
          await remove(op.id);
          processed++;
        } catch (e: any) {
          await update({
            ...op,
            attempts: op.attempts + 1,
            lastError: e?.message ?? "erro",
          });
          failed++;
        }
      }
      if (processed > 0) toast.success(`${processed} operação(ões) sincronizada(s)`);
      if (failed > 0) toast.error(`${failed} operação(ões) com erro — nova tentativa em 30s`);
    } finally {
      runningRef.current = false;
      setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    const onOnline = () => runSync();
    window.addEventListener("offline-queue:changed", onChange);
    window.addEventListener("online", onOnline);
    const interval = setInterval(() => {
      if (navigator.onLine) runSync();
    }, 30000);
    if (navigator.onLine) runSync();
    return () => {
      window.removeEventListener("offline-queue:changed", onChange);
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
    };
  }, [refresh, runSync]);

  return { pending, syncing, runSync };
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(file);
  });
}
