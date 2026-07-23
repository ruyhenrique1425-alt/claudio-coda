import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardCheck, Image as ImageIcon, Filter, ChevronRight, Download } from "lucide-react";
import { downloadCsv, timestampSlug } from "@/lib/exportCsv";

export const Route = createFileRoute("/app/inventarios")({
  component: InventariosHistorico,
});

type Brand = "heineken" | "amstel";
type Status = "plugado" | "fechado" | "vazio";
type Item = { brand: Brand; status: Status; quantidade: number };
type Inv = {
  id: string;
  bar_id: string;
  performed_at: string;
  photo_url: string;
  notes: string | null;
  performed_by: string;
  bar_name: string;
  operator: string | null;
  items: Item[];
};

const BRAND_LABEL: Record<Brand, string> = { heineken: "Heineken", amstel: "Amstel" };
const STATUS_LABEL: Record<Status, string> = { plugado: "Plugado", fechado: "Fechado", vazio: "Vazio" };

function totals(items: Item[]) {
  const t: Record<Brand, Record<Status, number>> = {
    heineken: { plugado: 0, fechado: 0, vazio: 0 },
    amstel: { plugado: 0, fechado: 0, vazio: 0 },
  };
  items.forEach((i) => { t[i.brand][i.status] += i.quantidade; });
  return t;
}

type HourFilter = "all" | "madrugada" | "manha" | "tarde" | "noite" | "t1" | "t2" | "t3";
const HOUR_OPTIONS: { v: HourFilter; label: string }[] = [
  { v: "all", label: "Qualquer hora" },
  { v: "madrugada", label: "Madrugada (0-6h)" },
  { v: "manha", label: "Manhã (6-12h)" },
  { v: "tarde", label: "Tarde (12-18h)" },
  { v: "noite", label: "Noite (18-24h)" },
  { v: "t1", label: "Turno 1 (7-19h)" },
  { v: "t2", label: "Turno 2 (10-22h)" },
  { v: "t3", label: "Turno 3 (13-1h)" },
];
function inHour(h: number, f: HourFilter) {
  switch (f) {
    case "all": return true;
    case "madrugada": return h >= 0 && h < 6;
    case "manha": return h >= 6 && h < 12;
    case "tarde": return h >= 12 && h < 18;
    case "noite": return h >= 18 && h < 24;
    case "t1": return h >= 7 && h < 19;
    case "t2": return h >= 10 && h < 22;
    case "t3": return h >= 13 || h < 1;
  }
}

