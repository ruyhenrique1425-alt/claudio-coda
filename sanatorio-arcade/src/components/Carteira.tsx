import { useEffect, useState } from "react";
import { Coins } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lerCarteira, type Carteira as Saldo } from "@/lib/pontos";

/**
 * Saldo e ganhos do paciente. Ouve a tabela de transações para o número se
 * mexer sozinho quando alguém doa, aposta ou manda uma prenda.
 */
export function Carteira({
  pacienteId,
  compacta = false,
}: {
  pacienteId: string;
  compacta?: boolean;
}) {
  const [saldo, setSaldo] = useState<Saldo | null>(null);

  useEffect(() => {
    let ativo = true;
    const puxar = () => {
      void lerCarteira(pacienteId)
        .then((s) => ativo && setSaldo(s))
        .catch(() => undefined);
    };
    puxar();

    const canal = supabase
      .channel(`carteira-${pacienteId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transacoes" }, puxar)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gastos" }, puxar)
      .subscribe();

    return () => {
      ativo = false;
      void supabase.removeChannel(canal);
    };
  }, [pacienteId]);

  if (compacta) {
    return (
      <span className="font-arcade inline-flex items-center gap-1 text-[9px] text-whisky">
        <Coins className="h-3.5 w-3.5" aria-hidden />
        {saldo?.saldo ?? "--"}
      </span>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-sm border-2 border-whisky/70 bg-card/50 px-3 py-2 text-center">
        <p className="font-arcade text-[7px] uppercase text-muted-foreground">Fichas</p>
        <p className="font-arcade mt-1 text-base text-whisky text-glow">{saldo?.saldo ?? "--"}</p>
      </div>
      <div className="rounded-sm border-2 border-neon/60 bg-card/50 px-3 py-2 text-center">
        <p className="font-arcade text-[7px] uppercase text-muted-foreground">Ganhos</p>
        <p className="font-arcade mt-1 text-base text-neon text-glow">{saldo?.ganhos ?? "--"}</p>
      </div>
    </div>
  );
}
