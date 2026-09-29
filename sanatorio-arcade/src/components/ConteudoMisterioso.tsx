import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";

/**
 * Embaça o conteúdo (foto ou recado) sem esconder quem postou. Usado por
 * Câmera e Mural: depois de 1h o que foi dito/fotografado vira mistério até
 * o dia seguinte — o autor continua visível o tempo todo.
 */
export function ConteudoMisterioso({
  ativo,
  className = "",
  children,
}: {
  ativo: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!ativo) return <>{children}</>;

  return (
    <div className={`relative select-none ${className}`}>
      <div aria-hidden className="pointer-events-none blur-md brightness-[0.55] saturate-50">
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-arcade flex items-center gap-1.5 rounded-sm bg-background/70 px-2 py-1 text-[7px] uppercase tracking-widest text-whisky">
          <HelpCircle className="h-3 w-3 shrink-0" aria-hidden />
          Em segredo até amanhã
        </span>
      </div>
    </div>
  );
}
