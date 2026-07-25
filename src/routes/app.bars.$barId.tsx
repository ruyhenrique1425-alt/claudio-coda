import { createFileRoute, useNavigate, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IDEAL_TEMP, TEMP_ALERTA } from "@/lib/operacao";
import { useSession, usePermissions } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  Loader2,
  Plus,
  Trash2,
  Save,
  Thermometer,
  Snowflake,
  ClipboardCheck,
  Award,
  Users,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  CloudOff,
  RotateCw,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { enqueue } from "@/lib/offlineQueue";
import { fileToBase64 } from "@/hooks/useOfflineSync";

type TabKey = "inventario" | "reposicao" | "missoes" | "equipe" | "consumo" | "config";
const TAB_KEYS: TabKey[] = ["inventario", "reposicao", "missoes", "equipe", "consumo", "config"];
export const Route = createFileRoute("/app/bars/$barId")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: (TAB_KEYS as string[]).includes(s.tab as string)
      ? (s.tab as TabKey)
      : ("inventario" as TabKey),
  }),
  component: BarDetail,
  pendingComponent: () => (
    <div className="p-8 text-center text-muted-foreground">
      <Loader2 className="inline animate-spin mr-2" />
      Carregando bar…
    </div>
  ),
  errorComponent: BarRouteError,
});

function BarRouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md p-6 text-center space-y-3">
      <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
      <h2 className="font-display text-lg tracking-wider">NÃO FOI POSSÍVEL ABRIR O BAR</h2>
      <p className="text-sm text-muted-foreground">{error?.message ?? "Erro inesperado"}</p>
      <div className="flex justify-center gap-2">
        <Button
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          <RotateCw className="w-4 h-4 mr-1" /> Tentar novamente
        </Button>
        <Button variant="outline" asChild>
          <Link to="/app">Voltar</Link>
        </Button>
      </div>
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = {
  bar_venda: "Bar venda",
  bar_parceiro: "Bar parceiro",
  camarote: "Camarote",
  stand: "Stand",
  haras: "Haras",
};
const BRANDS = ["heineken", "amstel"] as const;
type Brand = (typeof BRANDS)[number];
const SHIFTS = [
  { v: "t_07_19", l: "07h — 19h" },
  { v: "t_10_22", l: "10h — 22h" },
  { v: "t_13_01", l: "13h — 01h" },
] as const;
const STATUSES = [
  { v: "plugado", l: "Plugado" },
  { v: "fechado", l: "Fechado" },
  { v: "vazio", l: "Vazio" },
] as const;

