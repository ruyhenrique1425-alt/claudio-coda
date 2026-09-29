import type { Stats } from "@/lib/paciente-local";

/** Ficha de um paciente como vem do banco. */
export type FichaPaciente = {
  fator_coringa: number;
  imunidade_etilica: number;
  inimigo_do_fim: number;
  aptidao_audio: number;
  amnesia_anterograda: number;
};

const MAX_POR_ATRIBUTO = 5;

/** Pares (meu atributo, atributo do outro) na mesma ordem. */
function pares(eu: Stats, outro: FichaPaciente): [number, number][] {
  return [
    [eu.fatorCoringa, outro.fator_coringa],
    [eu.imunidadeEtilica, outro.imunidade_etilica],
    [eu.inimigoDoFim, outro.inimigo_do_fim],
    [eu.aptidaoAudio, outro.aptidao_audio],
    [eu.amnesia, outro.amnesia_anterograda],
  ];
}

/**
 * Compatibilidade 0–100 entre duas fichas, usando os cinco diagnósticos.
 * Cada atributo vale o mesmo: quanto menor a distância, maior a nota.
 */
export function calcularAfinidade(eu: Stats, outro: FichaPaciente): number {
  const p = pares(eu, outro);
  const distancia = p.reduce((soma, [a, b]) => soma + Math.abs(a - b), 0);
  const distanciaMaxima = p.length * MAX_POR_ATRIBUTO;
  return Math.round((1 - distancia / distanciaMaxima) * 100);
}

/** Quantos diagnósticos bateram exatamente — usado como desempate e enfeite. */
export function diagnosticosIguais(eu: Stats, outro: FichaPaciente): number {
  return pares(eu, outro).filter(([a, b]) => a === b).length;
}

export type Tier = { estrelas: string; rotulo: string; destaque: boolean };

export function tierDeAfinidade(afinidade: number): Tier {
  if (afinidade >= 90) return { estrelas: "★★★", rotulo: "alma gêmea clínica", destaque: true };
  if (afinidade >= 75) return { estrelas: "★★", rotulo: "mesma ala", destaque: true };
  if (afinidade >= 60) return { estrelas: "★", rotulo: "afinidade", destaque: true };
  if (afinidade >= 40) return { estrelas: "", rotulo: "tratamento diferente", destaque: false };
  return { estrelas: "", rotulo: "incompatível — evite", destaque: false };
}
