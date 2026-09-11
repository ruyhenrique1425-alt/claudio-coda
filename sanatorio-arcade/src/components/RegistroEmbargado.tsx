import { PixelAvatar } from "./avatar/PixelAvatar";
import { Moldura, NomeDoPaciente } from "./Moldura";

/**
 * O que aparece no lugar da foto ou do recado antes de 30/10 às 12h.
 * A foto em si nem chega no navegador — o servidor não assina a URL. Aqui
 * mostramos só quem registrou, o avatar e a atividade.
 */
export function FotoEmbargada({
  autor,
  personagem,
  avatar,
  itens,
  atividade,
  quando,
}: {
  autor: string;
  personagem: unknown;
  avatar: unknown;
  itens: unknown;
  atividade: string;
  quando: string;
}) {
  return (
    <figure className="relative overflow-hidden rounded-sm border-2 border-purple/60 bg-black">
      {/* Ruído e pixelização, sem imagem por baixo. */}
      <div className="relative aspect-square w-full">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "repeating-conic-gradient(color-mix(in oklab, var(--purple) 60%, black) 0% 25%, black 0% 50%)",
            backgroundSize: "14px 14px",
            filter: "blur(3px)",
          }}
        />
        <div aria-hidden className="crt-scanlines absolute inset-0 opacity-70" />

        <div className="absolute inset-0 grid place-items-center">
          <Moldura itens={itens}>
            <PixelAvatar personagem={personagem} avatar={avatar} size="md" glow />
          </Moldura>
        </div>
      </div>

      <figcaption className="border-t border-purple/50 bg-background/80 px-3 py-2">
        <p className="font-arcade truncate text-[8px] uppercase text-whisky">
          <NomeDoPaciente nome={autor} itens={itens} />
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">{atividade}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {new Date(quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </figcaption>
    </figure>
  );
}

/** Recado borrado: blocos do tamanho do texto original, sem o texto. */
export function RecadoEmbargado({ tamanho }: { tamanho: number }) {
  // Quebra o comprimento em "palavras" de 3 a 9 caracteres, só para o borrão
  // ter cara de frase em vez de uma barra sólida.
  const blocos: number[] = [];
  let resto = Math.max(1, tamanho);
  while (resto > 0) {
    const n = Math.min(resto, 3 + Math.floor(Math.random() * 7));
    blocos.push(n);
    resto -= n;
  }

  return (
    <p aria-label="Recado sob embargo" className="flex flex-wrap gap-1.5">
      {blocos.map((n, i) => (
        <span
          key={i}
          aria-hidden
          className="inline-block h-3 rounded-[1px] bg-muted-foreground/40"
          style={{ width: `${n * 7}px`, filter: "blur(1.5px)" }}
        />
      ))}
    </p>
  );
}