function BarDetail() {
  const { barId } = Route.useParams();
  const { tab } = Route.useSearch();
  const nav = useNavigate();
  const { user } = useSession();
  const perms = usePermissions(user?.id);
  const isGestor = perms.isGestor || perms.isManutencao;

  const [bar, setBar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<any[]>([]);
  const [cardQty, setCardQty] = useState<number>(0);
  const [shifts, setShifts] = useState<Record<string, number>>({});
  const [stockStd, setStockStd] = useState<Record<Brand, number>>({ heineken: 0, amstel: 0 });
  const [inventories, setInventories] = useState<any[]>([]);
  const [refills, setRefills] = useState<any[]>([]);
  const [empties, setEmpties] = useState<any[]>([]);

  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [
        { data: b },
        { data: m },
        { data: c },
        { data: s },
        { data: ss },
        { data: inv },
        { data: rf },
        { data: em },
      ] = await Promise.all([
        supabase.from("bars").select("*").eq("id", barId).maybeSingle(),
        supabase.from("bar_machines").select("*").eq("bar_id", barId),
        supabase.from("bar_card_readers").select("*").eq("bar_id", barId).maybeSingle(),
        supabase.from("bar_shifts").select("*").eq("bar_id", barId),
        supabase.from("bar_stock_standard").select("*").eq("bar_id", barId),
        supabase
          .from("inventories")
          .select("*, inventory_items(*)")
          .eq("bar_id", barId)
          .order("performed_at", { ascending: false })
          .limit(10),
        supabase
          .from("refills")
          .select("*, refill_items(*)")
          .eq("bar_id", barId)
          .order("performed_at", { ascending: false })
          .limit(10),
        // SEM limit: este resultado alimenta o total de "barris consumidos"
        // do bar (ver `consumo` abaixo). Com limit(50) o número era truncado
        // em silêncio assim que o bar passava de 50 recolhimentos.
        supabase
          .from("empties_removed")
          .select("*")
          .eq("bar_id", barId)
          .order("performed_at", { ascending: false }),
      ]);
      setBar(b);
      setMachines(m ?? []);
      setCardQty(c?.quantidade ?? 0);
      const sh: Record<string, number> = {};
      (s ?? []).forEach((r: any) => (sh[r.shift] = r.meninas_qtd));
      setShifts(sh);
      const std: any = { heineken: 0, amstel: 0 };
      (ss ?? []).forEach((r: any) => (std[r.brand] = r.barris_padrao));
      setStockStd(std);
      setInventories(inv ?? []);
      setRefills(rf ?? []);
      setEmpties(em ?? []);
    } catch (err: any) {
      console.error("[bar loadAll]", err);
      setLoadError(err?.message ?? "Falha ao carregar dados do bar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll(); /* eslint-disable-next-line */
  }, [barId]);

  if (loading)
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Loader2 className="inline animate-spin mr-2" />
        Carregando…
      </div>
    );
  if (loadError)
    return (
      <div className="mx-auto max-w-md p-6 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
        <h2 className="font-display text-lg tracking-wider">NÃO FOI POSSÍVEL CARREGAR</h2>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <div className="flex justify-center gap-2">
          <Button onClick={loadAll}>
            <RotateCw className="w-4 h-4 mr-1" /> Tentar novamente
          </Button>
          <Button variant="outline" asChild>
            <Link to="/app">Voltar</Link>
          </Button>
        </div>
      </div>
    );
  if (!bar)
    return (
      <div className="p-8 text-center">
        Bar não encontrado.{" "}
        <Link to="/app" className="underline">
          Voltar
        </Link>
      </div>
    );

  // ---------- consumption computed from empties ----------
  const consumo: Record<Brand, number> = { heineken: 0, amstel: 0 };
  empties.forEach((e: any) => {
    consumo[e.brand as Brand] = (consumo[e.brand as Brand] ?? 0) + e.quantidade;
  });

  // ---------- last inventory summary ----------
  const lastInv = inventories[0];
  const lastCounts: Record<string, Record<string, number>> = {};
  if (lastInv) {
    for (const b of BRANDS) lastCounts[b] = { plugado: 0, fechado: 0, vazio: 0 };
    (lastInv.inventory_items ?? []).forEach((it: any) => {
      lastCounts[it.brand][it.status] = it.quantidade;
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/app" })}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl tracking-wide truncate">{bar.name}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{TYPE_LABEL[bar.bar_type]}</Badge>
            {bar.apoio_responsavel && (
              <span className="truncate">
                Apoio: <b>{bar.apoio_responsavel}</b>
              </span>
            )}
          </div>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) =>
          nav({
            to: "/app/bars/$barId",
            params: { barId },
            search: { tab: v as TabKey },
            replace: true,
          })
        }
      >
        <TabsList className="w-full grid grid-cols-6">
          <TabsTrigger value="inventario" className="font-display text-[11px] tracking-wider">
            INVENT.
          </TabsTrigger>
          <TabsTrigger value="reposicao" className="font-display text-[11px] tracking-wider">
            REPOR
          </TabsTrigger>
          <TabsTrigger value="missoes" className="font-display text-[11px] tracking-wider">
            MISSÕES
          </TabsTrigger>
          <TabsTrigger value="equipe" className="font-display text-[11px] tracking-wider">
            EQUIPE
          </TabsTrigger>
          <TabsTrigger value="consumo" className="font-display text-[11px] tracking-wider">
            CONSUMO
          </TabsTrigger>
          <TabsTrigger value="config" className="font-display text-[11px] tracking-wider">
            CONFIG
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventario" className="mt-3">
          <InventorySection
            barId={barId}
            stockStd={stockStd}
            inventories={inventories}
            onDone={loadAll}
            lastCounts={lastCounts}
          />
        </TabsContent>

        <TabsContent value="reposicao" className="mt-3 space-y-3">
          <div className="text-[11px] text-muted-foreground rounded bg-muted/40 px-3 py-2">
            Use <b>Reposição</b> no dia a dia — ela já registra os vazios retirados junto (no
            padrão, reposição = vazios). A <b>recolha de vazios</b> abaixo é só para retirar vazios
            sem repor.
          </div>
          <RefillSection
            barId={barId}
            refills={refills}
            onDone={loadAll}
            stockStd={stockStd}
            lastCounts={lastCounts}
          />
          <CollectEmptiesSection barId={barId} onDone={loadAll} />

          <TransferSection barId={barId} onDone={loadAll} />
        </TabsContent>

        <TabsContent value="missoes" className="mt-3">
          <MissionsSection barId={barId} />
        </TabsContent>

        <TabsContent value="equipe" className="mt-3">
          <StaffSection barId={barId} shifts={shifts} cardQty={cardQty} userId={user?.id} />
        </TabsContent>

        <TabsContent value="consumo" className="mt-3">
          <Card className="p-4">
            <h2 className="font-display text-sm tracking-widest text-muted-foreground mb-3">
              VAZIOS RETIRADOS
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {BRANDS.map((b) => (
                <div key={b} className="rounded border border-border p-3">
                  <div className="text-xs uppercase text-muted-foreground">{b}</div>
                  <div className="font-display text-3xl text-primary">{consumo[b]}</div>
                  <div className="text-[11px] text-muted-foreground">barris consumidos</div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="mt-3">
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm tracking-widest text-muted-foreground">
                CONFIGURAÇÃO
              </h2>
              {!isGestor && <span className="text-xs text-muted-foreground">Somente leitura</span>}
            </div>
            <BarBasics bar={bar} isGestor={isGestor} onSaved={loadAll} />
            <MachinesEditor
              barId={barId}
              machines={machines}
              isGestor={isGestor}
              onChanged={loadAll}
            />
            <InfraEditor bar={bar} isGestor={isGestor} onSaved={loadAll} />
            <div className="grid gap-4 md:grid-cols-3">
              <CardReaderEditor
                barId={barId}
                qty={cardQty}
                isGestor={isGestor}
                onChanged={loadAll}
              />
              <ShiftsEditor barId={barId} shifts={shifts} isGestor={isGestor} onChanged={loadAll} />
              <StockStdEditor
                barId={barId}
                std={stockStd}
                isGestor={isGestor}
                onChanged={loadAll}
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Sub-components ---------------- */

function BarBasics({ bar, isGestor, onSaved }: any) {
  const [name, setName] = useState(bar.name);
  const [apoio, setApoio] = useState(bar.apoio_responsavel ?? "");
  const [notes, setNotes] = useState(bar.notes ?? "");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("bars")
      .update({
        name,
        apoio_responsavel: apoio || null,
        notes: notes || null,
      })
      .eq("id", bar.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Bar atualizado");
    onSaved();
  }
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div>
        <Label>Nome</Label>
        <Input value={name} disabled={!isGestor} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Apoio responsável</Label>
        <Input value={apoio} disabled={!isGestor} onChange={(e) => setApoio(e.target.value)} />
      </div>
      <div>
        <Label>Observações</Label>
        <Input value={notes} disabled={!isGestor} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {isGestor && (
        <div className="md:col-span-3">
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="w-4 h-4 mr-1" />
            Salvar dados básicos
          </Button>
        </div>
      )}
    </div>
  );
}

function MachinesEditor({ barId, machines, isGestor, onChanged }: any) {
  // Fixed grid: (heineken, amstel) × (1 bico, 2 bicos)
  const BICOS = [1, 2] as const;
  function getQty(brand: Brand, bicos: number): number {
    return machines.find((m: any) => m.brand === brand && m.bicos === bicos)?.quantidade ?? 0;
  }
  const [state, setState] = useState<Record<string, number>>({});
  useEffect(() => {
    const next: Record<string, number> = {};
    for (const b of BRANDS) for (const bi of BICOS) next[`${b}_${bi}`] = getQty(b, bi);
    setState(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machines]);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const rows = [] as any[];
    for (const b of BRANDS)
      for (const bi of BICOS) {
        const q = state[`${b}_${bi}`] ?? 0;
        rows.push({ bar_id: barId, brand: b, bicos: bi, quantidade: q });
      }
    const { error } = await supabase
      .from("bar_machines")
      .upsert(rows, { onConflict: "bar_id,brand,bicos" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Máquinas atualizadas");
    onChanged();
  }

  const total = Object.values(state).reduce((a, b) => a + (Number(b) || 0), 0);

  return (
    <div className="rounded border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-display text-xs tracking-widest text-muted-foreground">
          MÁQUINAS DE CHOPP
        </div>
        <div className="text-xs text-muted-foreground">
          Total: <b className="text-foreground">{total}</b>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {BRANDS.map((b) => (
          <div key={b} className="rounded border border-border/70 p-3 space-y-2 bg-card/50">
            <div className="font-display text-sm uppercase text-primary">{b}</div>
            <div className="grid grid-cols-2 gap-2">
              {BICOS.map((bi) => (
                <div key={bi}>
                  <Label className="text-[11px] text-muted-foreground">
                    {bi} bico{bi > 1 ? "s" : ""}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="0"
                    value={(state[`${b}_${bi}`] ?? 0) === 0 ? "" : String(state[`${b}_${bi}`])}
                    disabled={!isGestor}
                    onChange={(e) =>
                      setState((s) => ({ ...s, [`${b}_${bi}`]: Math.max(0, +e.target.value) }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {isGestor && (
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-1" />
          Salvar máquinas
        </Button>
      )}
    </div>
  );
}

function InfraEditor({ bar, isGestor, onSaved }: any) {
  const [cil, setCil] = useState<number>(bar.cilindros_qtd ?? 0);
  const [man, setMan] = useState<number>(bar.manometros_qtd ?? 0);
  const [pre, setPre] = useState<number>(bar.pre_resfriadores_qtd ?? 0);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setCil(bar.cilindros_qtd ?? 0);
    setMan(bar.manometros_qtd ?? 0);
    setPre(bar.pre_resfriadores_qtd ?? 0);
  }, [bar.id, bar.cilindros_qtd, bar.manometros_qtd, bar.pre_resfriadores_qtd]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("bars")
      .update({
        cilindros_qtd: cil,
        manometros_qtd: man,
        pre_resfriadores_qtd: pre,
      })
      .eq("id", bar.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Infra atualizada");
    onSaved();
  }

  const items: { label: string; value: number; setter: (n: number) => void }[] = [
    { label: "Cilindros", value: cil, setter: setCil },
    { label: "Manômetros", value: man, setter: setMan },
    { label: "Pré-resfriadores", value: pre, setter: setPre },
  ];

  return (
    <div className="rounded border border-border p-4 space-y-3">
      <div className="font-display text-xs tracking-widest text-muted-foreground">INFRA BAR</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.label} className="rounded border border-border/70 p-3 bg-card/50">
            <Label className="text-[11px] text-muted-foreground">{it.label}</Label>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="0"
              value={it.value === 0 ? "" : String(it.value)}
              disabled={!isGestor}
              onChange={(e) => it.setter(Math.max(0, +e.target.value))}
            />
          </div>
        ))}
      </div>
      {isGestor && (
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-1" />
          Salvar infra
        </Button>
      )}
    </div>
  );
}

function CardReaderEditor({ barId, qty, isGestor, onChanged }: any) {
  const [v, setV] = useState(qty);
  useEffect(() => setV(qty), [qty]);
  async function save() {
    const { error } = await supabase
      .from("bar_card_readers")
      .upsert({ bar_id: barId, quantidade: v }, { onConflict: "bar_id" });
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    onChanged();
  }
  return (
    <div className="rounded border border-border p-3">
      <div className="font-display text-xs tracking-widest text-muted-foreground mb-2">
        MÁQUINAS DE CARTÃO
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="0"
          value={(v ?? 0) === 0 ? "" : String(v)}
          disabled={!isGestor}
          onChange={(e) => setV(+e.target.value)}
          className="w-24"
        />
        {isGestor && (
          <Button size="sm" onClick={save}>
            Salvar
          </Button>
        )}
      </div>
    </div>
  );
}

function ShiftsEditor({ barId, shifts, isGestor, onChanged }: any) {
  const [local, setLocal] = useState<Record<string, number>>(shifts);
  useEffect(() => setLocal(shifts), [shifts]);
  async function save(slot: string, value: number) {
    const { error } = await supabase
      .from("bar_shifts")
      .upsert(
        { bar_id: barId, shift: slot as any, meninas_qtd: value },
        { onConflict: "bar_id,shift" },
      );
    if (error) return toast.error(error.message);
    toast.success("Turno salvo");
    onChanged();
  }
  return (
    <div className="rounded border border-border p-3">
      <div className="font-display text-xs tracking-widest text-muted-foreground mb-2">
        MENINAS POR TURNO
      </div>
      <div className="space-y-2">
        {SHIFTS.map((s) => (
          <div key={s.v} className="flex items-center gap-2 text-sm">
            <span className="w-24">{s.l}</span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="0"
              value={(local[s.v] ?? 0) === 0 ? "" : String(local[s.v])}
              disabled={!isGestor}
              onChange={(e) => setLocal((p) => ({ ...p, [s.v]: +e.target.value }))}
              className="w-20"
            />
            {isGestor && (
              <Button size="sm" variant="outline" onClick={() => save(s.v, local[s.v] ?? 0)}>
                OK
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StockStdEditor({ barId, std, isGestor, onChanged }: any) {
  const [local, setLocal] = useState<Record<Brand, number>>(std);
  useEffect(() => setLocal(std), [std]);
  async function save(brand: Brand, value: number) {
    const { error } = await supabase
      .from("bar_stock_standard")
      .upsert({ bar_id: barId, brand, barris_padrao: value }, { onConflict: "bar_id,brand" });
    if (error) return toast.error(error.message);
    toast.success("Padrão salvo");
    onChanged();
  }
  return (
    <div className="rounded border border-border p-3">
      <div className="font-display text-xs tracking-widest text-muted-foreground mb-2">
        PADRÃO DE ESTOQUE (BARRIS)
      </div>
      <div className="space-y-2">
        {BRANDS.map((b) => (
          <div key={b} className="flex items-center gap-2 text-sm">
            <span className="w-24 uppercase">{b}</span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="0"
              value={(local[b] ?? 0) === 0 ? "" : String(local[b])}
              disabled={!isGestor}
              onChange={(e) => setLocal((p) => ({ ...p, [b]: +e.target.value }))}
              className="w-20"
            />
            {isGestor && (
              <Button size="sm" variant="outline" onClick={() => save(b, local[b] ?? 0)}>
                OK
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Photo helper ---------------- */

async function uploadPhoto(barId: string, kind: string, file: File): Promise<string | null> {
  const path = `${barId}/${kind}/${Date.now()}_${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage
    .from("operacao-fotos")
    .upload(path, file, { upsert: false });
  if (error) {
    toast.error("Erro upload foto: " + error.message);
    return null;
  }
  return path;
}

/* ---------------- Inventory ---------------- */

function InventorySection({ barId, stockStd, inventories, lastCounts, onDone }: any) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<Brand, Record<string, number>>>({
    heineken: { plugado: 0, fechado: 0, vazio: 0 },
    amstel: { plugado: 0, fechado: 0, vazio: 0 },
  });
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!file) return toast.error("Foto obrigatória para o inventário");
    setSaving(true);
    try {
      const itemsLong = BRANDS.flatMap((b) =>
        STATUSES.map((s) => ({ brand: b, status: s.v, quantidade: counts[b][s.v] || 0 })),
      );

      // Offline path
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const photoBase64 = await fileToBase64(file);
        await enqueue("inventory.submit", {
          barId,
          userId: user!.id,
          itemsLong,
          photoBase64,
          notes: notes || null,
        });
        toast.success("💾 Salvo offline — sincroniza ao voltar rede");
        setOpen(false);
        setFile(null);
        setNotes("");
        setCounts({
          heineken: { plugado: 0, fechado: 0, vazio: 0 },
          amstel: { plugado: 0, fechado: 0, vazio: 0 },
        });
        return;
      }

      const photo = await uploadPhoto(barId, "inventario", file);
      if (!photo) return;
      const { data: inv, error } = await supabase
        .from("inventories")
        .insert({ bar_id: barId, photo_url: photo, notes: notes || null, performed_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      const items = itemsLong.map((it) => ({ ...it, inventory_id: inv.id }));
      const { error: e2 } = await supabase.from("inventory_items").insert(items);
      if (e2) {
        // rollback the parent inventory row so no orphan is left
        await supabase.from("inventories").delete().eq("id", inv.id);
        throw e2;
      }
      const abaixo = BRANDS.filter((b) => {
        const total = (counts[b].plugado || 0) + (counts[b].fechado || 0);
        return total < (stockStd?.[b] ?? 0);
      });
      if (abaixo.length > 0) {
        toast.warning("⚠ Inventário registrado · estoque abaixo do padrão", {
          description: abaixo
            .map(
              (b) =>
                `${b.toUpperCase()}: ${(counts[b].plugado || 0) + (counts[b].fechado || 0)} / padrão ${stockStd[b]}`,
            )
            .join(" · "),
        });
      } else {
        toast.success("✓ Inventário registrado");
      }
      setOpen(false);
      setFile(null);
      setNotes("");
      setCounts({
        heineken: { plugado: 0, fechado: 0, vazio: 0 },
        amstel: { plugado: 0, fechado: 0, vazio: 0 },
      });
      onDone();
    } catch (err: any) {
      // Fallback to offline queue if network-like failure
      try {
        if (file && (!navigator.onLine || /network|fetch|failed/i.test(err?.message ?? ""))) {
          const photoBase64 = await fileToBase64(file);
          const itemsLong = BRANDS.flatMap((b) =>
            STATUSES.map((s) => ({ brand: b, status: s.v, quantidade: counts[b][s.v] || 0 })),
          );
          await enqueue("inventory.submit", {
            barId,
            userId: user!.id,
            itemsLong,
            photoBase64,
            notes: notes || null,
          });
          toast.success("💾 Salvo offline — sincroniza ao voltar rede");
          setOpen(false);
          setFile(null);
          setNotes("");
          setCounts({
            heineken: { plugado: 0, fechado: 0, vazio: 0 },
            amstel: { plugado: 0, fechado: 0, vazio: 0 },
          });
          return;
        }
      } catch {}
      toast.error("Falha ao salvar inventário", {
        description: err?.message ?? "Verifique a conexão e tente novamente",
      });
    } finally {
      setSaving(false);
    }
  }

  // Plugado é fixo (quase nunca muda) → já sugere o valor do último inventário.
  function openInventoryForm() {
    setCounts({
      heineken: { plugado: lastCounts?.heineken?.plugado ?? 0, fechado: 0, vazio: 0 },
      amstel: { plugado: lastCounts?.amstel?.plugado ?? 0, fechado: 0, vazio: 0 },
    });
    setOpen(true);
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm tracking-widest text-muted-foreground">
          INVENTÁRIO (3× AO DIA)
        </h2>
        <Button size="sm" onClick={() => (open ? setOpen(false) : openInventoryForm())}>
          <Plus className="w-4 h-4 mr-1" />
          Novo inventário
        </Button>
      </div>

      {/* Estoque atual vs padrão */}
      {inventories[0] && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          {BRANDS.map((b) => {
            const c = lastCounts[b];
            const total = (c?.plugado ?? 0) + (c?.fechado ?? 0);
            const padrao = stockStd[b] ?? 0;
            const diff = total - padrao;
            return (
              <div key={b} className="rounded border border-border p-3">
                <div className="uppercase text-xs text-muted-foreground">{b}</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl">{total}</span>
                  <span className="text-xs text-muted-foreground">/ padrão {padrao}</span>
                </div>
                <div className="text-[11px] mt-1">
                  Plugado {c?.plugado ?? 0} · Fechado {c?.fechado ?? 0} · Vazio{" "}
                  <b className="text-accent">{c?.vazio ?? 0}</b>
                </div>
                {diff !== 0 && (
                  <div
                    className={`text-[11px] mt-1 ${diff < 0 ? "text-destructive" : "text-primary"}`}
                  >
                    {diff > 0 ? `+${diff}` : diff} vs padrão
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="border border-border rounded p-3 space-y-3">
          <div className="text-[11px] text-muted-foreground rounded bg-muted/40 px-2 py-1">
            💡 <b>Plugado</b> já vem preenchido com o último valor (é fixo). Ajuste só se mudou.
          </div>
          {BRANDS.map((b) => (
            <div key={b}>
              <div className="uppercase text-xs mb-1">{b}</div>
              <div className="grid grid-cols-3 gap-2">
                {STATUSES.map((s) => (
                  <div key={s.v}>
                    <Label className="text-[11px]">{s.l}</Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder="0"
                      value={counts[b][s.v] === 0 ? "" : String(counts[b][s.v])}
                      onChange={(e) =>
                        setCounts((p) => ({ ...p, [b]: { ...p[b], [s.v]: +e.target.value } }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div>
            <Label>Foto do inventário *</Label>
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={saving}>
              {saving ? (
                <Loader2 className="animate-spin w-4 h-4" />
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-1" />
                  Registrar
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Histórico</div>
        {inventories.length === 0 && (
          <div className="text-xs text-muted-foreground">Sem inventários ainda.</div>
        )}
        {inventories.map((i: any) => (
          <div
            key={i.id}
            className="text-xs flex items-center justify-between border-b border-border/40 py-1"
          >
            <span>{new Date(i.performed_at).toLocaleString("pt-BR")}</span>
            <span className="text-muted-foreground">{i.inventory_items?.length ?? 0} linhas</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- Refill ---------------- */

function RefillSection({ barId, refills, onDone, stockStd, lastCounts }: any) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<Brand, number>>({ heineken: 0, amstel: 0 });
  const [empt, setEmpt] = useState<Record<Brand, number>>({ heineken: 0, amstel: 0 });
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  async function submit() {
    if (!file) return toast.error("Foto obrigatória para reposição");

    // Verifica se a reposição vai deixar o bar acima do padrão
    const excedidos: { brand: Brand; novoTotal: number; padrao: number }[] = [];
    for (const b of BRANDS) {
      const cheiosAtual = (lastCounts?.[b]?.plugado ?? 0) + (lastCounts?.[b]?.fechado ?? 0);
      const novoTotal = cheiosAtual + (qty[b] || 0);
      const padrao = stockStd?.[b] ?? 0;
      if (qty[b] > 0 && novoTotal > padrao && padrao > 0) {
        excedidos.push({ brand: b, novoTotal, padrao });
      }
    }
    let atualizarPadrao = false;
    if (excedidos.length > 0) {
      const msg = excedidos
        .map((e) => `${e.brand.toUpperCase()}: ${e.novoTotal} (padrão atual ${e.padrao})`)
        .join("\n");
      atualizarPadrao = window.confirm(
        `Você deseja alterar o padrão desse bar?\n\nA reposição vai deixar acima do padrão:\n\n${msg}\n\nOK = atualizar padrão · Cancelar = manter padrão`,
      );
    }

    setSaving(true);
    try {
      const itemsPayload = BRANDS.filter((b) => qty[b] > 0).map((b) => ({
        brand: b,
        quantidade: qty[b],
      }));
      const emptiesPayload = BRANDS.filter((b) => empt[b] > 0).map((b) => ({
        brand: b,
        quantidade: empt[b],
      }));

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const photoBase64 = await fileToBase64(file);
        await enqueue("refill.submit", {
          barId,
          userId: user!.id,
          items: itemsPayload,
          empties: emptiesPayload,
          photoBase64,
          notes: notes || null,
        });
        toast.success("💾 Reposição salva offline — sincroniza ao voltar rede");
        setOpen(false);
        setFile(null);
        setNotes("");
        setQty({ heineken: 0, amstel: 0 });
        setEmpt({ heineken: 0, amstel: 0 });
        return;
      }

      const photo = await uploadPhoto(barId, "reposicao", file);
      if (!photo) return;
      const { data: rf, error } = await supabase
        .from("refills")
        .insert({ bar_id: barId, photo_url: photo, notes: notes || null, performed_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      const items = itemsPayload.map((it) => ({ ...it, refill_id: rf.id }));
      if (items.length) {
        const { error: eItems } = await supabase.from("refill_items").insert(items);
        if (eItems) throw eItems;
      }
      const emps = emptiesPayload.map((e) => ({
        bar_id: barId,
        refill_id: rf.id,
        brand: e.brand,
        quantidade: e.quantidade,
        performed_by: user!.id,
      }));
      if (emps.length) {
        const { error: eEmps } = await supabase.from("empties_removed").insert(emps);
        if (eEmps) throw eEmps;
      }

      if (atualizarPadrao && excedidos.length > 0) {
        for (const e of excedidos) {
          await supabase
            .from("bar_stock_standard")
            .upsert(
              { bar_id: barId, brand: e.brand, barris_padrao: e.novoTotal },
              { onConflict: "bar_id,brand" },
            );
        }
        setFlash(
          `⚡ Padrão alterado: ${excedidos.map((e) => `${e.brand} → ${e.novoTotal}`).join(" · ")}`,
        );
        toast.success("⚡ Padrão alterado", {
          description: excedidos
            .map((e) => `${e.brand.toUpperCase()}: ${e.novoTotal} barris`)
            .join(" · "),
        });
        setTimeout(() => setFlash(null), 5000);
      }

      toast.success("✓ Reposição registrada");
      setOpen(false);
      setFile(null);
      setNotes("");
      setQty({ heineken: 0, amstel: 0 });
      setEmpt({ heineken: 0, amstel: 0 });
      onDone();
    } catch (err: any) {
      try {
        if (file && (!navigator.onLine || /network|fetch|failed/i.test(err?.message ?? ""))) {
          const photoBase64 = await fileToBase64(file);
          const itemsPayload = BRANDS.filter((b) => qty[b] > 0).map((b) => ({
            brand: b,
            quantidade: qty[b],
          }));
          const emptiesPayload = BRANDS.filter((b) => empt[b] > 0).map((b) => ({
            brand: b,
            quantidade: empt[b],
          }));
          await enqueue("refill.submit", {
            barId,
            userId: user!.id,
            items: itemsPayload,
            empties: emptiesPayload,
            photoBase64,
            notes: notes || null,
          });
          toast.success("💾 Reposição salva offline — sincroniza ao voltar rede");
          setOpen(false);
          setFile(null);
          setNotes("");
          setQty({ heineken: 0, amstel: 0 });
          setEmpt({ heineken: 0, amstel: 0 });
          return;
        }
      } catch {}
      toast.error("Falha ao registrar reposição", {
        description: err?.message ?? "Verifique a conexão e tente novamente",
      });
    } finally {
      setSaving(false);
    }
  }

  // Sugestão automática: no padrão, REPOSIÇÃO = VAZIOS (repõe o que foi consumido).
  // Vazios sugeridos = vazios do último inventário; reposição = mesmo valor.
  const suggestion = BRANDS.reduce(
    (acc, b) => {
      const vazios = lastCounts?.[b]?.vazio ?? 0;
      const cheios = (lastCounts?.[b]?.plugado ?? 0) + (lastCounts?.[b]?.fechado ?? 0);
      const padrao = stockStd?.[b] ?? 0;
      acc[b] = { vazios, refill: vazios, gap: Math.max(0, padrao - cheios), padrao };
      return acc;
    },
    {} as Record<Brand, { vazios: number; refill: number; gap: number; padrao: number }>,
  );

  function openRefillForm() {
    setQty({ heineken: suggestion.heineken.refill, amstel: suggestion.amstel.refill });
    setEmpt({ heineken: suggestion.heineken.vazios, amstel: suggestion.amstel.vazios });
    setOpen(true);
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm tracking-widest text-muted-foreground">
          REPOSIÇÃO / ABASTECIMENTO
        </h2>
        <Button size="sm" onClick={() => (open ? setOpen(false) : openRefillForm())}>
          <Plus className="w-4 h-4 mr-1" />
          Nova reposição
        </Button>
      </div>
      {flash && (
        <div className="rounded border-2 border-primary bg-primary/10 text-primary text-sm font-bold px-3 py-2 animate-pulse">
          {flash}
        </div>
      )}

      {open && (
        <div className="border border-border rounded p-3 space-y-3">
          <div className="text-[11px] text-muted-foreground rounded bg-muted/40 px-2 py-1">
            💡 Sugestão automática: no padrão, <b>reposição = vazios</b>. Os campos já vêm
            preenchidos com os vazios do último inventário — ajuste se precisar.
          </div>
          <div className="grid grid-cols-2 gap-3">
            {BRANDS.map((b) => {
              const s = suggestion[b];
              return (
                <div key={b} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="uppercase text-xs">{b}</div>
                    <div className="text-[10px] text-muted-foreground">
                      padrão {s.padrao}
                      {s.gap > 0 ? ` · falta ${s.gap}` : " · ok"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px]">Barris repostos (cheios)</Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder="0"
                      value={qty[b] === 0 ? "" : String(qty[b])}
                      onChange={(e) => setQty((p) => ({ ...p, [b]: +e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Vazios retirados</Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder="0"
                      value={empt[b] === 0 ? "" : String(empt[b])}
                      onChange={(e) => setEmpt((p) => ({ ...p, [b]: +e.target.value }))}
                    />
                  </div>
                  {qty[b] !== empt[b] && (
                    <button
                      type="button"
                      onClick={() => setQty((p) => ({ ...p, [b]: empt[b] }))}
                      className="text-[10px] text-primary underline underline-offset-2"
                    >
                      Igualar reposição aos vazios ({empt[b]})
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div>
            <Label>Foto da reposição *</Label>
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={saving}>
              {saving ? (
                <Loader2 className="animate-spin w-4 h-4" />
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-1" />
                  Registrar
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Histórico</div>
        {refills.length === 0 && (
          <div className="text-xs text-muted-foreground">Sem reposições ainda.</div>
        )}
        {refills.map((r: any) => (
          <div key={r.id} className="text-xs border-b border-border/40 py-1">
            <div className="flex justify-between">
              <span>{new Date(r.performed_at).toLocaleString("pt-BR")}</span>
              <span className="text-muted-foreground">
                {(r.refill_items ?? [])
                  .map((it: any) => `${it.quantidade} ${it.brand}`)
                  .join(" · ") || "sem itens"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CollectEmptiesSection({ barId, onDone }: { barId: string; onDone: () => void }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [empt, setEmpt] = useState<Record<Brand, number>>({ heineken: 0, amstel: 0 });
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from("empties_removed")
      .select("*")
      .eq("bar_id", barId)
      .is("refill_id", null)
      .order("performed_at", { ascending: false })
      .limit(20);
    setHistory(data ?? []);
  }
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [barId]);

  async function submit() {
    if (!file) return toast.error("Foto obrigatória para recolher vazios");
    const total = empt.heineken + empt.amstel;
    if (total <= 0) return toast.error("Informe a quantidade de vazios");
    setSaving(true);
    try {
      const rowsPayload = BRANDS.filter((b) => empt[b] > 0).map((b) => ({
        brand: b,
        quantidade: empt[b],
        refill_id: null,
      }));

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const photoBase64 = await fileToBase64(file);
        await enqueue("empties.remove", {
          barId,
          userId: user!.id,
          rows: rowsPayload,
          photoBase64,
          notes: notes || null,
        });
        toast.success("💾 Salvo offline — sincroniza ao voltar rede");
        setOpen(false);
        setFile(null);
        setNotes("");
        setEmpt({ heineken: 0, amstel: 0 });
        return;
      }

      const photo = await uploadPhoto(barId, "vazios", file);
      if (!photo) return;
      const rows = rowsPayload.map((r) => ({
        ...r,
        bar_id: barId,
        photo_url: photo,
        notes: notes || null,
        performed_by: user!.id,
      }));
      const { error } = await supabase.from("empties_removed").insert(rows);
      if (error) throw error;
      toast.success("✓ Vazios recolhidos");
      setOpen(false);
      setFile(null);
      setNotes("");
      setEmpt({ heineken: 0, amstel: 0 });
      load();
      onDone();
    } catch (e: any) {
      try {
        if (file && (!navigator.onLine || /network|fetch|failed/i.test(e?.message ?? ""))) {
          const photoBase64 = await fileToBase64(file);
          const rowsPayload = BRANDS.filter((b) => empt[b] > 0).map((b) => ({
            brand: b,
            quantidade: empt[b],
            refill_id: null,
          }));
          await enqueue("empties.remove", {
            barId,
            userId: user!.id,
            rows: rowsPayload,
            photoBase64,
            notes: notes || null,
          });
          toast.success("💾 Salvo offline — sincroniza ao voltar rede");
          setOpen(false);
          setFile(null);
          setNotes("");
          setEmpt({ heineken: 0, amstel: 0 });
          return;
        }
      } catch {}
      toast.error(e?.message || "Falha ao recolher vazios");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm tracking-widest text-muted-foreground">
          RECOLHER VAZIOS
        </h2>
        <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>
          <Plus className="w-4 h-4 mr-1" />
          Recolher vazios
        </Button>
      </div>

      {open && (
        <div className="border border-border rounded p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {BRANDS.map((b) => (
              <div key={b}>
                <Label className="text-[11px] uppercase">{b} — vazios</Label>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="0"
                  value={empt[b] === 0 ? "" : String(empt[b])}
                  onChange={(e) => setEmpt((p) => ({ ...p, [b]: +e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div>
            <Label>Foto dos vazios *</Label>
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={saving}>
              {saving ? (
                <Loader2 className="animate-spin w-4 h-4" />
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-1" />
                  Registrar
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Histórico (sem reposição)</div>
        {history.length === 0 && (
          <div className="text-xs text-muted-foreground">Nenhum recolhimento avulso.</div>
        )}
        {history.map((h) => (
          <div key={h.id} className="text-xs border-b border-border/40 py-1 flex justify-between">
            <span>{new Date(h.performed_at).toLocaleString("pt-BR")}</span>
            <span className="text-muted-foreground">
              {h.quantidade} {h.brand}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- Missions ---------------- */

const TEMP_SLOTS = [
  { v: "t_11", l: "11h" },
  { v: "t_17", l: "17h" },
  { v: "t_22", l: "22h" },
] as const;

function MissionsSection({ barId }: { barId: string }) {
  const [temps, setTemps] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: t }, { data: o }] = await Promise.all([
      supabase
        .from("bar_temperature_checks")
        .select("*")
        .eq("bar_id", barId)
        .order("performed_at", { ascending: false })
        .limit(20),
      supabase
        .from("bar_organization_checks")
        .select("*")
        .eq("bar_id", barId)
        .order("performed_at", { ascending: false })
        .limit(20),
    ]);
    setTemps(t ?? []);
    setOrgs(o ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [barId]);

  // last per slot today
  const todayKey = new Date().toDateString();
  const lastBySlot: Record<string, any> = {};
  temps.forEach((t) => {
    if (new Date(t.performed_at).toDateString() === todayKey && !lastBySlot[t.slot])
      lastBySlot[t.slot] = t;
  });
  const lastOrg = orgs[0];
  const lastOrgToday =
    lastOrg && new Date(lastOrg.performed_at).toDateString() === todayKey ? lastOrg : null;

  return (
    <div className="space-y-4">
      <TemperatureMission
        barId={barId}
        temps={temps}
        lastBySlot={lastBySlot}
        onDone={load}
        loading={loading}
      />
      <OrganizationMission barId={barId} orgs={orgs} lastOrgToday={lastOrgToday} onDone={load} />
    </div>
  );
}

function tempVerdict(t: number) {
  if (t <= IDEAL_TEMP) return { seal: true, label: "PADRÃO DISPEL · SUPER GELADO" };
  // Regra do gestor: acima de +1 °C é chopp quente e precisa de ação.
  if (t > TEMP_ALERTA) return { seal: false, alerta: true, label: "QUENTE · VERIFICAR CHOPEIRA" };
  return { seal: false, label: "REGULAR TEMPERATURA" };
}

function TemperatureMission({ barId, temps, lastBySlot: lastBySlotProp, onDone, loading }: any) {
  const { user } = useSession();
  const [slot, setSlot] = useState<string>("");
  const [temp, setTemp] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [optimistic, setOptimistic] = useState<Record<string, any>>({});
  const lastBySlot: Record<string, any> = { ...(lastBySlotProp || {}), ...optimistic };

  async function submit() {
    if (!slot) return toast.error("Escolha o horário (11h, 17h ou 22h)");
    if (!temp) return toast.error("Informe a temperatura");
    if (!file) return toast.error("Foto do termômetro é obrigatória");
    if (!user) return toast.error("Sessão expirada");
    setSaving(true);
    try {
      const optimisticRow = {
        temperatura: Number(temp),
        performed_at: new Date().toISOString(),
        _pending: true,
      };
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const photoBase64 = await fileToBase64(file);
        await enqueue("temperature.submit", {
          barId,
          userId: user.id,
          slot,
          temperatura: Number(temp),
          photoBase64,
        });
        setOptimistic((o) => ({ ...o, [slot]: optimisticRow }));
        toast.success("💾 Salvo offline — sincroniza ao voltar rede");
        setSlot("");
        setTemp("");
        setFile(null);
        return;
      }
      const path = await uploadPhoto(barId, "temperatura", file);
      if (!path) return;
      const { error } = await supabase.from("bar_temperature_checks").insert({
        bar_id: barId,
        slot: slot as any,
        temperatura: Number(temp),
        photo_url: path,
        performed_by: user.id,
      });
      if (error) return toast.error(error.message);
      setOptimistic((o) => ({ ...o, [slot]: optimisticRow }));
      toast.success("Temperatura registrada");
      setSlot("");
      setTemp("");
      setFile(null);
      onDone();
    } catch (err: any) {
      try {
        if (file && (!navigator.onLine || /network|fetch|failed/i.test(err?.message ?? ""))) {
          const photoBase64 = await fileToBase64(file);
          await enqueue("temperature.submit", {
            barId,
            userId: user.id,
            slot,
            temperatura: Number(temp),
            photoBase64,
          });
          setOptimistic((o) => ({
            ...o,
            [slot]: {
              temperatura: Number(temp),
              performed_at: new Date().toISOString(),
              _pending: true,
            },
          }));
          toast.success("💾 Salvo offline — sincroniza ao voltar rede");
          setSlot("");
          setTemp("");
          setFile(null);
          return;
        }
      } catch {}
      toast.error(err?.message ?? "Falha ao salvar temperatura");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Thermometer className="w-4 h-4 text-primary" />
        <h2 className="font-display text-sm tracking-widest text-muted-foreground">
          TEMPERATURA DO CHOPP
        </h2>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Meça às 11h, 17h e 22h. Ideal: <b className="text-primary">≤ {IDEAL_TEMP}°C</b> — foto do
        termômetro obrigatória.
      </p>

      {/* status de hoje por horário */}
      <div className="grid grid-cols-3 gap-2">
        {TEMP_SLOTS.map((s) => {
          const rec = lastBySlot[s.v];
          if (!rec)
            return (
              <div key={s.v} className="rounded border border-dashed border-border p-2 text-center">
                <div className="font-display text-sm">{s.l}</div>
                <div className="text-[10px] text-muted-foreground">Pendente</div>
              </div>
            );
          const v = tempVerdict(Number(rec.temperatura));
          return (
            <div
              key={s.v}
              className={`rounded border p-2 text-center ${v.seal ? "border-primary bg-primary/10" : "border-accent bg-accent/10"}`}
            >
              <div className="font-display text-sm">{s.l}</div>
              <div className="font-display text-lg">{Number(rec.temperatura).toFixed(1)}°C</div>
              <div
                className={`text-[9px] tracking-widest ${v.seal ? "text-primary" : "text-accent"}`}
              >
                {rec._pending ? "⏳ SINCRONIZANDO" : v.seal ? "★ SUPER GELADO" : "REGULAR"}
              </div>
            </div>
          );
        })}
      </div>

      {/* registrar novo */}
      <div className="rounded border border-border p-3 space-y-2">
        <div className="text-[11px] font-display tracking-widest text-muted-foreground">
          NOVO REGISTRO
        </div>
        <div className="grid grid-cols-3 gap-2">
          {TEMP_SLOTS.map((s) => (
            <Button
              key={s.v}
              type="button"
              size="sm"
              variant={slot === s.v ? "default" : "outline"}
              onClick={() => setSlot(s.v)}
            >
              {s.l}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px]">Temperatura (°C)</Label>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={temp.trim().startsWith("-") ? "default" : "outline"}
                className="px-2 font-display"
                onClick={() => {
                  setTemp((v) => {
                    const s = v.trim();
                    if (!s) return "-";
                    if (s === "-") return "";
                    if (s.startsWith("-")) return s.slice(1);
                    return "-" + s;
                  });
                }}
                title="Alternar negativo"
              >
                ±
              </Button>
              <Input
                type="text"
                inputMode="decimal"
                pattern="-?[0-9]*[.,]?[0-9]*"
                value={temp}
                onChange={(e) => {
                  const raw = e.target.value.replace(",", ".");
                  if (raw === "" || raw === "-" || /^-?\d*\.?\d*$/.test(raw)) setTemp(raw);
                }}
                placeholder="-1.0"
              />
            </div>
          </div>
          <div>
            <Label className="text-[11px]">Foto do termômetro</Label>
            <label className="flex items-center gap-1 text-xs border border-border rounded px-2 py-1.5 cursor-pointer hover:border-primary">
              <Camera className="w-3 h-3" />
              {file ? file.name.slice(0, 14) : "Tirar/anexar"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
        {temp && (
          <div className="text-[11px]">
            Prévia:{" "}
            <b className={tempVerdict(Number(temp)).seal ? "text-primary" : "text-accent"}>
              {tempVerdict(Number(temp)).label}
            </b>
          </div>
        )}
        <Button size="sm" onClick={submit} disabled={saving} className="w-full">
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4 mr-1" />
              Registrar
            </>
          )}
        </Button>
      </div>

      {/* histórico */}
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Histórico</div>
        {loading && <div className="text-xs text-muted-foreground">Carregando…</div>}
        {!loading && temps.length === 0 && (
          <div className="text-xs text-muted-foreground">Sem medições ainda.</div>
        )}
        {temps.slice(0, 8).map((r: any) => {
          const v = tempVerdict(Number(r.temperatura));
          const slotL = TEMP_SLOTS.find((s) => s.v === r.slot)?.l ?? r.slot;
          return (
            <div key={r.id} className="text-xs border-b border-border/40 py-1 flex justify-between">
              <span>
                {new Date(r.performed_at).toLocaleString("pt-BR")} · {slotL}
              </span>
              <span className={v.seal ? "text-primary" : "text-accent"}>
                {Number(r.temperatura).toFixed(1)}°C {v.seal ? "★" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const ORG_ITEMS = [
  { k: "copo_ok", l: "Check de copo" },
  { k: "meninas_ok", l: "Meninas posicionadas" },
  { k: "limpo_ok", l: "Bar limpo" },
  { k: "sem_fila_ok", l: "Sem fila" },
] as const;

function OrganizationMission({ barId, orgs, lastOrgToday: lastOrgTodayProp, onDone }: any) {
  const { user } = useSession();
  const [state, setState] = useState<Record<string, boolean>>({
    copo_ok: false,
    meninas_ok: false,
    limpo_ok: false,
    sem_fila_ok: false,
  });
  const [saving, setSaving] = useState(false);
  const [optimistic, setOptimistic] = useState<any>(null);
  const lastOrgToday = optimistic ?? lastOrgTodayProp;

  const allOk = ORG_ITEMS.every((i) => state[i.k]);

  async function submit() {
    if (!user) return toast.error("Sessão expirada");
    setSaving(true);
    const snapshot = { ...state, performed_at: new Date().toISOString(), _pending: true };
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueue("organization.submit", { barId, userId: user.id, state });
        setOptimistic(snapshot);
        toast.success("💾 Salvo offline — sincroniza ao voltar rede");
        setState({ copo_ok: false, meninas_ok: false, limpo_ok: false, sem_fila_ok: false });
        return;
      }
      const { error } = await supabase.from("bar_organization_checks").insert({
        bar_id: barId,
        ...state,
        performed_by: user.id,
      });
      if (error) return toast.error(error.message);
      setOptimistic({ ...snapshot, _pending: false });
      toast.success(allOk ? "★ PADRÃO DISPEL BAR TOP registrado!" : "Check registrado");
      setState({ copo_ok: false, meninas_ok: false, limpo_ok: false, sem_fila_ok: false });
      onDone();
    } catch (err: any) {
      try {
        if (!navigator.onLine || /network|fetch|failed/i.test(err?.message ?? "")) {
          await enqueue("organization.submit", { barId, userId: user.id, state });
          setOptimistic(snapshot);
          toast.success("💾 Salvo offline — sincroniza ao voltar rede");
          setState({ copo_ok: false, meninas_ok: false, limpo_ok: false, sem_fila_ok: false });
          return;
        }
      } catch {}
      toast.error(err?.message ?? "Falha ao salvar organização");
    } finally {
      setSaving(false);
    }
  }

  const lastAllOk = lastOrgToday && ORG_ITEMS.every((i) => lastOrgToday[i.k]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4 text-primary" />
        <h2 className="font-display text-sm tracking-widest text-muted-foreground">
          ORGANIZAÇÃO DO BAR
        </h2>
      </div>

      {lastOrgToday && (
        <div
          className={`rounded p-3 text-center border ${lastAllOk ? "border-primary bg-primary/10" : "border-border bg-card/40"}`}
        >
          {lastAllOk ? (
            <>
              <Award className="w-6 h-6 mx-auto text-primary" />
              <div className="font-display text-sm text-primary tracking-widest mt-1">
                ★ PADRÃO DISPEL · BAR TOP
              </div>
              <div className="text-[10px] text-muted-foreground">
                {new Date(lastOrgToday.performed_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground">
              Último check às{" "}
              {new Date(lastOrgToday.performed_at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              — pendências restantes
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {ORG_ITEMS.map((i) => (
          <label
            key={i.k}
            className={`flex items-center gap-2 rounded border p-2 cursor-pointer ${state[i.k] ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <input
              type="checkbox"
              checked={state[i.k]}
              onChange={(e) => setState((s) => ({ ...s, [i.k]: e.target.checked }))}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm">{i.l}</span>
          </label>
        ))}
      </div>

      {allOk && (
        <div className="rounded border border-primary bg-primary/10 p-2 text-center">
          <Snowflake className="w-4 h-4 inline text-primary" />{" "}
          <span className="font-display text-xs tracking-widest text-primary">
            ★ PADRÃO DISPEL · BAR TOP
          </span>
        </div>
      )}

      <Button size="sm" onClick={submit} disabled={saving} className="w-full">
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Save className="w-4 h-4 mr-1" />
            Registrar check
          </>
        )}
      </Button>

      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Histórico</div>
        {orgs.length === 0 && (
          <div className="text-xs text-muted-foreground">Sem checks ainda.</div>
        )}
        {orgs.slice(0, 6).map((r: any) => {
          const ok = ORG_ITEMS.every((i) => r[i.k]);
          const done = ORG_ITEMS.filter((i) => r[i.k]).length;
          return (
            <div key={r.id} className="text-xs border-b border-border/40 py-1 flex justify-between">
              <span>{new Date(r.performed_at).toLocaleString("pt-BR")}</span>
              <span className={ok ? "text-primary" : "text-muted-foreground"}>
                {done}/4 {ok ? "★ BAR TOP" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------------- Staff / Coordinator Checks ---------------- */

const SHIFT_WINDOWS: { key: string; label: string; startH: number; endH: number }[] = [
  { key: "t_07_19", label: "07h — 19h", startH: 7, endH: 19 },
  { key: "t_10_22", label: "10h — 22h", startH: 10, endH: 22 },
  { key: "t_13_01", label: "13h — 01h", startH: 13, endH: 25 }, // 25 = 1h next day
];

function activeShiftsAt(date: Date) {
  const h = date.getHours() + date.getMinutes() / 60;
  return SHIFT_WINDOWS.filter((s) => {
    const inSame = h >= s.startH && h < s.endH;
    const wrap = s.endH > 24 && h < s.endH - 24;
    return inSame || wrap;
  });
}

function StaffSection({ barId, shifts, cardQty, userId }: any) {
  const [now, setNow] = useState(new Date());
  const [checks, setChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCP, setOpenCP] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("bar_staff_checks")
      .select("*")
      .eq("bar_id", barId)
      .gte("performed_at", start.toISOString())
      .order("performed_at", { ascending: true });
    setChecks(data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t); /* eslint-disable-next-line */
  }, [barId]);

  const active = activeShiftsAt(now);
  const expectedMeninas = active.reduce((sum, s) => sum + (shifts[s.key] ?? 0), 0);
  const expectedCards = cardQty ?? 0;

  const CHECKPOINTS = [
    { n: 1, label: "1º check", hint: "manhã" },
    { n: 2, label: "2º check", hint: "tarde" },
    { n: 3, label: "3º check", hint: "noite" },
  ];

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-sm tracking-widest text-muted-foreground">
            AGORA · {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </h2>
          {active.length > 1 && (
            <Badge className="bg-accent text-accent-foreground">TURNOS ACUMULADOS</Badge>
          )}
        </div>
        {active.length === 0 ? (
          <div className="text-sm text-muted-foreground">Fora de turno.</div>
        ) : (
          <div className="text-xs text-muted-foreground mb-3">
            Turnos ativos: {active.map((s) => s.label).join(" + ")}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-border p-3">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Users className="w-3 h-3" /> Meninas esperadas
            </div>
            <div className="font-display text-3xl text-primary">{expectedMeninas}</div>
            <div className="text-[11px] text-muted-foreground">
              {active.map((s) => `${shifts[s.key] ?? 0} (${s.label.slice(0, 5)})`).join(" + ") ||
                "—"}
            </div>
          </div>
          <div className="rounded border border-border p-3">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <CreditCard className="w-3 h-3" /> Maquininhas
            </div>
            <div className="font-display text-3xl text-primary">{expectedCards}</div>
            <div className="text-[11px] text-muted-foreground">padrão do bar</div>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-display text-sm tracking-widest text-muted-foreground">
          CHECKS DE HOJE (3×)
        </h2>
        {loading && <div className="text-xs text-muted-foreground">Carregando…</div>}
        {CHECKPOINTS.map((cp) => {
          const done = checks.find((c) => c.checkpoint === cp.n);
          const ok = done && done.meninas_ok && done.cards_ok;
          return (
            <div key={cp.n} className="border border-border rounded p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-sm tracking-wider">
                    {cp.label}{" "}
                    <span className="text-[11px] text-muted-foreground">· {cp.hint}</span>
                  </div>
                  {done ? (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {new Date(done.performed_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {done.meninas_count} meninas · {done.card_readers_count} maq.
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground mt-1">pendente</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {done ? (
                    ok ? (
                      <Badge className="bg-primary text-primary-foreground">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        OK
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        AJUSTAR
                      </Badge>
                    )
                  ) : (
                    <Button size="sm" onClick={() => setOpenCP(cp.n)}>
                      Registrar
                    </Button>
                  )}
                </div>
              </div>
              {openCP === cp.n && (
                <CheckForm
                  barId={barId}
                  userId={userId}
                  checkpoint={cp.n}
                  expectedMeninas={expectedMeninas}
                  expectedCards={expectedCards}
                  onCancel={() => setOpenCP(null)}
                  onSaved={() => {
                    setOpenCP(null);
                    load();
                  }}
                />
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function CheckForm({
  barId,
  userId,
  checkpoint,
  expectedMeninas,
  expectedCards,
  onCancel,
  onSaved,
}: any) {
  const [meninas, setMeninas] = useState<number>(expectedMeninas);
  const [cards, setCards] = useState<number>(expectedCards);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!userId) return toast.error("Faça login");
    setSaving(true);
    const { error } = await supabase.from("bar_staff_checks").insert({
      bar_id: barId,
      checkpoint,
      meninas_count: meninas,
      card_readers_count: cards,
      meninas_ok: meninas >= expectedMeninas,
      cards_ok: cards >= expectedCards,
      notes: notes || null,
      performed_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Check registrado");
    onSaved();
  }

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">
            Meninas contadas <span className="text-muted-foreground">(esp. {expectedMeninas})</span>
          </Label>
          <Input
            type="number"
            inputMode="numeric"
            value={meninas === 0 ? "" : String(meninas)}
            onChange={(e) => setMeninas(Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <Label className="text-xs">
            Maquininhas <span className="text-muted-foreground">(esp. {expectedCards})</span>
          </Label>
          <Input
            type="number"
            inputMode="numeric"
            value={cards === 0 ? "" : String(cards)}
            onChange={(e) => setCards(Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Observações</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="opcional" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button size="sm" onClick={save} disabled={saving} className="flex-1">
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4 mr-1" />
              Salvar check
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Transfer between bars ---------------- */

function TransferSection({ barId, onDone }: { barId: string; onDone: () => void }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [bars, setBars] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [otherBarId, setOtherBarId] = useState<string>("");
  const [qty, setQty] = useState<Record<Brand, number>>({ heineken: 0, amstel: 0 });
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [{ data: bs }, { data: outT }, { data: inT }] = await Promise.all([
      supabase.from("bars").select("id,name").neq("id", barId).order("name"),
      supabase
        .from("bar_transfers")
        .select("*, bar_transfer_items(*), to_bar:bars!bar_transfers_to_bar_id_fkey(name)")
        .eq("from_bar_id", barId)
        .order("performed_at", { ascending: false })
        .limit(20),
      supabase
        .from("bar_transfers")
        .select("*, bar_transfer_items(*), from_bar:bars!bar_transfers_from_bar_id_fkey(name)")
        .eq("to_bar_id", barId)
        .order("performed_at", { ascending: false })
        .limit(20),
    ]);
    setBars(bs ?? []);
    const merged = [
      ...(outT ?? []).map((t: any) => ({ ...t, _dir: "out" as const })),
      ...(inT ?? []).map((t: any) => ({ ...t, _dir: "in" as const })),
    ].sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime());
    setTransfers(merged);
  }
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [barId]);

  async function submit() {
    if (!otherBarId) return toast.error("Selecione o outro bar");
    if (!file) return toast.error("Foto obrigatória para transferência");
    const totalQty = BRANDS.reduce((s, b) => s + (qty[b] || 0), 0);
    if (totalQty <= 0) return toast.error("Informe a quantidade de barris");
    setSaving(true);
    try {
      const photo = await uploadPhoto(barId, "transferencia", file);
      if (!photo) return;
      const from_bar_id = direction === "out" ? barId : otherBarId;
      const to_bar_id = direction === "out" ? otherBarId : barId;
      const { data: tr, error } = await supabase
        .from("bar_transfers")
        .insert({
          from_bar_id,
          to_bar_id,
          photo_url: photo,
          notes: notes || null,
          performed_by: user!.id,
        })
        .select()
        .single();
      if (error) return toast.error(error.message);
      const items = BRANDS.filter((b) => qty[b] > 0).map((b) => ({
        transfer_id: tr.id,
        brand: b,
        quantidade: qty[b],
      }));
      if (items.length) {
        const { error: ie } = await supabase.from("bar_transfer_items").insert(items);
        if (ie) return toast.error(ie.message);
      }

      // Transferência = reposição no destino (abate implícito na origem via próximo inventário)
      // O trigger deduct_dispel_on_refill ignora refills com notes começando em "__transfer__"
      // evitando dupla baixa no estoque Dispel.
      const fromName =
        direction === "out"
          ? "este bar"
          : (bars.find((x) => x.id === otherBarId)?.name ?? "outro bar");
      const toName =
        direction === "out"
          ? (bars.find((x) => x.id === otherBarId)?.name ?? "outro bar")
          : "este bar";
      const refillNotes = `__transfer__ Recebido via transferência de ${fromName}`;
      const { data: rf, error: rfErr } = await supabase
        .from("refills")
        .insert({ bar_id: to_bar_id, photo_url: photo, notes: refillNotes, performed_by: user!.id })
        .select()
        .single();
      if (!rfErr && rf) {
        const refillItems = BRANDS.filter((b) => qty[b] > 0).map((b) => ({
          refill_id: rf.id,
          brand: b,
          quantidade: qty[b],
        }));
        if (refillItems.length) await supabase.from("refill_items").insert(refillItems);
      }
      // Registro histórico de saída na origem (sem itens, apenas notas)
      await supabase.from("refills").insert({
        bar_id: from_bar_id,
        photo_url: photo,
        notes: `__transfer__ Saída via transferência para ${toName}: ${BRANDS.filter(
          (b) => qty[b] > 0,
        )
          .map((b) => `${qty[b]} ${b}`)
          .join(" · ")}`,
        performed_by: user!.id,
      });

      toast.success(
        direction === "out"
          ? "✓ Baixa registrada · destino reposto"
          : "✓ Entrada registrada como reposição",
      );

      setOpen(false);
      setFile(null);
      setNotes("");
      setOtherBarId("");
      setQty({ heineken: 0, amstel: 0 });
      load();
      onDone();
    } catch (err: any) {
      toast.error("Falha ao registrar transferência", {
        description: err?.message ?? "Verifique a conexão",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm tracking-widest text-muted-foreground flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4" /> TRANSFERIR BARRIS
        </h2>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
          <Plus className="w-4 h-4 mr-1" />
          Nova transferência
        </Button>
      </div>

      {open && (
        <div className="border border-border rounded p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant={direction === "out" ? "default" : "outline"}
              onClick={() => setDirection("out")}
            >
              Enviar para outro bar
            </Button>
            <Button
              size="sm"
              variant={direction === "in" ? "default" : "outline"}
              onClick={() => setDirection("in")}
            >
              Receber de outro bar
            </Button>
          </div>
          <div>
            <Label className="text-[11px]">
              {direction === "out" ? "Bar destino" : "Bar origem"} *
            </Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={otherBarId}
              onChange={(e) => setOtherBarId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {bars.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {BRANDS.map((b) => (
              <div key={b}>
                <Label className="text-[11px] uppercase">{b} — barris</Label>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="0"
                  value={qty[b] === 0 ? "" : String(qty[b])}
                  onChange={(e) => setQty((p) => ({ ...p, [b]: +e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div>
            <Label>Foto da transferência *</Label>
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ex: transferi 3 heineken para o Villa 2"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={saving}>
              {saving ? (
                <Loader2 className="animate-spin w-4 h-4" />
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4 mr-1" />
                  Registrar transferência
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Histórico</div>
        {transfers.length === 0 && (
          <div className="text-xs text-muted-foreground">Sem transferências ainda.</div>
        )}
        {transfers.map((t: any) => {
          const isOut = t._dir === "out";
          const other = isOut ? t.to_bar?.name : t.from_bar?.name;
          const items = (t.bar_transfer_items ?? [])
            .map((it: any) => `${it.quantidade} ${it.brand}`)
            .join(" · ");
          return (
            <div
              key={t.id}
              className="text-xs border-b border-border/40 py-1 flex justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <Badge variant={isOut ? "destructive" : "default"} className="text-[10px]">
                    {isOut ? "SAÍDA →" : "← ENTRADA"}
                  </Badge>
                  <span className="truncate">{other ?? "—"}</span>
                </div>
                <div className="text-muted-foreground">
                  {new Date(t.performed_at).toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="text-right text-muted-foreground">{items || "—"}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
