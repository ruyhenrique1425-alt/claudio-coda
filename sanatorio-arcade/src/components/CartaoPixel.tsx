import type { CSSProperties, ReactNode } from "react";

type Tom = "neon" | "purple" | "whisky" | "vermelho" | "apagado";

const MOLDURAS: Record<Tom, string> = {
  neon: "var(--neon)",
  purple: "var(--purple)",
  whisky: "var(--whisky)",
  vermelho: "var(--destructive)",
  apagado: "color-mix(in oklab, var(--muted-foreground) 45%, transparent)",
};

const BRILHOS: Record<Tom, string> = {
  neon: "shadow-[0_0_22px_-10px_var(--neon)]",
  purple: "shadow-[0_0_22px_-10px_var(--purple)]",
  whisky: "shadow-[0_0_22px_-10px_var(--whisky)]",
  vermelho: "shadow-[0_0_22px_-10px_var(--destructive)]",
  apagado: "",
};

/**
 * Cartão com canto em degraus, no mesmo desenho dos botões.
 *
 * Existe para a interface inteira falar a mesma língua: a borda reta de canto
 * vivo era dura de olhar, e o degrau deixa o bloco mais amigável sem sair do
 * universo pixelado.
 */
export function CartaoPixel({
  tom = "purple",
  className = "",
  style,
  children,
}: {
  tom?: Tom;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      style={{ "--moldura": MOLDURAS[tom], ...style } as CSSProperties}
      className={`caixa-pixel p-4 ${BRILHOS[tom]} ${className}`}
    >
      {children}
    </div>
  );
}
