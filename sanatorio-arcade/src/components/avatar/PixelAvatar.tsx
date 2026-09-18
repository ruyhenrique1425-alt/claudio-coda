import { useMemo } from "react";

import { equipado } from "@/lib/loja";

import {
  aplicarAderecoDaLoja,
  GRID_H,
  GRID_W,
  montarPixels,
  normalizarAvatar,
  normalizarPersonagem,
  type Avatar,
  type PersonagemId,
} from "./personagens";

const SIZES = { xs: 2, sm: 3, md: 6, lg: 10 } as const;

// Contorno de 1px ao redor da silhueta inteira, via drop-shadow empilhado nas
// 4 direções: segue o alfa do grid (só os pixels do boneco), não a caixa
// retangular, e fica fino igual em qualquer tamanho de avatar.
const CONTORNO =
  "drop-shadow(1px 0 0 var(--pixel-outline)) drop-shadow(-1px 0 0 var(--pixel-outline)) drop-shadow(0 1px 0 var(--pixel-outline)) drop-shadow(0 -1px 0 var(--pixel-outline))";

export function PixelAvatar({
  personagem,
  avatar,
  itens,
  size = "md",
  glow = false,
  className = "",
  title,
}: {
  personagem: unknown;
  avatar: unknown;
  /** Itens da loja (jsonb do paciente); usado só para o slot "adereco". */
  itens?: unknown;
  size?: keyof typeof SIZES;
  glow?: boolean;
  className?: string;
  title?: string;
}) {
  const id = normalizarPersonagem(personagem) as PersonagemId;
  const look = normalizarAvatar(avatar) as Avatar;
  const px = SIZES[size];
  const adornoId = equipado(itens, "adereco")?.id;

  const grid = useMemo(() => {
    const g = montarPixels(id, look);
    aplicarAderecoDaLoja(g, adornoId);
    return g;
  }, [id, look, adornoId]);

  // Bevel sutil (luz em cima/esquerda, sombra embaixo/direita) só nos
  // tamanhos maiores: numa célula de 2-3px o realce vira ruído em vez de
  // profundidade.
  const bisel = px >= 6;

  return (
    <div
      role="img"
      aria-label={title ?? "Avatar do paciente"}
      className={`grid shrink-0 ${className}`}
      style={{
        gridTemplateColumns: `repeat(${GRID_W}, ${px}px)`,
        gridTemplateRows: `repeat(${GRID_H}, ${px}px)`,
        imageRendering: "pixelated",
        filter: glow ? `${CONTORNO} drop-shadow(0 0 10px var(--neon))` : CONTORNO,
      }}
    >
      {grid.flatMap((row, y) =>
        row.map((c, x) => (
          <span
            key={`${x}-${y}`}
            style={
              c
                ? {
                    background: c,
                    boxShadow: bisel
                      ? `inset 1px 1px 0 color-mix(in oklab, ${c} 65%, white), inset -1px -1px 0 color-mix(in oklab, ${c} 65%, black)`
                      : undefined,
                  }
                : undefined
            }
            className={c ? "" : "bg-transparent"}
          />
        )),
      )}
    </div>
  );
}
