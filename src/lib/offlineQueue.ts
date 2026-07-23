import localforage from "localforage";

const store = localforage.createInstance({
  name: "dispel-operacao",
  storeName: "offline-queue",
  description: "Fila offline para inventário, reposição e recolhimento de vazios",
});

export type OfflineOpType =
  | "inventory.submit"
  | "refill.submit"
  | "empties.remove"
  | "temperature.submit"
  | "organization.submit"
  | "carga.submit";

export type OfflineOp = {
  id: string; // uuid v4 (also used as client_op_id)
  type: OfflineOpType;
  payload: any;
  attempts: number;
  createdAt: number;
  lastError?: string;
};

function uuidv4(): string {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  // fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function enqueue(type: OfflineOpType, payload: any): Promise<OfflineOp> {
  const op: OfflineOp = {
    id: uuidv4(),
    type,
    payload,
    attempts: 0,
    createdAt: Date.now(),
  };
  await store.setItem(op.id, op);
  window.dispatchEvent(new CustomEvent("offline-queue:changed"));
  return op;
}

export async function list(): Promise<OfflineOp[]> {
  const items: OfflineOp[] = [];
  await store.iterate<OfflineOp, void>((v) => {
    items.push(v);
  });
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function count(): Promise<number> {
  return store.length();
}

export async function remove(id: string) {
  await store.removeItem(id);
  window.dispatchEvent(new CustomEvent("offline-queue:changed"));
}

export async function update(op: OfflineOp) {
  await store.setItem(op.id, op);
  window.dispatchEvent(new CustomEvent("offline-queue:changed"));
}

export async function clearAll() {
  await store.clear();
  window.dispatchEvent(new CustomEvent("offline-queue:changed"));
}
