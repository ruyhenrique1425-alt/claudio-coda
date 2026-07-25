import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarsMap } from "@/components/BarsMap";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

export const Route = createFileRoute("/app/map")({
  component: MapView,
});

const TYPE_LABEL: Record<string, string> = {
  bar_venda: "Bar venda",
  bar_parceiro: "Bar parceiro",
  camarote: "Camarote",
  stand: "Stand",
  haras: "Haras",
};

function MapView() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [focusedBarId, setFocusedBarId] = useState<string | null>(null);
  const { data: bars = [], isLoading } = useQuery({
    queryKey: ["bars"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bars")
        .select("id,name,bar_type,latitude,longitude,apoio_responsavel")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return bars as any[];
    return (bars as any[]).filter((b) => {
      const type = TYPE_LABEL[b.bar_type] ?? b.bar_type ?? "";
      return (
        (b.name ?? "").toLowerCase().includes(term) ||
        (b.apoio_responsavel ?? "").toLowerCase().includes(term) ||
        type.toLowerCase().includes(term)
      );
    });
  }, [bars, q]);

  const focusThenGo = (id: string) => {
    const b = (bars as any[]).find((x) => x.id === id);
    if (!b) return;
    setFocusedBarId(id);
    window.setTimeout(() => {
      if (b.bar_type !== "bar_venda" && b.bar_type !== "bar_parceiro") {
        nav({ to: "/app/manutencao/$barId", params: { barId: id } });
      } else {
        nav({ to: "/app/bars/$barId", params: { barId: id }, search: { tab: "inventario" } });
      }
    }, 1100);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="h-[calc(100vh-140px)]">
        <BarsMap
          bars={filtered as any}
          focusedBarId={focusedBarId}
          onSelectBar={focusThenGo}
        />
      </div>
      <div className="space-y-2 overflow-auto max-h-[calc(100vh-140px)] pr-1">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm tracking-widest text-muted-foreground">
            BARES ({filtered.length}
            {q.trim() ? `/${bars.length}` : ""})
          </h2>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar bar, apoio ou tipo…"
            className="pl-8 pr-8 h-9"
            aria-label="Buscar bar"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && bars.length === 0 && (
          <Card className="p-4 text-sm text-muted-foreground">Nenhum bar cadastrado.</Card>
        )}
        {!isLoading && bars.length > 0 && filtered.length === 0 && (
          <Card className="p-4 text-sm text-muted-foreground">
            Nenhum bar encontrado para “{q}”.
          </Card>
        )}
        {(filtered as any[]).map((b) => (
          <Card
            key={b.id}
            onClick={() => focusThenGo(b.id)}
            className={`p-3 cursor-pointer hover:border-primary transition ${focusedBarId === b.id ? "border-primary ring-1 ring-primary/40" : ""}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-display text-sm">{b.name}</div>
              <Badge variant="outline" className="text-[10px]">
                {TYPE_LABEL[b.bar_type]}
              </Badge>
            </div>
            {b.apoio_responsavel && (
              <div className="text-xs text-muted-foreground mt-1">Apoio: {b.apoio_responsavel}</div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
