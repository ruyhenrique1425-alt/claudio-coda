import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, PackageOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  BAR_TYPES_OPERACAO,
  piorSeveridade,
  severidadePorCheios,
  recolhidosAposInventario,
  vaziosARecolher,
  type Severity,
} from "@/lib/operacao";

export const BRANDS = ["heineken", "amstel"] as const;
export type Brand = (typeof BRANDS)[number];
export const ESTADOS = ["plugado", "fechado", "vazio"] as const;
export type Estado = (typeof ESTADOS)[number];
export const ESTADO_LABEL: Record<Estado, string> = {
  plugado: "Plugado",
  fechado: "Fechado",
  vazio: "Vazio",
};
export const TEMP_SLOTS = [
  { v: "t_11", l: "11h", hour: 11 },
  { v: "t_17", l: "17h", hour: 17 },
  { v: "t_22", l: "22h", hour: 22 },
] as const;

export const BRAND_LABEL: Record<Brand, string> = { heineken: "Heineken", amstel: "Amstel" };
export const BRAND_ACCENT: Record<Brand, { bg: string; text: string; dot: string }> = {
  heineken: {
    bg: "bg-emerald-50 border-emerald-300",
    text: "text-emerald-800",
    dot: "bg-emerald-600",
  },
  amstel: { bg: "bg-amber-50 border-amber-300", text: "text-amber-800", dot: "bg-amber-600" },
};

export type BarRow = {
  id: string;
  name: string;
  apoio_responsavel: string | null;
  standards: Record<Brand, number>;
  cheios: Record<Brand, number>;
  consumidos: Record<Brand, number>;
  estados: Record<Brand, Record<Estado, number>>;
  vaziosReais: Record<Brand, number>;
  needed: Record<Brand, number>;
  fillByBrand: Record<Brand, number>;
  sevByBrand: Record<Brand, Severity>;
  totalNeeded: number;
  totalStandard: number;
  totalCheios: number;
  fillPct: number;
  severity: Severity;
  hasInventory: boolean;
  lastAt: string | null;
  lastBy: string | null;
  tempsToday: Record<string, { temperatura: number } | null>;
  orgToday: boolean;
  bestTempToday: number | null;
  bestTempPhoto: string | null;
  bestTempAt: string | null;
  bestTempSlot: string | null;
  worstTempToday: number | null;
};

export const worst = (a: Severity, b: Severity): Severity => piorSeveridade(a, b);

export const SEVERITY_STYLES: Record<
  Exclude<Severity, "ok">,
  {
    label: string;
    border: string;
    bg: string;
    text: string;
    badgeBg: string;
    badgeText: string;
    pillBg: string;
    pillText: string;
  }
> = {
  medium: {
    label: "Atenção",
    border: "border-yellow-400",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    badgeBg: "bg-yellow-400",
    badgeText: "text-yellow-950",
    pillBg: "bg-yellow-100",
    pillText: "text-yellow-700",
  },
  high: {
    label: "Urgente",
    border: "border-orange-500",
    bg: "bg-orange-50",
    text: "text-orange-700",
    badgeBg: "bg-orange-500",
    badgeText: "text-white",
    pillBg: "bg-orange-100",
    pillText: "text-orange-700",
  },
  critical: {
    label: "Crítico",
    border: "border-red-600",
    bg: "bg-red-50",
    text: "text-red-700",
    badgeBg: "bg-red-600",
    badgeText: "text-white",
    pillBg: "bg-red-100",
    pillText: "text-red-700",
  },
};

