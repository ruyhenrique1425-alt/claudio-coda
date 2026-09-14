import { useMemo } from "react";

import {
  GRID_H,
  GRID_W,
  montarPixels,
  normalizarAvatar,
  normalizarPersonagem,
  type Avatar,
  type PersonagemId,
} from "./personagens";

const SIZES = { xs: 2, sm: 3, md: 6, lg: 10 } as const;

export function PixelAvatar({
  personagem,
  avatar,
  size = "md",
  glow = false,
  className = "",
  title,
}: {
  personagem: unknown;
  avatar: unknown;
  size?: keyof typeof SIZES;
  glow?: boolean;
  className?: string;
  title?: string;
}) {
  const id = normalizarPersonagem(personagem) as PersonagemId;
  const look = normalizarAvatar(avatar) as Avatar;
  const px = SIZES[size];

  const grid = useMemo(() => montarPixels(id, look), [id, look]);

  return (
    <div
      role="img"
      aria-label={title ?? "Avatar do paciente"}
      className={`grid shrink-0 ${glow ? "drop-shadow-[0_0_10px_var(--neon)]" : ""} ${className}`}
      style={{
        gridTemplateColumns: `repeat(${GRID_W}, ${px}px)`,
        gridTemplateRows: `repeat(${GRID_H}, ${px}px)`,
        imageRendering: "pixelated",
      }}
    >
      {grid.flatMap((row, y) =>
        row.map((c, x) => (
          <span
            key={`${x}-${y}`}
            style={c ? { background: c } : undefined}
            className={c ? "" : "bg-transparent"}
          />
        )),
      )}
    </div>
  );
}
