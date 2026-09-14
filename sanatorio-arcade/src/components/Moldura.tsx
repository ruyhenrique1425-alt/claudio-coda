import type { ReactNode } from "react";

import { equipado } from "@/lib/loja";

/**
 * Moldura comprada na loja, desenhada em volta do avatar. Tudo em CSS: nenhuma
 * imagem externa para carregar no meio da festa.
 */

const ESTILOS: Record<string, string> = {
  "moldura-camisa": "border-2 border-muted-foreground/70 bg-muted/30",
  "moldura-sirene":
    "border-2 border-destructive animate-pulse shadow-[0_0_18px_-2px_var(--destructive)]",
  "moldura-cartela": "border-2 border-purple bg-purple/20 shadow-[0_0_18px_-4px_var(--purple)]",
  "moldura-rotulo": "border-2 border-whisky bg-black shadow-[0_0_20px_-4px_var(--whisky)]",
  "moldura-prontuario": "border-2 border-dashed border-whisky/80 bg-whisky/10",
};

const SELOS: Record<string, string> = {
  "moldura-camisa": "×",
  "moldura-sirene": "!",
  "moldura-cartela": "♠",
  "moldura-rotulo": "★",
  "moldura-prontuario": "URGENTE",
};

export function Moldura({ itens, children }: { itens: unknown; children: ReactNode }) {
  const item = equipado(itens, "moldura");
  if (!item) return <>{children}</>;

  const estilo = ESTILOS[item.id] ?? "border-2 border-neon";
  const selo = SELOS[item.id];

  return (
    <span className={`relative inline-grid shrink-0 place-items-center rounded-sm p-1 ${estilo}`}>
      {children}
      {selo ? (
        <span
          aria-hidden
          className="font-arcade absolute -right-1 -top-2 rounded-sm bg-background px-1 text-[6px] text-whisky"
        >
          {selo}
        </span>
      ) : null}
    </span>
  );
}

/** Nome do paciente com o efeito comprado na loja, se houver. */
export function NomeDoPaciente({
  nome,
  itens,
  className = "",
}: {
  nome: string;
  itens: unknown;
  className?: string;
}) {
  const efeito = equipado(itens, "nome");

  if (efeito?.id === "nome-neon") {
    return <span className={`animate-pulse text-neon text-glow ${className}`}>{nome}</span>;
  }

  if (efeito?.id === "nome-glitch") {
    return (
      <span className={`relative inline-block ${className}`}>
        <span aria-hidden className="absolute inset-0 translate-x-[1px] text-destructive/70">
          {nome}
        </span>
        <span aria-hidden className="absolute inset-0 -translate-x-[1px] text-neon/70">
          {nome}
        </span>
        <span className="relative">{nome}</span>
      </span>
    );
  }

  return <span className={className}>{nome}</span>;
}