export function isToday(iso: string | null | undefined) {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

export function useBarsRows() {
  return useQuery({
    queryKey: ["dashboard-v2"],
    queryFn: async (): Promise<BarRow[]> => {
      const { data: bars, error } = await supabase
        .from("bars")
        .select("id,name,apoio_responsavel")
        .in("bar_type", [...BAR_TYPES_OPERACAO])
        .order("name");
      if (error) throw error;
      if (!bars?.length) return [];
      const ids = bars.map((b) => b.id);

      const [{ data: stds }, { data: invs }, { data: temps }, { data: orgs }, { data: emps }] =
        await Promise.all([
        supabase.from("bar_stock_standard").select("*").in("bar_id", ids),
        supabase
          .from("inventories")
          .select("id,bar_id,performed_at,performed_by,inventory_items(brand,status,quantidade)")
          .in("bar_id", ids)
          .order("performed_at", { ascending: false }),
        supabase
          .from("bar_temperature_checks")
          .select("bar_id,slot,temperatura,performed_at,photo_url")
          .in("bar_id", ids)
          .order("performed_at", { ascending: false }),
        supabase
          .from("bar_organization_checks")
          .select("bar_id,performed_at,copo_ok,meninas_ok,limpo_ok,sem_fila_ok")
          .in("bar_id", ids)
          .order("performed_at", { ascending: false }),
        // Sem filtro de período: serve para descontar da foto do inventário
        // o que já foi recolhido depois dela (recolher não reescreve o
        // inventário). Ver lib/operacao.
        supabase
          .from("empties_removed")
          .select("bar_id,brand,quantidade,performed_at")
          .in("bar_id", ids),
      ]);

      const lastInv = new Map<string, any>();
      (invs ?? []).forEach((i: any) => {
        if (!lastInv.has(i.bar_id)) lastInv.set(i.bar_id, i);
      });

      const invAtPorBar = new Map<string, string | null>();
      lastInv.forEach((inv, barId) => invAtPorBar.set(barId, inv?.performed_at ?? null));
      const recolhidosApos = recolhidosAposInventario((emps ?? []) as any, invAtPorBar);

      const userIds = Array.from(
        new Set(
          Array.from(lastInv.values())
            .map((i: any) => i.performed_by)
            .filter(Boolean),
        ),
      );
      const profMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,display_name,username")
          .in("id", userIds);
        (profs ?? []).forEach((p: any) => {
          profMap[p.id] = p.display_name ?? p.username ?? null;
        });
      }

      return bars.map((b) => {
        const standards: Record<Brand, number> = { heineken: 0, amstel: 0 };
        (stds ?? [])
          .filter((s: any) => s.bar_id === b.id)
          .forEach((s: any) => {
            standards[s.brand as Brand] = s.barris_padrao;
          });
        const inv = lastInv.get(b.id);
        const cheios: Record<Brand, number> = { heineken: 0, amstel: 0 };
        const vaziosRaw: Record<Brand, number> = { heineken: 0, amstel: 0 };
        const estados: Record<Brand, Record<Estado, number>> = {
          heineken: { plugado: 0, fechado: 0, vazio: 0 },
          amstel: { plugado: 0, fechado: 0, vazio: 0 },
        };
        (inv?.inventory_items ?? []).forEach((it: any) => {
          const br = it.brand as Brand;
          const st = it.status as Estado;
          if (estados[br] && st in estados[br]) estados[br][st] += it.quantidade ?? 0;
          if (
            (it.status === "plugado" || it.status === "fechado") &&
            cheios[it.brand as Brand] !== undefined
          ) {
            cheios[it.brand as Brand] += it.quantidade;
          }
          if (it.status === "vazio" && vaziosRaw[it.brand as Brand] !== undefined) {
            vaziosRaw[it.brand as Brand] += it.quantidade;
          }
        });
        // Desconta o que já foi recolhido depois da foto do inventário.
        BRANDS.forEach((br) => {
          estados[br].vazio = vaziosARecolher(estados[br].vazio, b.id, br, recolhidosApos);
          vaziosRaw[br] = estados[br].vazio;
        });
        // Sem teto no padrão (Math.min subestimava quem passou do padrão).
        const consumidos: Record<Brand, number> = {
          heineken: vaziosRaw.heineken,
          amstel: vaziosRaw.amstel,
        };
        const needed: Record<Brand, number> = {
          heineken: Math.max(0, standards.heineken - cheios.heineken),
          amstel: Math.max(0, standards.amstel - cheios.amstel),
        };

        const tempsToday: Record<string, { temperatura: number } | null> = {
          t_11: null,
          t_17: null,
          t_22: null,
        };
        let best: number | null = null;
        let bestPhoto: string | null = null;
        let bestAt: string | null = null;
        let bestSlot: string | null = null;
        let worstT: number | null = null;
        (temps ?? [])
          .filter((t: any) => t.bar_id === b.id && isToday(t.performed_at))
          .forEach((t: any) => {
            if (!tempsToday[t.slot]) tempsToday[t.slot] = { temperatura: Number(t.temperatura) };
            const tv = Number(t.temperatura);
            if (best === null || tv < best) {
              best = tv;
              bestPhoto = t.photo_url ?? null;
              bestAt = t.performed_at ?? null;
              bestSlot = t.slot ?? null;
            }
            if (worstT === null || tv > worstT) worstT = tv;
          });

        const orgToday = (orgs ?? []).some(
          (o: any) =>
            o.bar_id === b.id &&
            isToday(o.performed_at) &&
            o.copo_ok &&
            o.meninas_ok &&
            o.limpo_ok &&
            o.sem_fila_ok,
        );

        const totalStandard = standards.heineken + standards.amstel;
        const totalCheios = cheios.heineken + cheios.amstel;
        const fillPct = totalStandard > 0 ? Math.round((totalCheios / totalStandard) * 100) : 100;
        const fillByBrand: Record<Brand, number> = {
          heineken:
            standards.heineken > 0 ? Math.round((cheios.heineken / standards.heineken) * 100) : 100,
          amstel: standards.amstel > 0 ? Math.round((cheios.amstel / standards.amstel) * 100) : 100,
        };
        const sevByBrand: Record<Brand, Severity> = inv
          ? {
              heineken: severidadePorCheios(cheios.heineken, standards.heineken),
              amstel: severidadePorCheios(cheios.amstel, standards.amstel),
            }
          : { heineken: "ok", amstel: "ok" };
        const severity: Severity = inv ? worst(sevByBrand.heineken, sevByBrand.amstel) : "ok";

        return {
          id: b.id,
          name: b.name,
          apoio_responsavel: b.apoio_responsavel,
          standards,
          cheios,
          consumidos,
          estados,
          vaziosReais: vaziosRaw,
          needed,
          fillByBrand,
          sevByBrand,
          totalNeeded: needed.heineken + needed.amstel,
          totalStandard,
          totalCheios,
          fillPct,
          severity,
          hasInventory: !!inv,
          lastAt: inv?.performed_at ?? null,
          lastBy: inv?.performed_by ? (profMap[inv.performed_by] ?? null) : null,
          tempsToday,
          orgToday,
          bestTempToday: best,
          bestTempPhoto: bestPhoto,
          bestTempAt: bestAt,
          bestTempSlot: bestSlot,
          worstTempToday: worstT,
        };
      });
    },
  });
}

