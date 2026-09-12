import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { CONQUISTAS, lerPendentes, TOTAL_CONQUISTAS } from "@/lib/conquistas";
import { online } from "@/lib/rede";

const SELOS: Record<string, string> = {
  bemvindo: "🎴",
  van: "🚐",
  bar: "🍺",
  xeque: "♛",
  privada: "🚽",
};

/**
 * Inventário de sobrevivência: as cinco conquistas de QR code.
 *
 * Os códigos achados vêm das transações de motivo 'qrcode'. Sem sinal, cai
 * para o que está guardado no aparelho, então a tela nunca fica vazia.
 */
export function Inventario({ pacienteId }: { pacienteId: string }) {
  const [achados, setAchados] = useState<string[]>([]);

  useEffect(() => {
    const locais = lerPendentes() as string[];
    setAchados(locais);

    if (!online()) return;
    void supabase
      .from("transacoes")
      .select("referencia")
      .eq("para_paciente", pacienteId)
      .eq("motivo", "qrcode")
      .then(({ data }) => {
        const doBanco = (data ?? []).map((t) => t.referencia).filter((r): r is string => !!r);
        setAchados((atuais) => [...new Set([...atuais, ...doBanco])]);
      });
  }, [pacienteId]);

  return (
    <div className="mt-4 rounded-sm border-2 border-whisky/60 bg-card/40 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-arcade text-[8px] uppercase text-muted-foreground">
          Inventário de sobrevivência
        </p>
        <p className="font-arcade text-[9px] text-whisky">
          {achados.length}/{TOTAL_CONQUISTAS}
        </p>
      </div>

      <ul className="mt-4 grid grid-cols-5 gap-2">
        {CONQUISTAS.map((c) => {
          const tem = achados.includes(c.codigo);
          return (
            <li key={c.codigo}>
              <div
                title={tem ? c.titulo : `Escondido: ${c.ondeFica}`}
                className={`grid aspect-square place-items-center rounded-sm border-2 text-lg ${
                  tem
                    ? "border-whisky bg-whisky/15 shadow-[0_0_14px_-4px_var(--whisky)]"
                    : "border-muted-foreground/30 bg-background/60 opacity-45"
                }`}
              >
                {tem ? (
                  <span aria-hidden>{SELOS[c.codigo]}</span>
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
                )}
              </div>
              <p className="mt-1 text-center text-[8px] leading-tight text-muted-foreground">
                {tem ? c.titulo.split(" ")[0] : "???"}
              </p>
            </li>
          );
        })}
      </ul>

      {achados.length < TOTAL_CONQUISTAS ? (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Faltam {TOTAL_CONQUISTAS - achados.length}. Estão espalhados pela festa — e um deles saiu
          antes, no Instagram da Sanatório.
        </p>
      ) : (
        <p className="mt-3 text-[11px] leading-relaxed text-whisky">
          Cinco de cinco. Você vasculhou até o banheiro.
        </p>
      )}
    </div>
  );
}
