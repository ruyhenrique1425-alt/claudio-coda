import { motion } from "motion/react";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof motion.button> & {
  tone?: "neon" | "whisky" | "purple";
};

export function ArcadeButton({ tone = "neon", className = "", ...props }: Props) {
  const tones = {
    neon: "border-neon text-neon shadow-[0_0_14px_-4px_var(--neon)]",
    whisky: "border-whisky text-whisky shadow-[0_0_14px_-4px_var(--whisky)]",
    purple: "border-purple text-foreground shadow-[0_0_14px_-4px_var(--purple)]",
  }[tone];

  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      className={`font-arcade tap-44 select-none rounded-sm border-2 bg-card/60 transition-opacity active:bg-card disabled:opacity-30 ${tones} ${className}`}
      {...props}
    />
  );
}
