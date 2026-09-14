/**
 * Compressão antes do envio.
 *
 * A foto crua de um celular moderno passa de 4 MB. Num sinal de sítio isso é
 * uma fila que nunca anda. Reduzida para 1280px no lado maior e JPEG 0.7, a
 * mesma foto fica em torno de 200 KB — e ninguém, olhando no celular às duas
 * da manhã, nota a diferença.
 */

const LADO_MAXIMO = 1280;
const QUALIDADE = 0.7;

export async function comprimir(arquivo: File | Blob): Promise<Blob> {
  const bitmap = await carregar(arquivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;

  const ctx = canvas.getContext("2d");
  if (!ctx) return arquivo;
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  if ("close" in bitmap) bitmap.close();

  const comprimida = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALIDADE),
  );

  // Se a compressão não ajudou (foto já pequena), manda a original.
  if (!comprimida || comprimida.size >= arquivo.size) return arquivo;
  return comprimida;
}

async function carregar(arquivo: File | Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(arquivo);
    } catch {
      /* alguns navegadores antigos engasgam: cai no <img> abaixo */
    }
  }

  const url = URL.createObjectURL(arquivo);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Não deu para ler a imagem."));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
