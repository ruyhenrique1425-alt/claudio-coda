import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  CreditCard,
  Camera,
  Loader2,
  Save,
  Package,
  PackageCheck,
  AlertTriangle,
  CheckCircle2,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/app/equipe-bar/$barId")({
  component: EquipeBarDetail,
});

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

async function uploadPhoto(barId: string, kind: string, file: File): Promise<string | null> {
  const path = `${barId}/equipe/${kind}/${Date.now()}_${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage
    .from("operacao-fotos")
    .upload(path, file, { upsert: false });
  if (error) {
    toast.error("Erro upload: " + error.message);
    return null;
  }
  return path;
}

async function getSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("operacao-fotos")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

function EquipeBarDetail() {
  const { barId } = Route.useParams();
  const { user } = useSession();
  const [bar, setBar] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("bars")
      .select("*")
      .eq("id", barId)
      .maybeSingle()
      .then(({ data }) => {
        setBar(data);
        setLoading(false);
      });
  }, [barId]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!bar) return <div className="p-8 text-center">Bar não encontrado</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-24">
      <Link
        to="/app/equipe-bar"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="w-3 h-3" /> Voltar
      </Link>
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-5 h-5 text-accent" />
        <h1 className="font-display text-xl tracking-wider">{bar.name}</h1>
      </div>
      <div className="text-xs text-muted-foreground mb-4">
        Equipe de bar · {new Date().toLocaleDateString("pt-BR")}
      </div>

      <Tabs defaultValue="promotoras" className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="promotoras" className="font-display text-[11px] tracking-wider">
            <Users className="w-3 h-3 mr-1" /> PROMOTORAS
          </TabsTrigger>
          <TabsTrigger value="maquininhas" className="font-display text-[11px] tracking-wider">
            <CreditCard className="w-3 h-3 mr-1" /> MAQUININHAS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="promotoras" className="mt-4">
          <PromotorasTab barId={barId} userId={user?.id} />
        </TabsContent>

        <TabsContent value="maquininhas" className="mt-4">
          <MaquininhasTab barId={barId} userId={user?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================================================ */
/* ============  PROMOTORAS (staff by shift)  ================= */
/* ============================================================ */

const SHIFT_WINDOWS: { key: string; label: string; startH: number; endH: number }[] = [
  { key: "t_07_19", label: "07h — 19h", startH: 7, endH: 19 },
  { key: "t_10_22", label: "10h — 22h", startH: 10, endH: 22 },
  { key: "t_13_01", label: "13h — 01h", startH: 13, endH: 25 },
];

function activeShiftsAt(date: Date) {
  const h = date.getHours() + date.getMinutes() / 60;
  return SHIFT_WINDOWS.filter((s) => {
    const inSame = h >= s.startH && h < s.endH;
    const wrap = s.endH > 24 && h < s.endH - 24;
    return inSame || wrap;
  });
}

function PromotorasTab({ barId, userId }: any) {
  const [now, setNow] = useState(new Date());
  const [shifts, setShifts] = useState<Record<string, number>>({});
  const [cardQty, setCardQty] = useState(0);
  const [checks, setChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCP, setOpenCP] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [{ data: sh }, { data: rd }, { data: ck }] = await Promise.all([
      supabase.from("bar_shifts").select("shift,meninas_qtd").eq("bar_id", barId),
      supabase.from("bar_card_readers").select("quantidade").eq("bar_id", barId).maybeSingle(),
      supabase
        .from("bar_staff_checks")
        .select("*")
        .eq("bar_id", barId)
        .gte("performed_at", start.toISOString())
        .order("performed_at"),
    ]);
    const map: Record<string, number> = {};
    (sh ?? []).forEach((r: any) => {
      map[r.shift] = r.meninas_qtd ?? 0;
    });
    setShifts(map);
    setCardQty((rd as any)?.quantidade ?? 0);
    setChecks(ck ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t); /* eslint-disable-next-line */
  }, [barId]);

  const active = activeShiftsAt(now);
  const expectedMeninas = active.reduce((sum, s) => sum + (shifts[s.key] ?? 0), 0);
  const expectedCards = cardQty;

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
              <Users className="w-3 h-3" /> Promotoras esperadas
            </div>
            <div className="font-display text-3xl text-primary">{expectedMeninas}</div>
            <div className="text-[11px] text-muted-foreground">
              {active.map((s) => `${shifts[s.key] ?? 0} (${s.label.slice(0, 5)})`).join(" + ") ||
                "—"}
            </div>
          </div>
          <div className="rounded border border-border p-3">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <CreditCard className="w-3 h-3" /> Maquininhas padrão
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
                      · {done.meninas_count} promotoras · {done.card_readers_count} maq.
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
                <StaffCheckForm
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

function StaffCheckForm({
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
            Promotoras contadas{" "}
            <span className="text-muted-foreground">(esp. {expectedMeninas})</span>
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

/* ============================================================ */
/* ============  MAQUININHAS (card readers)  ================== */
/* ============================================================ */

function MaquininhasTab({ barId, userId }: any) {
  const [padrao, setPadrao] = useState<number>(0);
  const [sessions, setSessions] = useState<any[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [registry, setRegistry] = useState<Array<{ patrimonio: string; ativo: boolean }>>([]);

  async function load() {
    setLoading(true);
    const [{ data: r }, { data: s }, { data: reg }] = await Promise.all([
      supabase.from("bar_card_readers").select("*").eq("bar_id", barId).maybeSingle(),
      supabase
        .from("bar_card_machine_sessions")
        .select("*")
        .eq("bar_id", barId)
        .eq("event_date", todayISO())
        .order("picked_up_at"),
      supabase
        .from("bar_machine_patrimonios")
        .select("patrimonio,ativo")
        .eq("bar_id", barId)
        .eq("ativo", true)
        .order("patrimonio"),
    ]);
    const regList = (reg ?? []) as any[];
    setRegistry(regList);
    setPadrao((r as any)?.quantidade ?? regList.length);
    setSessions(s ?? []);
    const map: Record<string, string> = {};
    for (const row of s ?? []) {
      if (row.picked_up_photo) {
        const u = await getSignedUrl(row.picked_up_photo);
        if (u) map[`${row.id}_up`] = u;
      }
      if (row.returned_photo) {
        const u = await getSignedUrl(row.returned_photo);
        if (u) map[`${row.id}_ret`] = u;
      }
    }
    setUrls(map);
    setLoading(false);
  }
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [barId]);

  if (loading)
    return <div className="p-6 text-center text-muted-foreground text-sm">Carregando…</div>;

  const abertas = sessions.filter((s) => !s.returned_at);
  const fechadas = sessions.filter((s) => !!s.returned_at);
  const faltaRetirar = Math.max(0, padrao - sessions.length);
  const faltaDevolver = abertas.length;
  const jaHoje = new Set(sessions.map((s) => String(s.patrimonio).trim().toUpperCase()));

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        <Card className="p-2 text-center">
          <div className="text-[10px] uppercase text-muted-foreground">Padrão</div>
          <div className="font-display text-xl">{padrao}</div>
        </Card>
        <Card className="p-2 text-center">
          <div className="text-[10px] uppercase text-muted-foreground">Em campo</div>
          <div className="font-display text-xl text-primary">{abertas.length}</div>
        </Card>
        <Card className="p-2 text-center">
          <div className="text-[10px] uppercase text-muted-foreground">Falta retirar</div>
          <div
            className={`font-display text-xl ${faltaRetirar > 0 ? "text-destructive" : "text-primary"}`}
          >
            {faltaRetirar}
          </div>
        </Card>
        <Card className="p-2 text-center">
          <div className="text-[10px] uppercase text-muted-foreground">Devolvidas</div>
          <div className="font-display text-xl">{fechadas.length}</div>
        </Card>
      </div>

      <PickupForm
        barId={barId}
        userId={userId}
        suggestion={faltaRetirar}
        onSaved={load}
        registry={registry}
        jaHoje={jaHoje}
      />

      <div className="mt-5">
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-4 h-4 text-accent" />
          <h2 className="font-display text-sm tracking-widest text-muted-foreground">
            EM CAMPO ({abertas.length})
          </h2>
        </div>
        {abertas.length === 0 && (
          <Card className="p-3 text-xs text-muted-foreground text-center">
            Nenhuma maquininha em campo.
          </Card>
        )}
        <div className="space-y-2">
          {abertas.map((s) => (
            <SessionCard key={s.id} s={s} urls={urls} userId={userId} onSaved={load} />
          ))}
        </div>
      </div>

      {fechadas.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-2">
            <PackageCheck className="w-4 h-4 text-primary" />
            <h2 className="font-display text-sm tracking-widest text-muted-foreground">
              DEVOLVIDAS ({fechadas.length})
            </h2>
          </div>
          <div className="space-y-2">
            {fechadas.map((s) => (
              <SessionCard key={s.id} s={s} urls={urls} userId={userId} onSaved={load} />
            ))}
          </div>
        </div>
      )}

      <Card
        className={`mt-6 p-4 ${faltaDevolver === 0 && sessions.length > 0 ? "border-primary" : "border-destructive"}`}
      >
        <div className="flex items-center gap-2">
          {faltaDevolver === 0 && sessions.length > 0 ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span className="font-display text-sm tracking-wider text-primary">
                TODAS AS MAQUININHAS DEVOLVIDAS
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <span className="font-display text-sm tracking-wider text-destructive">
                FALTA DEVOLVER {faltaDevolver} MAQUININHA{faltaDevolver !== 1 ? "S" : ""}
              </span>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function PickupForm({
  barId,
  userId,
  suggestion,
  onSaved,
  registry = [],
  jaHoje = new Set(),
}: any) {
  const [patrimonio, setPatrimonio] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleChip(p: string) {
    const key = p.trim();
    const parts = patrimonio
      .split(";")
      .map((x) => x.trim())
      .filter(Boolean);
    const idx = parts.findIndex((x) => x.toUpperCase() === key.toUpperCase());
    if (idx >= 0) parts.splice(idx, 1);
    else parts.push(key);
    setPatrimonio(parts.join(";"));
  }
  function selectAllPending() {
    const pend = registry
      .filter((r: any) => !jaHoje.has(String(r.patrimonio).trim().toUpperCase()))
      .map((r: any) => r.patrimonio);
    setPatrimonio(pend.join(";"));
  }
  const selecionados = new Set(
    patrimonio
      .split(";")
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean),
  );

  async function save() {
    if (!userId) return toast.error("Faça login");
    const lista = patrimonio
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean);
    if (lista.length === 0) return toast.error("Informe o patrimônio");
    if (!file) return toast.error("Foto de retirada é obrigatória");
    setSaving(true);
    const photo = await uploadPhoto(barId, "retirada", file);
    if (!photo) {
      setSaving(false);
      return;
    }
    const rows = lista.map((p) => ({
      bar_id: barId,
      patrimonio: p,
      picked_up_photo: photo,
      picked_up_by: userId,
      notes: notes || null,
    }));
    const { error } = await supabase.from("bar_card_machine_sessions").insert(rows);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(
      lista.length === 1 ? "Máquina registrada" : `${lista.length} máquinas registradas`,
    );
    setPatrimonio("");
    setFile(null);
    setNotes("");
    onSaved();
  }

  return (
    <Card className="p-4 space-y-3 border-accent/40">
      <div className="flex items-center justify-between">
        <div className="font-display text-sm tracking-widest text-accent">
          RETIRAR MAQUININHA (MEEP)
        </div>
        {suggestion > 0 && (
          <Badge variant="outline" className="text-[10px]">
            sugerido +{suggestion}
          </Badge>
        )}
      </div>

      {registry.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Patrimônios cadastrados</Label>
            <button
              type="button"
              onClick={selectAllPending}
              className="text-[11px] text-primary underline"
            >
              Selecionar pendentes
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {registry.map((r: any) => {
              const key = String(r.patrimonio).trim().toUpperCase();
              const retirado = jaHoje.has(key);
              const sel = selecionados.has(key);
              return (
                <button
                  key={r.patrimonio}
                  type="button"
                  onClick={() => !retirado && toggleChip(r.patrimonio)}
                  disabled={retirado}
                  className={
                    "text-[11px] px-2 py-1 rounded border font-mono transition " +
                    (retirado
                      ? "bg-primary/10 border-primary/40 text-primary line-through opacity-70 cursor-not-allowed"
                      : sel
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-background hover:bg-muted border-border")
                  }
                >
                  {retirado ? "✓ " : ""}
                  {r.patrimonio}
                </button>
              );
            })}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {registry.length} cadastrado(s) · {jaHoje.size} já retirado(s) hoje
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs">
          Patrimônio <span className="text-muted-foreground">(separe várias com ; )</span>
        </Label>
        <Input
          value={patrimonio}
          onChange={(e) => setPatrimonio(e.target.value)}
          placeholder="Ex: PAG 48033;PAG 43953"
          autoCapitalize="characters"
        />
      </div>
      <div>
        <Label className="text-xs">Foto de entrega *</Label>
        <Input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <div>
        <Label className="text-xs">Observações</Label>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Troca, reposição, etc. (opcional)"
        />
      </div>
      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Camera className="w-4 h-4 mr-2" />
            Registrar retirada
          </>
        )}
      </Button>
    </Card>
  );
}

function SessionCard({ s, urls, userId, onSaved }: any) {
  const [openReturn, setOpenReturn] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const upUrl = urls[`${s.id}_up`];
  const retUrl = urls[`${s.id}_ret`];

  async function doReturn() {
    if (!userId) return toast.error("Faça login");
    if (!file) return toast.error("Foto de devolução é obrigatória");
    setSaving(true);
    const photo = await uploadPhoto(s.bar_id, "devolucao", file);
    if (!photo) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("bar_card_machine_sessions")
      .update({
        returned_at: new Date().toISOString(),
        returned_photo: photo,
        returned_by: userId,
      })
      .eq("id", s.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Devolução registrada");
    setOpenReturn(false);
    setFile(null);
    onSaved();
  }

  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        {upUrl && (
          <a href={upUrl} target="_blank" rel="noreferrer">
            <img src={upUrl} className="w-12 h-12 rounded object-cover" />
          </a>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm">#{s.patrimonio}</span>
            {s.returned_at ? (
              <Badge className="bg-primary text-primary-foreground text-[10px]">DEVOLVIDA</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] border-accent text-accent">
                EM CAMPO
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Retirada{" "}
            {new Date(s.picked_up_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {s.returned_at && (
              <>
                {" "}
                · Devolvida{" "}
                {new Date(s.returned_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </>
            )}
          </div>
          {s.notes && (
            <div className="text-[11px] italic text-muted-foreground mt-0.5">{s.notes}</div>
          )}
        </div>
        {retUrl && (
          <a href={retUrl} target="_blank" rel="noreferrer">
            <img src={retUrl} className="w-12 h-12 rounded object-cover" />
          </a>
        )}
        {!s.returned_at && !openReturn && (
          <Button size="sm" variant="outline" onClick={() => setOpenReturn(true)}>
            Devolver
          </Button>
        )}
      </div>
      {openReturn && (
        <div className="mt-3 border-t border-border pt-3 space-y-2">
          <Label className="text-xs">Foto de devolução *</Label>
          <Input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpenReturn(false);
                setFile(null);
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={doReturn} disabled={saving} className="flex-1">
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" />
                  Confirmar devolução
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
