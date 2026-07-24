import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useSession";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Package, Truck, ArrowRightLeft, Camera, History, Beer, Download } from "lucide-react";
import { downloadCsv, timestampSlug } from "@/lib/exportCsv";

export const Route = createFileRoute("/app/estoque")({ component: EstoquePage });

type Brand = "heineken" | "amstel";
type Warehouse = { id: string; code: string; name: string };
type Stock = { warehouse_id: string; brand: Brand; barrels: number };
type Movement = {
  id: string;
  warehouse_id: string;
  target_warehouse_id: string | null;
  brand: Brand;
  quantidade: number;
  direction: number;
  move_type: string;
  notes: string | null;
  photo_url: string | null;
  performed_at: string;
  bar_id: string | null;
};

export function EstoquePage() {
  const { user } = useSession();
  const perms = usePermissions(user?.id);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [moves, setMoves] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [w, s, m] = await Promise.all([
      supabase.from("warehouses").select("*").order("code"),
      supabase.from("warehouse_stock").select("*"),
      supabase
        .from("warehouse_movements")
        .select("*")
        .order("performed_at", { ascending: false })
        .limit(50),
    ]);
    setWarehouses((w.data ?? []) as Warehouse[]);
    setStock((s.data ?? []) as Stock[]);
    setMoves((m.data ?? []) as Movement[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (!perms.loading && perms.roles.length > 0 && !perms.isGestor && !perms.isManutencao)
    return <Navigate to="/app" />;

  const dispel = warehouses.find((w) => w.code === "dispel");
  const allstar = warehouses.find((w) => w.code === "allstar");
  const stockOf = (whId: string | undefined, brand: Brand) =>
    stock.find((s) => s.warehouse_id === whId && s.brand === brand)?.barrels ?? 0;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <header className="flex items-center gap-3">
        <Package className="w-6 h-6 text-primary" />
        <h1 className="font-display text-2xl tracking-widest">ESTOQUE</h1>
      </header>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-3">
              <div className="h-5 w-1/2 bg-muted animate-pulse rounded" />
              <div className="h-3 w-1/3 bg-muted/70 animate-pulse rounded" />
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="h-20 bg-muted animate-pulse rounded" />
                <div className="h-20 bg-muted animate-pulse rounded" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            <WarehouseCard
              warehouse={dispel}
              heineken={stockOf(dispel?.id, "heineken")}
              amstel={stockOf(dispel?.id, "amstel")}
              variant="primary"
              onChanged={load}
              warehouses={warehouses}
            />
            <WarehouseCard
              warehouse={allstar}
              heineken={stockOf(allstar?.id, "heineken")}
              amstel={stockOf(allstar?.id, "amstel")}
              variant="accent"
              onChanged={load}
              warehouses={warehouses}
            />
          </div>

          <section className="bg-card rounded-xl border p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4" />
              <h2 className="font-display tracking-widest text-sm">HISTÓRICO</h2>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  const rows = moves.map((m) => {
                    const wh = warehouses.find((w) => w.id === m.warehouse_id);
                    const tgt = m.target_warehouse_id
                      ? warehouses.find((w) => w.id === m.target_warehouse_id)
                      : null;
                    return {
                      data: new Date(m.performed_at).toLocaleString("pt-BR"),
                      tipo: m.move_type,
                      marca: m.brand,
                      quantidade: m.quantidade,
                      direcao: m.direction > 0 ? "entrada" : "saida",
                      armazem: wh?.name ?? "",
                      destino: tgt?.name ?? "",
                      observacoes: m.notes ?? "",
                    };
                  });
                  downloadCsv(`movimentacoes-estoque-${timestampSlug()}.csv`, rows);
                }}
              >
                <Download className="w-4 h-4 mr-1" /> CSV
              </Button>
            </div>
            <div className="divide-y">
              {moves.length === 0 && (
                <div className="text-sm text-muted-foreground py-4">
                  Nenhuma movimentação registrada.
                </div>
              )}
              {moves.map((m) => {
                const wh = warehouses.find((w) => w.id === m.warehouse_id);
                const tgt = m.target_warehouse_id
                  ? warehouses.find((w) => w.id === m.target_warehouse_id)
                  : null;
                return (
                  <div key={m.id} className="py-2 flex items-center gap-3 text-sm">
                    <div
                      className={`px-2 py-0.5 rounded text-[10px] font-display tracking-widest ${
                        m.direction > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {m.direction > 0 ? "+" : "-"}
                      {m.quantidade}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {labelType(m.move_type)} · {m.brand.toUpperCase()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {wh?.name}
                        {tgt ? ` → ${tgt.name}` : ""}
                        {m.notes ? ` · ${m.notes}` : ""}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(m.performed_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function labelType(t: string) {
  return (
    {
      entrada: "Entrada (nota)",
      transferencia: "Transferência",
      abastecimento_bar: "Abastecimento bar",
      ajuste: "Ajuste",
    }[t] ?? t
  );
}

function WarehouseCard({
  warehouse,
  heineken,
  amstel,
  variant,
  onChanged,
  warehouses,
}: {
  warehouse?: Warehouse;
  heineken: number;
  amstel: number;
  variant: "primary" | "accent";
  onChanged: () => void;
  warehouses: Warehouse[];
}) {
  const isDispel = warehouse?.code === "dispel";
  const bg =
    variant === "primary" ? "bg-gradient-brand text-white" : "bg-accent/10 border-accent/30";
  return (
    <div className={`rounded-2xl p-5 shadow-elegant ${bg} border`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] font-display tracking-[0.25em] opacity-70">ARMAZÉM</div>
          <div className="font-display text-lg tracking-widest">{warehouse?.name}</div>
        </div>
        <Package className="w-6 h-6 opacity-80" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <BrandTile label="HEINEKEN" barrels={heineken} inverted={variant === "primary"} />
        <BrandTile label="AMSTEL" barrels={amstel} inverted={variant === "primary"} />
      </div>
      <div className="flex flex-wrap gap-2">
        {isDispel && <EntradaDialog warehouseId={warehouse!.id} onDone={onChanged} />}
        {isDispel && (
          <TransferDialog
            fromId={warehouse!.id}
            targetId={warehouses.find((w) => w.code === "allstar")?.id ?? ""}
            targetName="All Star"
            onDone={onChanged}
          />
        )}
        <AjusteDialog warehouseId={warehouse!.id} onDone={onChanged} />
      </div>
    </div>
  );
}

function BrandTile({
  label,
  barrels,
  inverted,
}: {
  label: string;
  barrels: number;
  inverted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 ${inverted ? "bg-white/15 backdrop-blur" : "bg-white"} border ${inverted ? "border-white/20" : ""}`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-display tracking-[0.25em] opacity-80">
        <Beer className="w-3 h-3" /> {label}
      </div>
      <div
        className={`text-3xl font-display mt-1 ${barrels === 0 ? (inverted ? "text-white/70" : "text-muted-foreground") : ""}`}
      >
        {barrels}
      </div>
      <div className="text-[10px] opacity-70">barris</div>
    </div>
  );
}

/* ---------------- Dialogs ---------------- */

async function uploadPhoto(kind: string, file: File): Promise<string | null> {
  const path = `estoque/${kind}/${Date.now()}_${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage.from("operacao-fotos").upload(path, file);
  if (error) {
    toast.error("Erro foto: " + error.message);
    return null;
  }
  return path;
}

function useBrandInputs() {
  const [heineken, setHeineken] = useState<string>("");
  const [amstel, setAmstel] = useState<string>("");
  return {
    heineken,
    amstel,
    setHeineken,
    setAmstel,
    reset: () => {
      setHeineken("");
      setAmstel("");
    },
  };
}

function EntradaDialog({ warehouseId, onDone }: { warehouseId: string; onDone: () => void }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const inputs = useBrandInputs();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const h = parseInt(inputs.heineken || "0", 10);
    const a = parseInt(inputs.amstel || "0", 10);
    if (h <= 0 && a <= 0) {
      toast.error("Informe a quantidade de barris");
      return;
    }
    setBusy(true);
    let photo: string | null = null;
    if (file) photo = await uploadPhoto("entrada", file);
    const rows: any[] = [];
    if (h > 0)
      rows.push({
        warehouse_id: warehouseId,
        move_type: "entrada",
        brand: "heineken",
        quantidade: h,
        direction: 1,
        notes: notes || "Entrada caminhão",
        photo_url: photo,
        performed_by: user?.id,
      });
    if (a > 0)
      rows.push({
        warehouse_id: warehouseId,
        move_type: "entrada",
        brand: "amstel",
        quantidade: a,
        direction: 1,
        notes: notes || "Entrada caminhão",
        photo_url: photo,
        performed_by: user?.id,
      });
    const { error } = await supabase.from("warehouse_movements").insert(rows);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Entrada registrada");
    setOpen(false);
    inputs.reset();
    setFile(null);
    setNotes("");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="gap-1.5">
          <Truck className="w-4 h-4" /> ENTRADA
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrada de caminhão · Estoque Dispel</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              Heineken (barris)
              <Input
                type="number"
                inputMode="numeric"
                value={inputs.heineken}
                onChange={(e) => inputs.setHeineken(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="text-sm">
              Amstel (barris)
              <Input
                type="number"
                inputMode="numeric"
                value={inputs.amstel}
                onChange={(e) => inputs.setAmstel(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>
          <label className="text-sm block">
            Foto da nota (opcional)
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Textarea
            placeholder="Observações (nº nota, fornecedor...)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? "Salvando..." : "Registrar entrada"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({
  fromId,
  targetId,
  targetName,
  onDone,
}: {
  fromId: string;
  targetId: string;
  targetName: string;
  onDone: () => void;
}) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const inputs = useBrandInputs();
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!targetId) {
      toast.error("Estoque destino não encontrado");
      return;
    }
    const h = parseInt(inputs.heineken || "0", 10);
    const a = parseInt(inputs.amstel || "0", 10);
    if (h <= 0 && a <= 0) {
      toast.error("Informe a quantidade");
      return;
    }
    setBusy(true);
    let photo: string | null = null;
    if (file) photo = await uploadPhoto("transferencia", file);
    const rows: any[] = [];
    const base = {
      warehouse_id: fromId,
      target_warehouse_id: targetId,
      move_type: "transferencia",
      direction: -1,
      notes: notes || `Transferência para ${targetName}`,
      photo_url: photo,
      performed_by: user?.id,
    };
    if (h > 0) rows.push({ ...base, brand: "heineken", quantidade: h });
    if (a > 0) rows.push({ ...base, brand: "amstel", quantidade: a });
    const { error } = await supabase.from("warehouse_movements").insert(rows);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Transferência registrada → ${targetName}`);
    setOpen(false);
    inputs.reset();
    setNotes("");
    setFile(null);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="gap-1.5">
          <ArrowRightLeft className="w-4 h-4" /> ABASTECER ALL STAR
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir · Dispel → {targetName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              Heineken
              <Input
                type="number"
                inputMode="numeric"
                value={inputs.heineken}
                onChange={(e) => inputs.setHeineken(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="text-sm">
              Amstel
              <Input
                type="number"
                inputMode="numeric"
                value={inputs.amstel}
                onChange={(e) => inputs.setAmstel(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>
          <label className="text-sm block">
            Foto (opcional)
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Textarea
            placeholder="Observações"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? "Salvando..." : "Registrar transferência"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AjusteDialog({ warehouseId, onDone }: { warehouseId: string; onDone: () => void }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState<Brand>("heineken");
  const [dir, setDir] = useState<1 | -1>(1);
  const [qtd, setQtd] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const q = parseInt(qtd || "0", 10);
    if (q <= 0) {
      toast.error("Quantidade inválida");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("warehouse_movements").insert({
      warehouse_id: warehouseId,
      move_type: "ajuste",
      brand,
      quantidade: q,
      direction: dir,
      notes: notes || "Ajuste manual",
      performed_by: user?.id,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ajuste registrado");
    setOpen(false);
    setQtd("");
    setNotes("");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          Ajuste
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajuste manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              className="border rounded px-2 py-2 text-sm"
              value={brand}
              onChange={(e) => setBrand(e.target.value as Brand)}
            >
              <option value="heineken">Heineken</option>
              <option value="amstel">Amstel</option>
            </select>
            <select
              className="border rounded px-2 py-2 text-sm"
              value={dir}
              onChange={(e) => setDir(Number(e.target.value) as 1 | -1)}
            >
              <option value={1}>+ Adicionar</option>
              <option value={-1}>− Retirar</option>
            </select>
          </div>
          <Input
            type="number"
            inputMode="numeric"
            value={qtd}
            onChange={(e) => setQtd(e.target.value)}
            placeholder="Quantidade"
          />
          <Textarea placeholder="Motivo" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? "Salvando..." : "Registrar ajuste"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