export function BrandChip({
  brand,
  need,
  fill,
  sev,
}: {
  brand: Brand;
  need: number;
  fill: number;
  sev: Severity;
}) {
  const s = sev !== "ok" ? SEVERITY_STYLES[sev] : null;
  const cls = s
    ? `${s.pillBg} ${s.pillText} border ${s.border}`
    : "bg-primary/10 text-primary border border-primary/20";
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-display tracking-wide ${cls}`}
    >
      <span className="font-bold">{BRAND_LABEL[brand]}</span>
      <span>{fill}%</span>
      {need > 0 && <span>· repor {need}</span>}
    </span>
  );
}

export function StatePill({
  state,
  severity,
  count,
}: {
  state: "ok" | "refill" | "no_inv";
  severity: Severity;
  count: number;
}) {
  if (state === "no_inv")
    return (
      <div className="w-12 h-12 shrink-0 rounded-full grid place-items-center bg-destructive/15 text-destructive">
        <AlertTriangle className="w-5 h-5" />
      </div>
    );
  if (state === "refill" && severity !== "ok") {
    const s = SEVERITY_STYLES[severity];
    return (
      <div
        className={`w-12 h-12 shrink-0 rounded-full grid place-items-center ${s.pillBg} ${s.pillText}`}
      >
        <div className="flex flex-col items-center leading-none">
          <PackageOpen className="w-4 h-4" />
          <span className="font-display text-sm mt-0.5">{count}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="w-12 h-12 shrink-0 rounded-full grid place-items-center bg-primary/15 text-primary">
      <CheckCircle2 className="w-5 h-5" />
    </div>
  );
}
