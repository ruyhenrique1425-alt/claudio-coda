import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, QrCode, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/r/t/$code")({
  component: QrTokenResolver,
  head: () => ({
    meta: [{ title: "Atendimento Dispel" }, { name: "robots", content: "noindex" }],
  }),
});

function QrTokenResolver() {
  const { code } = Route.useParams();
  const [state, setState] = useState<{ loading: boolean; barId: string | null; found: boolean }>({
    loading: true,
    barId: null,
    found: false,
  });

  useEffect(() => {
    supabase
      .from("qr_tokens")
      .select("bar_id")
      .eq("code", code)
      .maybeSingle()
      .then(({ data }) => {
        setState({ loading: false, barId: data?.bar_id ?? null, found: !!data });
      });
  }, [code]);

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (state.barId) {
    return <Navigate to="/r/$barId" params={{ barId: state.barId }} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-sm w-full p-6 text-center space-y-3">
        <QrCode className="w-10 h-10 mx-auto text-primary" />
        <div className="font-display text-xl tracking-wider">DISPEL · OPERAÇÃO</div>
        <div className="text-sm text-muted-foreground">Código do QR</div>
        <div className="font-mono text-lg font-bold">{code}</div>
        <div className="pt-2 border-t border-border">
          {state.found ? (
            <div className="text-sm text-yellow-600 flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              QR aguardando instalação
            </div>
          ) : (
            <div className="text-sm text-destructive flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              QR não encontrado
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Este QR ainda não foi vinculado a um ponto de choppeira. Informe o código{" "}
            <span className="font-bold">{code}</span> à equipe Dispel: (31) 99915-9662.
          </p>
        </div>
      </Card>
    </div>
  );
}
