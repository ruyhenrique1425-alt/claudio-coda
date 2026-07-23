import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarsMap } from "@/components/BarsMap";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="h-[calc(100vh-140px)]">
        <BarsMap
          bars={bars as any}
          onSelectBar={(id) => {
            const b = (bars as any[]).find((x) => x.id === id);
            if (b && b.bar_type !== "bar_venda" && b.bar_type !== "bar_parceiro") {
              nav({ to: "/app/manutencao/$barId", params: { barId: id } });
            } else {
              nav({ to: "/app/bars/$barId", params: { barId: id }, search: { tab: "inventario" } });
            }
          }}
        />
      </div>
      <div className="space-y-2 overflow-auto max-h-[calc(100vh-140px)] pr-1">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm tracking-widest text-muted-foreground">
            BARES ({bars.length})
          </h2>
        </div>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && bars.length === 0 && (
          <Card className="p-4 text-sm text-muted-foreground">Nenhum bar cadastrado.</Card>
        )}
        {(bars as any[]).map((b) => (
          <Card
            key={b.id}
            onClick={() =>
              nav({
                to: "/app/bars/$barId",
                params: { barId: b.id },
                search: { tab: "inventario" },
              })
            }
            className="p-3 cursor-pointer hover:border-primary transition"
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
