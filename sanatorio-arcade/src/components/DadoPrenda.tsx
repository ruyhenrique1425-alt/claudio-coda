import { useEffect, useState } from "react";
import { motion } from "motion/react";

/**
 * O dado das prendas: seis faces, mas só três resultados (1, 1, 2, 2, 3, 3).
 * O valor vem sorteado do servidor; aqui só roda a animação até parar nele.
 */
export function DadoPrenda({ segundos, aoParar }: { segundos: number; aoParar?: () => void }) {
  const [face, setFace] = useState(1);
  const [rolando, setRolando] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setFace(1 + Math.floor(Math.random() * 3)), 90);
    const fim = setTimeout(() => {
      clearInterval(id);
      setFace(segundos);
      setRolando(false);
      aoParar?.();
    }, 2000);

    return () => {
      clearInterval(id);
      clearTimeout(fim);
    };
  }, [segundos, aoParar]);

  // Posição das bolinhas em cada face, na grade 3x3.
  const BOLAS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8] };
  const acesas = BOLAS[face] ?? [4];

  return (
    <div className="grid place-items-center">
      <motion.div
        animate={rolando ? { rotate: [0, 90, 180, 270, 360] } : { rotate: 0, scale: [1, 1.15, 1] }}
        transition={
          rolando ? { repeat: Infinity, duration: 0.5, ease: "linear" } : { duration: 0.4 }
        }
        className="grid h-24 w-24 grid-cols-3 grid-rows-3 gap-1 rounded-sm border-4 border-whisky bg-background p-2 shadow-[0_0_24px_-6px_var(--whisky)]"
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <span
            key={i}
            className={`rounded-full ${acesas.includes(i) ? "bg-whisky" : "bg-transparent"}`}
          />
        ))}
      </motion.div>

      <p className="font-arcade mt-3 text-[10px] uppercase text-whisky text-glow">
        {rolando ? "Rolando…" : `${face} segundo${face > 1 ? "s" : ""}`}
      </p>
    </div>
  );
}
