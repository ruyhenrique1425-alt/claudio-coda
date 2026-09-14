import { motion } from "motion/react";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof motion.button> & {
  tone?: "neon" | "whisky" | "purple" | "vermelho";
};

/**
 * Botão de fliperama com canto em degraus.
 *
 * A moldura e a superfície são desenhadas por baixo (ver `caixa-pixel` em
 * styles.css), então o contorno acompanha o degrau em vez de deixar o canto
 * aberto. As variáveis dizem a cor da moldura e do fundo.
 */
export function ArcadeButton({ tone = "neon", className = "", ...props }: Props) {
  const tons = {
    neon: {
      texto: "text-neon shadow-[0_0_16px_-4px_var(--neon)]",
      vars: { "--moldura": "var(--neon)" },
    },
    whisky: {
      texto: "text-whisky shadow-[0_0_16px_-4px_var(--whisky)]",
      vars: { "--moldura": "var(--whisky)" },
    },
    purple: {
      texto: "text-foreground shadow-[0_0_16px_-4px_var(--purple)]",
      vars: { "--moldura": "var(--purple)" },
    },
    vermelho: {
      texto: "text-destructive shadow-[0_0_16px_-4px_var(--destructive)]",
      vars: { "--moldura": "var(--destructive)" },
    },
  }[tone];

  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      style={{ ...tons.vars, ...(props.style ?? {}) }}
      className={`caixa-pixel font-arcade tap-44 select-none transition-opacity active:brightness-125 disabled:opacity-35 ${tons.texto} ${className}`}
      {...props}
    />
  );
}
