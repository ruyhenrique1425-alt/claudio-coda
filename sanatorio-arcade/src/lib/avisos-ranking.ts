/**
 * Avisos que nascem do placar.
 *
 * O banco não guarda "quem passou quem": o app compara o placar de agora com o
 * último retrato guardado no próprio celular e transforma a diferença em aviso.
 * Assim ninguém precisa estar na aba Ranking para saber que perdeu o pódio.
 */
import type { Aviso } from "@/lib/avisos";
import type { LinhaRanking } from "@/lib/pontos";

const CHAVE = "ranking_visto";
const MARCOS = [100, 250, 500, 1000, 2000] as const;

type Retrato = {
  /** Posição do dono do celular (1 = primeiro). null = fora do placar. */
  posicao: number | null;
  ganhos: number;
  /** Os três primeiros, na ordem. */
  topo: { id: string; nome: string }[];
  /** Maior marco de fichas já comemorado. */
  marco: number;
};

function lerRetrato(): Retrato | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return null;
    const v = JSON.parse(cru) as Partial<Retrato>;
    return {
      posicao: typeof v.posicao === "number" ? v.posicao : null,
      ganhos: Number(v.ganhos ?? 0),
      topo: Array.isArray(v.topo) ? v.topo : [],
      marco: Number(v.marco ?? 0),
    };
  } catch {
    return null;
  }
}

function guardar(retrato: Retrato) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(retrato));
  } catch {
    /* armazenamento cheio ou modo privado: o aviso simplesmente repete depois */
  }
}

function ordinal(posicao: number): string {
  return `${posicao}º`;
}

/**
 * Compara o placar novo com o retrato anterior e devolve os avisos.
 * Na primeira leitura só guarda o retrato, para não disparar tudo de uma vez.
 */
export function avisosDoRanking(linhas: LinhaRanking[], eu: string | null): Aviso[] {
  if (linhas.length === 0) return [];

  const indice = eu ? linhas.findIndex((l) => l.paciente_id === eu) : -1;
  const posicao = indice >= 0 ? indice + 1 : null;
  const ganhos = indice >= 0 ? Number(linhas[indice]!.ganhos_total ?? 0) : 0;
  const topo = linhas.slice(0, 3).map((l) => ({ id: l.paciente_id, nome: l.nome }));

  const antes = lerRetrato();
  const agora = new Date().toISOString();

  if (!antes) {
    guardar({ posicao, ganhos, topo, marco: maiorMarco(ganhos) });
    return [];
  }

  const avisos: Aviso[] = [];
  const nomeEm = (p: number) => (linhas[p - 1]?.nome ?? "ALGUÉM").toUpperCase();

  // Mudou o líder da ala.
  const lider = topo[0];
  const liderAntes = antes.topo[0];
  if (lider && liderAntes && lider.id !== liderAntes.id) {
    avisos.push({
      id: `lider-${lider.id}`,
      tipo: "podio",
      texto:
        lider.id === eu
          ? "VOCÊ ASSUMIU A LIDERANÇA DA ALA"
          : `NOVO LÍDER DA ALA: ${lider.nome.toUpperCase()}`,
      em: agora,
    });
  }

  if (posicao !== null) {
    const antesPos = antes.posicao;

    // Entrou no pódio.
    if (posicao <= 3 && (antesPos === null || antesPos > 3)) {
      avisos.push({
        id: `podio-${posicao}-${ganhos}`,
        tipo: "podio",
        texto: `VOCÊ ENTROU NO TOP 3 — ${ordinal(posicao)} LUGAR`,
        em: agora,
      });
    }

    // Caiu de posição: quem está no seu lugar antigo roubou a vaga.
    if (antesPos !== null && posicao > antesPos) {
      avisos.push({
        id: `ultrapassado-${antesPos}-${posicao}-${ganhos}`,
        tipo: "ultrapassado",
        texto:
          antesPos <= 3
            ? `${nomeEm(antesPos)} ROUBOU SEU ${ordinal(antesPos)} LUGAR`
            : `${nomeEm(antesPos)} PASSOU VOCÊ. AGORA VOCÊ É ${ordinal(posicao)}`,
        em: agora,
      });
    }

    // Subiu de posição dentro do topo.
    if (antesPos !== null && posicao < antesPos && posicao <= 3 && antesPos <= 4) {
      const passado = antes.topo[posicao - 1];
      if (passado && passado.id !== eu) {
        avisos.push({
          id: `subiu-${posicao}-${ganhos}`,
          tipo: "podio",
          texto: `VOCÊ PASSOU ${passado.nome.toUpperCase()} — AGORA ${ordinal(posicao)}`,
          em: agora,
        });
      }
    }
  }

  // Marcos de fichas ganhas.
  const marco = maiorMarco(ganhos);
  if (marco > antes.marco) {
    avisos.push({
      id: `marco-${marco}`,
      tipo: "marco",
      texto: `${marco} FICHAS GANHAS. DIAGNÓSTICO: SEM CURA`,
      em: agora,
    });
  }

  guardar({ posicao, ganhos, topo, marco: Math.max(marco, antes.marco) });
  return avisos;
}

function maiorMarco(ganhos: number): number {
  let maior = 0;
  for (const m of MARCOS) if (ganhos >= m) maior = m;
  return maior;
}
