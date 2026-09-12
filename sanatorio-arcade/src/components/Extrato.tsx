import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lerExtrato, type Movimento } from "@/lib/pontos";
import { canalQuandoDerVerifica } from "@/lib/realtime";

const MOTIVOS: Record<string, string> = {
  jogo: "Arcade",
  qrcode: "QR do bar",
  aposta: "Desafio",
  doacao: "Doação",
  prenda: "Prenda",
};

/** Últimas movimentações de fichas do paciente. */
export function Extrato({ pacienteId }: { pacienteId: string }) {
  const [linhas, setLinhas] = useState<Movimento[]>([]);

  const puxar = useCallback(() => {
    void lerExtrato(pacienteId)
      .then(setLinhas)
      .catch(() => undefined);
  }, [pacienteId]);

  useEffect(() => {
    puxar();
    return canalQuandoDerVerifica(
      () =>
        supabase
          .channel(`extrato-${pacienteId}-${crypto.randomUUID()}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "transacoes" }, puxar)
          .subscribe(),
      (canal) => void supabase.removeChannel(canal),
      puxar,
    );
  }, [pacienteId, puxar]);

  if (linhas.length === 0) return null;

  return (
    <div className="mt-4 rounded-sm border-2 border-neon/40 bg-card/40 p-3">
      <p className="font-arcade text-[8px] uppercase text-muted-foreground">Extrato de fichas</p>
      <ul className="mt-3 space-y-1.5">
        {linhas.map((m) => {
          const entrada = m.para_paciente === pacienteId;
          return (
            <li
              key={m.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/40 pb-1.5 last:border-0"
            >
              {entrada ? (
                <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-neon" />
              ) : (
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-destructive" />
              )}
              <span className="truncate text-[11px] text-muted-foreground">
                {MOTIVOS[m.motivo] ?? m.motivo}
              </span>
              <span
                className={`font-arcade shrink-0 text-[9px] ${entrada ? "text-neon" : "text-destructive"}`}
              >
                {entrada ? "+" : "−"}
                {m.pontos}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
