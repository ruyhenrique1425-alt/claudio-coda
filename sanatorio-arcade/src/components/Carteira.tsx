import { useEffect, useState } from "react";
import { Coins, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lerCarteira, type Carteira as Saldo } from "@/lib/pontos";
import { canalQuandoDerVerifica } from "@/lib/realtime";

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

    // Cada listener filtrado por este paciente: sem o filtro, a ficha de
    // qualquer pessoa na festa reabria a consulta de saldo de todo mundo ao
    // mesmo tempo — dezenas de celulares relendo a carteira a cada clique
    // alheio.
    const pararCanal = canalQuandoDerVerifica(
      () =>
        supabase
          .channel(`carteira-${pacienteId}-${crypto.randomUUID()}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "transacoes",
              filter: `para_paciente=eq.${pacienteId}`,
            },
            puxar,
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "transacoes",
              filter: `de_paciente=eq.${pacienteId}`,
            },
            puxar,
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "gastos",
              filter: `paciente_id=eq.${pacienteId}`,
            },
            puxar,
          )
          .subscribe(),
      (canal) => void supabase.removeChannel(canal),
      puxar,
    );

    return () => {
      ativo = false;
      pararCanal();
    };
  }, [pacienteId]);

  if (compacta) {
    // Mesma dupla de baixo: moedas (o que dá para gastar) e XP (o que conta
    // para o ranking). A cor de cada uma é a mesma da versão cheia — quem já
    // olhou a ficha reconhece na hora qual é qual.
    return (
      <span className="flex items-center gap-2">
        <span
          className="font-arcade inline-flex items-center gap-1 text-[9px] text-whisky"
          title="Fichas — o que você pode gastar na loja e nos desafios"
        >
          <Coins className="h-3.5 w-3.5" aria-hidden />
          {saldo?.saldo ?? "--"}
        </span>
        <span
          className="font-arcade inline-flex items-center gap-1 text-[9px] text-neon"
          title="XP — o mesmo número que aparece no ranking"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {saldo?.ganhos ?? "--"}
        </span>
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
