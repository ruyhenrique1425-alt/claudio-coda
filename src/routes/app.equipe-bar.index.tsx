import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CreditCard, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/app/equipe-bar/")({
  component: EquipeBarIndex,
});

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

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

function EquipeBarIndex() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  async function load() {
    setLoading(true);
    const [
      { data: bars },
      { data: readers },
      { data: sessions },
      { data: shifts },
      { data: checks },
    ] = await Promise.all([
      supabase
        .from("bars")
        .select("id,name,bar_type,apoio_responsavel")
        .in("bar_type", ["bar_venda", "bar_parceiro"])
        .order("name"),
      supabase.from("bar_card_readers").select("*"),
      supabase.from("bar_card_machine_sessions").select("*").eq("event_date", todayISO()),
      supabase.from("bar_shifts").select("bar_id,shift,meninas_qtd"),
      supabase
        .from("bar_staff_checks")
        .select("bar_id,checkpoint,meninas_count,performed_at")
        .gte("performed_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    ]);
    const readerMap: Record<string, number> = {};
    (readers ?? []).forEach((r: any) => (readerMap[r.bar_id] = r.quantidade ?? 0));
    const sessMap: Record<string, any[]> = {};
    (sessions ?? []).forEach((s: any) => {
      sessMap[s.bar_id] = sessMap[s.bar_id] ?? [];
      sessMap[s.bar_id].push(s);
    });
    const shiftMap: Record<string, Record<string, number>> = {};
    (shifts ?? []).forEach((s: any) => {
      shiftMap[s.bar_id] = shiftMap[s.bar_id] ?? {};
      shiftMap[s.bar_id][s.shift] = s.meninas_qtd ?? 0;
    });
    // último check por bar
    const lastCheckMap: Record<string, any> = {};
    (checks ?? []).forEach((c: any) => {
      const cur = lastCheckMap[c.bar_id];
      if (!cur || new Date(c.performed_at) > new Date(cur.performed_at)) lastCheckMap[c.bar_id] = c;
    });

    const active = activeShiftsAt(new Date());

    setRows(
      (bars ?? []).map((b: any) => {
        const list = sessMap[b.id] ?? [];
        const abertas = list.filter((s: any) => !s.returned_at);
        const barShifts = shiftMap[b.id] ?? {};
        const expectedMeninas = active.reduce((sum, s) => sum + (barShifts[s.key] ?? 0), 0);
        const lastCheck = lastCheckMap[b.id];
        const meninasEmCampo = lastCheck?.meninas_count ?? null;
        return {
          ...b,
          padrao: readerMap[b.id] ?? 0,
          pegas: list.length,
          ativas: abertas.length,
          devolvidas: list.filter((s: any) => !!s.returned_at).length,
          expectedMeninas,
          meninasEmCampo,
        };
      }),
    );
    setLoading(false);
  }
  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const active = activeShiftsAt(now);
  const totalExpectedMeninas = rows.reduce((s, r) => s + r.expectedMeninas, 0);
  const totalMeninasEmCampo = rows.reduce((s, r) => s + (r.meninasEmCampo ?? 0), 0);
  const totalPadrao = rows.reduce((s, r) => s + r.padrao, 0);
  const totalAtivas = rows.reduce((s, r) => s + r.ativas, 0);
  const totalPendentesRetirada = rows.reduce((s, r) => s + Math.max(0, r.padrao - r.pegas), 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <div className="flex items-center gap-3 mb-5">
        <Users className="w-6 h-6 text-accent" />
        <div>
          <h1 className="font-display text-2xl tracking-wider">EQUIPE DE BAR</h1>
          <p className="text-xs text-muted-foreground">
            Agora {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
            {active.length === 0
              ? "Fora de turno"
              : `Turnos: ${active.map((s) => s.label).join(" + ")}`}
          </p>
        </div>
      </div>

      {/* PROMOTORAS EM CAMPO */}
      <Card className="p-4 mb-3 border-accent/40">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-accent" />
          <h2 className="font-display text-sm tracking-widest text-muted-foreground">
            PROMOTORAS EM CAMPO
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-border p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Esperadas agora</div>
            <div className="font-display text-3xl text-primary">{totalExpectedMeninas}</div>
            <div className="text-[10px] text-muted-foreground">soma dos turnos ativos</div>
          </div>
          <div className="rounded border border-border p-3">
            <div className="text-[10px] uppercase text-muted-foreground">
              Registradas (último check)
            </div>
            <div
              className={`font-display text-3xl ${totalMeninasEmCampo >= totalExpectedMeninas ? "text-primary" : "text-destructive"}`}
            >
              {totalMeninasEmCampo}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {totalMeninasEmCampo >= totalExpectedMeninas
                ? "★ padrão ok"
                : `faltam ${Math.max(0, totalExpectedMeninas - totalMeninasEmCampo)}`}
            </div>
          </div>
        </div>
      </Card>

      {/* MAQUININHAS EM CAMPO */}
      <Card className="p-4 mb-4 border-accent/40">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-4 h-4 text-accent" />
          <h2 className="font-display text-sm tracking-widest text-muted-foreground">
            MAQUININHAS EM CAMPO
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded border border-border p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Padrão total</div>
            <div className="font-display text-2xl">{totalPadrao}</div>
          </div>
          <div className="rounded border border-border p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Em campo</div>
            <div className="font-display text-2xl text-primary">{totalAtivas}</div>
          </div>
          <div className="rounded border border-border p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Falta retirar</div>
            <div
              className={`font-display text-2xl ${totalPendentesRetirada > 0 ? "text-destructive" : "text-primary"}`}
            >
              {totalPendentesRetirada}
            </div>
          </div>
        </div>
      </Card>

      {loading && <div className="text-sm text-muted-foreground">Carregando…</div>}
      {!loading && rows.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum bar de venda cadastrado.
        </Card>
      )}

      <div className="space-y-2">
        {rows.map((r) => {
          const faltaRetirar = Math.max(0, r.padrao - r.pegas);
          const okMaq = r.padrao > 0 && r.ativas === r.padrao;
          const okProm = r.meninasEmCampo !== null && r.meninasEmCampo >= r.expectedMeninas;
          return (
            <Link key={r.id} to="/app/equipe-bar/$barId" params={{ barId: r.id }}>
              <Card className="p-3 hover:border-accent transition">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {r.meninasEmCampo ?? "—"}/{r.expectedMeninas}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        {r.ativas}/{r.padrao}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {r.expectedMeninas > 0 &&
                      (okProm ? (
                        <Badge className="bg-primary text-primary-foreground text-[9px]">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Prom.
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[9px]">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Prom.
                        </Badge>
                      ))}
                    {faltaRetirar > 0 ? (
                      <Badge variant="destructive" className="text-[9px]">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Maq. -{faltaRetirar}
                      </Badge>
                    ) : okMaq ? (
                      <Badge className="bg-primary text-primary-foreground text-[9px]">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Maq.
                      </Badge>
                    ) : null}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
