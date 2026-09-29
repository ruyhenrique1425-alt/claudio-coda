import { useEffect, useState } from "react";

import { formatarRestante } from "@/lib/datas";

/**
 * Contador regressivo em formato de painel de fliperama.
 *
 * O valor só é calculado depois que o componente monta no navegador. Se
 * calculasse durante o SSR, o relógio do servidor e o do celular dariam
 * números diferentes e o React reclamaria de hidratação a cada carregamento.
 */
export function ContagemRegressiva({
  ate,
  rotulo,
  className = "",
  aoZerar,
}: {
  ate: Date;
  rotulo?: string;
  className?: string;
  aoZerar?: () => void;
}) {
  const [restante, setRestante] = useState<number | null>(null);
  const alvo = ate.getTime();

  useEffect(() => {
    const atualizar = () => {
      const novo = alvo - Date.now();
      setRestante(novo);
      if (novo <= 0) aoZerar?.();
    };

    atualizar();
    const id = setInterval(atualizar, 1000);
    return () => clearInterval(id);
    // Depende do instante, não do objeto Date: um `new Date()` criado a cada
    // render recriaria o intervalo sem parar.
  }, [alvo, aoZerar]);

  return (
    <p className={`font-arcade ${className}`}>
      {rotulo ? <span className="text-muted-foreground">{rotulo} </span> : null}
      <span className="text-whisky text-glow">
        {restante === null ? "--H --M --S" : formatarRestante(restante)}
      </span>
    </p>
  );
}
