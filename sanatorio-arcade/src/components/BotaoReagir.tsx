import { useState } from "react";
import { Heart } from "lucide-react";
import { motion } from "motion/react";

import { reagir, type TipoItemReacao } from "@/lib/reacoes";

/** Coração de curtida, com contagem. Otimista: reage na hora, desfaz se o servidor recusar. */
export function BotaoReagir({
  tipo,
  itemId,
  contagemInicial,
  reagidoInicial,
  podeReagir,
}: {
  tipo: TipoItemReacao;
  itemId: string;
  contagemInicial: number;
  reagidoInicial: boolean;
  /** Sem ficha, sem token — o botão aparece desativado em vez de sumir. */
  podeReagir: boolean;
}) {
  const [reagido, setReagido] = useState(reagidoInicial);
  const [contagem, setContagem] = useState(contagemInicial);
  const [ocupado, setOcupado] = useState(false);

  async function alternar() {
    if (ocupado || !podeReagir) return;
    setOcupado(true);
    const antesReagido = reagido;
    const antesContagem = contagem;
    // Otimista: muda a tela antes da resposta do servidor.
    setReagido(!antesReagido);
    setContagem(antesReagido ? antesContagem - 1 : antesContagem + 1);
    try {
      await reagir(tipo, itemId);
    } catch {
      // Servidor recusou: desfaz.
      setReagido(antesReagido);
      setContagem(antesContagem);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void alternar()}
      disabled={!podeReagir}
      aria-label={reagido ? "Descurtir" : "Curtir"}
      className={`tap-44 flex items-center gap-1.5 rounded-sm px-2 py-1 transition-colors disabled:opacity-40 ${
        reagido ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      <motion.span
        key={reagido ? "cheio" : "vazio"}
        initial={{ scale: reagido ? 0.6 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
      >
        <Heart className="h-4 w-4" fill={reagido ? "currentColor" : "none"} />
      </motion.span>
      <span className="font-arcade text-[9px]">{contagem}</span>
    </button>
  );
}