function InventariosHistorico() {
  const [barFilter, setBarFilter] = useState<string>("all");
  const [range, setRange] = useState<"7" | "30" | "all">("30");
  const [dayFilter, setDayFilter] = useState<string>("");
  const [hourFilter, setHourFilter] = useState<HourFilter>("all");
  const [detailOpen, setDetailOpen] = useState<Inv | null>(null);

  const { data: bars = [] } = useQuery({
    queryKey: ["inv-hist-bars"],
    queryFn: async () => {
      const { data } = await supabase.from("bars").select("id,name").order("name");
      return data ?? [];
    },
  });

  const { data: invs = [], isLoading } = useQuery({
    queryKey: ["inv-hist", barFilter, range],
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<Inv[]> => {
      let q = supabase
        .from("inventories")
        .select("id,bar_id,performed_at,photo_url,notes,performed_by,bars(name),inventory_items(brand,status,quantidade)")
        .order("performed_at", { ascending: false })
        .limit(200);
      if (barFilter !== "all") q = q.eq("bar_id", barFilter);
      if (range !== "all") {
        const since = new Date();
        since.setDate(since.getDate() - Number(range));
        q = q.gte("performed_at", since.toISOString());
      }
      const { data, error } = await q;
      if (error) throw error;
      const rows = data ?? [];
      const userIds = Array.from(new Set(rows.map((r: any) => r.performed_by).filter(Boolean)));
      let profMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id,display_name,username").in("id", userIds);
        (profs ?? []).forEach((p: any) => { profMap[p.id] = p.display_name ?? p.username ?? null; });
      }
      return rows.map((r: any) => ({
        id: r.id,
        bar_id: r.bar_id,
        performed_at: r.performed_at,
        photo_url: r.photo_url,
        notes: r.notes,
        performed_by: r.performed_by,
        bar_name: r.bars?.name ?? "—",
        operator: profMap[r.performed_by] ?? null,
        items: r.inventory_items ?? [],
      }));
    },
  });

  const knownIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!invs.length) return;
    const ids = new Set(invs.map((i) => i.id));
    if (knownIdsRef.current === null) {
      knownIdsRef.current = ids;
      return;
    }
    const news = invs.filter((i) => !knownIdsRef.current!.has(i.id));
    if (news.length > 0) {
      try {
        const AC = (window.AudioContext || (window as any).webkitAudioContext);
        if (AC) {
          const ctx = new AC();
          const now = ctx.currentTime;
          [880, 1175, 1480].forEach((freq, i) => {
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
          setTimeout(() => ctx.close().catch(() => {}), 900);
        }
      } catch {}
      toast.success(`📋 ${news.length} novo(s) inventário(s)`, {
        description: news.slice(0, 3).map((n) => n.bar_name).join(", "),
        duration: 8000,
      });
      knownIdsRef.current = ids;
    }
  }, [invs]);


  const filteredInvs = useMemo(() => {
    return invs.filter((inv) => {
      const dt = new Date(inv.performed_at);
      if (dayFilter) {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const d = String(dt.getDate()).padStart(2, "0");
        if (`${y}-${m}-${d}` !== dayFilter) return false;
      }
      if (!inHour(dt.getHours(), hourFilter)) return false;
      return true;
    });
  }, [invs, dayFilter, hourFilter]);

  const photoPaths = useMemo(() => Array.from(new Set(filteredInvs.map((i) => i.photo_url).filter(Boolean))), [filteredInvs]);
  const { data: signedMap = {} } = useQuery({
    queryKey: ["inv-hist-signed", photoPaths],
    enabled: photoPaths.length > 0,
    queryFn: async () => {
      const { data } = await supabase.storage.from("operacao-fotos").createSignedUrls(photoPaths, 60 * 60);
      const map: Record<string, string> = {};
      (data ?? []).forEach((d: any) => { if (d.path && d.signedUrl) map[d.path] = d.signedUrl; });
      return map;
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 space-y-4">
      <header className="flex items-center gap-3">
        <ClipboardCheck className="w-6 h-6 text-primary" />
        <div>
          <h1 className="font-display text-xl tracking-wider">HISTÓRICO DE INVENTÁRIOS</h1>
          <p className="text-[11px] text-muted-foreground tracking-widest uppercase">
            Fotos, horários e contagens de cada inventário registrado
          </p>
        </div>
      </header>

      {invs.length > 0 && (() => {
        const last = invs[0];
        const dt = new Date(last.performed_at);
        return (
          <Card className="p-3 border-l-4 border-l-primary bg-primary/5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Último inventário registrado</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-display text-lg">{dt.toLocaleDateString("pt-BR")} · {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              <span className="text-sm text-muted-foreground">por <b className="text-foreground">{last.operator ?? "—"}</b></span>
            </div>
          </Card>
        );
      })()}

      <Card className="p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-[11px] font-display tracking-widest text-muted-foreground">FILTROS</span>
        </div>
        <select
          className="border rounded px-2 py-1.5 text-sm bg-background"
          value={barFilter}
          onChange={(e) => setBarFilter(e.target.value)}
        >
          <option value="all">Todos os bares</option>
          {bars.map((b: any) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {(["7", "30", "all"] as const).map((r) => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>
              {r === "all" ? "Tudo" : `${r} dias`}
            </Button>
          ))}
        </div>
        <input
          type="date"
          className="border rounded px-2 py-1.5 text-sm bg-background"
          value={dayFilter}
          onChange={(e) => setDayFilter(e.target.value)}
        />
        {dayFilter && (
          <Button size="sm" variant="ghost" onClick={() => setDayFilter("")}>Limpar dia</Button>
        )}
        <select
          className="border rounded px-2 py-1.5 text-sm bg-background"
          value={hourFilter}
          onChange={(e) => setHourFilter(e.target.value as HourFilter)}
        >
          {HOUR_OPTIONS.map((o) => (
            <option key={o.v} value={o.v}>{o.label}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{filteredInvs.length} registro(s)</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const rows = filteredInvs.flatMap((inv) => {
              const dt = new Date(inv.performed_at);
              const t = totals(inv.items);
              return (["heineken", "amstel"] as Brand[]).flatMap((br) =>
                (["plugado", "fechado", "vazio"] as Status[]).map((st) => ({
                  data: dt.toLocaleDateString("pt-BR"),
                  hora: dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                  bar: inv.bar_name,
                  operador: inv.operator ?? "",
                  marca: BRAND_LABEL[br],
                  status: STATUS_LABEL[st],
                  quantidade: t[br][st],
                  observacoes: inv.notes ?? "",
                }))
              );
            });
            downloadCsv(`inventarios-${timestampSlug()}.csv`, rows);
          }}
        >
          <Download className="w-4 h-4 mr-1" /> CSV
        </Button>
      </Card>

      {isLoading && (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
                <div className="h-3 w-16 bg-muted/70 animate-pulse rounded" />
              </div>
              <div className="h-32 w-full bg-muted animate-pulse rounded" />
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-10 bg-muted animate-pulse rounded" />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && filteredInvs.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum inventário encontrado para o filtro selecionado.
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {filteredInvs.map((inv) => {
          const t = totals(inv.items);
          const signed = signedMap[inv.photo_url];
          const dt = new Date(inv.performed_at);
          const vazioTotal = t.heineken.vazio + t.amstel.vazio;
          return (
            <Card key={inv.id} className="overflow-hidden hover:shadow-md transition cursor-pointer" onClick={() => setDetailOpen(inv)}>
              <div className="flex">
                <div className="relative w-32 h-32 shrink-0 bg-muted overflow-hidden">
                  {signed ? (
                    <img src={signed} alt="Foto inventário" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-muted-foreground">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-sm truncate flex items-center gap-1">
                        {inv.bar_name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {dt.toLocaleDateString("pt-BR")} · {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {inv.operator && <> · {inv.operator}</>}
                      </div>
                    </div>
                    {vazioTotal > 0 && (
                      <Badge variant="outline" className="text-[9px] border-orange-400 text-orange-700 bg-orange-50 shrink-0">
                        {vazioTotal} vazio(s)
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {(["heineken", "amstel"] as Brand[]).map((br) => (
                      <div key={br} className="rounded border p-1.5">
                        <div className="text-[10px] font-display tracking-widest text-muted-foreground">{BRAND_LABEL[br]}</div>
                        <div className="flex gap-2 text-[11px] mt-0.5">
                          <StatusNum label="Plug" v={t[br].plugado} color="text-primary" />
                          <StatusNum label="Fech" v={t[br].fechado} color="text-accent" />
                          <StatusNum label="Vaz" v={t[br].vazio} color="text-orange-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!detailOpen} onOpenChange={(o) => !o && setDetailOpen(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
          {detailOpen && (() => {
            const inv = detailOpen;
            const t = totals(inv.items);
            const signed = signedMap[inv.photo_url];
            const dt = new Date(inv.performed_at);
            const grand = {
              plugado: t.heineken.plugado + t.amstel.plugado,
              fechado: t.heineken.fechado + t.amstel.fechado,
              vazio: t.heineken.vazio + t.amstel.vazio,
            };
            return (
              <>
                <DialogHeader className="p-4 pb-2 border-b">
                  <DialogTitle className="font-display tracking-wider text-lg">{inv.bar_name}</DialogTitle>
                  <div className="text-xs text-muted-foreground">
                    {dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} · {dt.toLocaleTimeString("pt-BR")}
                    {inv.operator && <> · Operador: <b>{inv.operator}</b></>}
                  </div>
                </DialogHeader>
                <div className="grid md:grid-cols-2 gap-0">
                  <div className="bg-muted/30 p-3 flex items-center justify-center min-h-[280px]">
                    {signed ? (
                      <a href={signed} target="_blank" rel="noopener noreferrer">
                        <img src={signed} alt="Inventário" className="max-h-[70vh] w-auto rounded shadow" />
                      </a>
                    ) : (
                      <div className="text-muted-foreground text-sm flex flex-col items-center gap-2">
                        <ImageIcon className="w-10 h-10" />
                        Sem foto registrada
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <SummaryTile label="Plugado" value={grand.plugado} color="text-primary" />
                      <SummaryTile label="Fechado" value={grand.fechado} color="text-accent" />
                      <SummaryTile label="Vazio" value={grand.vazio} color="text-orange-600" />
                    </div>
                    <div className="space-y-2">
                      {(["heineken", "amstel"] as Brand[]).map((br) => {
                        const brandTotal = t[br].plugado + t[br].fechado + t[br].vazio;
                        return (
                          <div key={br} className="rounded-lg border p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-display tracking-widest text-sm">{BRAND_LABEL[br]}</div>
                              <div className="text-[10px] text-muted-foreground">Total: <b>{brandTotal}</b></div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              {(["plugado", "fechado", "vazio"] as Status[]).map((st) => (
                                <div key={st} className="rounded bg-muted/40 py-2">
                                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{STATUS_LABEL[st]}</div>
                                  <div className={`font-display text-xl ${t[br][st] > 0 ? (st === "plugado" ? "text-primary" : st === "fechado" ? "text-accent" : "text-orange-600") : "text-muted-foreground"}`}>{t[br][st]}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {inv.notes && (
                      <div className="rounded-lg border bg-muted/20 p-3">
                        <div className="text-[10px] font-display tracking-widest text-muted-foreground mb-1">OBSERVAÇÕES</div>
                        <p className="text-sm whitespace-pre-wrap">{inv.notes}</p>
                      </div>
                    )}
                    <Link
                      to="/app/bars/$barId"
                      params={{ barId: inv.bar_id }}
                      search={{ tab: "inventario" }}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Abrir bar <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl ${value > 0 ? color : "text-muted-foreground"}`}>{value}</div>
    </div>
  );
}

function StatusNum({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <span className="flex items-center gap-0.5">
      <span className="text-[9px] text-muted-foreground uppercase">{label}</span>
      <b className={`font-display ${v > 0 ? color : "text-muted-foreground"}`}>{v}</b>
    </span>
  );
}
