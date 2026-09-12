import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { CONQUISTAS, type CodigoConquista } from "@/lib/conquistas";

/**
 * Folha dos QR codes, para os moradores imprimirem.
 *
 * Não entra na barra de navegação: é tela de organizador, não de convidado.
 * Os códigos são desenhados no navegador, então nenhum dado da festa passa por
 * um gerador de QR de terceiros.
 */
export const Route = createFileRoute("/qrcodes")({
  component: PaginaQrCodes,
  head: () => ({
    meta: [
      { title: "QR codes da festa — República Sanatório" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function PaginaQrCodes() {
  const [base, setBase] = useState("");
  const [imagens, setImagens] = useState<Record<string, string>>({});

  useEffect(() => {
    setBase(window.location.origin);
  }, []);

  useEffect(() => {
    if (!base) return;
    let ativo = true;

    void Promise.all(
      CONQUISTAS.map(async (c) => {
        const url = `${base}/q/${c.codigo}`;
        // Correção de erro alta: papel de bar amassa, molha e ainda assim lê.
        const png = await QRCode.toDataURL(url, {
          errorCorrectionLevel: "H",
          margin: 2,
          width: 512,
          color: { dark: "#000000", light: "#ffffff" },
        });
        return [c.codigo, png] as const;
      }),
    ).then((pares) => {
      if (ativo) setImagens(Object.fromEntries(pares));
    });

    return () => {
      ativo = false;
    };
  }, [base]);

  return (
    <section className="print:bg-white print:text-black">
      <header className="rounded-sm border-2 border-whisky bg-card/50 p-4 print:hidden">
        <h1 className="font-arcade text-[10px] uppercase text-whisky text-glow">
          QR codes da festa
        </h1>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          Imprima, recorte e espalhe. Cada código abre uma cena do Coringa e paga fichas uma vez por
          paciente. Quem ler antes de fazer a ficha não perde nada: a conquista fica guardada no
          aparelho.
        </p>
        <button
          onClick={() => window.print()}
          className="font-arcade tap-44 mt-4 w-full rounded-sm border-2 border-neon py-3 text-[9px] uppercase text-neon"
        >
          Imprimir a folha
        </button>
      </header>

      <div className="mt-5 space-y-5">
        {CONQUISTAS.map((c) => (
          <article
            key={c.codigo}
            className="rounded-sm border-2 border-purple bg-card/40 p-4 text-center print:break-inside-avoid print:border-black print:bg-white"
          >
            <p className="font-arcade text-[9px] uppercase text-whisky print:text-black">
              {c.titulo}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground print:text-black">{c.ondeFica}</p>

            <div className="mx-auto mt-4 w-full max-w-[220px] bg-white p-3">
              {imagens[c.codigo] ? (
                <img
                  src={imagens[c.codigo]}
                  alt={`QR code da conquista ${c.titulo}`}
                  className="w-full"
                />
              ) : (
                <div className="grid aspect-square place-items-center text-[11px] text-black">
                  gerando…
                </div>
              )}
            </div>

            <p className="mt-3 break-all font-mono text-[10px] text-muted-foreground print:text-black">
              {base ? `${base}/q/${c.codigo}` : ""}
            </p>
            <p className="font-arcade mt-2 text-[8px] uppercase text-neon print:text-black">
              +{c.fichas} fichas
            </p>
          </article>
        ))}
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground print:hidden">
        Endereço desta folha: <span className="text-neon">/qrcodes</span>. Ela não aparece na barra
        de navegação.
      </p>
    </section>
  );
}
