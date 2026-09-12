/**
 * As cinco quests de QR code espalhadas pela festa.
 *
 * Cada código vive num lugar físico e conta um pedaço da noite. O primeiro sai
 * antes do evento, no Instagram, para a galera chegar já internada.
 *
 * O código é curto de propósito: ele vira uma URL que cabe num QR pequeno e
 * impresso em papel de bar ainda lê.
 */

export type CodigoConquista = "bemvindo" | "van" | "bar" | "xeque" | "privada";

export type Conquista = {
  codigo: CodigoConquista;
  titulo: string;
  ondeFica: string;
  legenda: string;
  fichas: number;
};

export const CONQUISTAS: Conquista[] = [
  {
    codigo: "bemvindo",
    titulo: "Internação Antecipada",
    ondeFica: "Instagram da Sanatório, um dia antes",
    legenda:
      "O Coringa abriu o portão do hospício e já separou o seu leito. Chegou antes de todo mundo.",
    fichas: 40,
  },
  {
    codigo: "van",
    titulo: "Transporte de Pacientes",
    ondeFica: "Dentro da van que leva os convidados",
    legenda: "Ninguém devia ter deixado ele dirigir. A van chegou, que é o que importa.",
    fichas: 30,
  },
  {
    codigo: "bar",
    titulo: "Medicação Líquida",
    ondeFica: "No bar",
    legenda: "Prescrição do doutor: um copo, virado até o fim. Repetir conforme necessário.",
    fichas: 30,
  },
  {
    codigo: "xeque",
    titulo: "Xeque-Mate",
    ondeFica: "Na mesa do xadrez",
    legenda: "Ele não sabe jogar, mas ganha sempre. Ninguém nunca entendeu como.",
    fichas: 30,
  },
  {
    codigo: "privada",
    titulo: "Sala de Meditação",
    ondeFica: "No banheiro",
    legenda: "O único lugar do sanatório onde ele pensa na vida. Dura uns quatro minutos.",
    fichas: 30,
  },
];

export function conquistaPor(codigo: string): Conquista | null {
  return CONQUISTAS.find((c) => c.codigo === codigo) ?? null;
}

export const TOTAL_CONQUISTAS = CONQUISTAS.length;

/* ------------------------- guardadas antes da ficha ----------------------- */

const CHAVE_PENDENTES = "sanatorio:conquistas-pendentes";

/**
 * Quem escaneia antes de fazer a ficha não perde a conquista: ela fica aqui e
 * é creditada assim que o prontuário existir.
 */
export function lerPendentes(): CodigoConquista[] {
  try {
    const cru = localStorage.getItem(CHAVE_PENDENTES);
    if (!cru) return [];
    const lista = JSON.parse(cru) as unknown;
    if (!Array.isArray(lista)) return [];
    return lista.filter((c): c is CodigoConquista => CONQUISTAS.some((x) => x.codigo === c));
  } catch {
    return [];
  }
}

export function guardarPendente(codigo: CodigoConquista) {
  try {
    const atuais = lerPendentes();
    if (atuais.includes(codigo)) return;
    localStorage.setItem(CHAVE_PENDENTES, JSON.stringify([...atuais, codigo]));
  } catch {
    /* armazenamento indisponível */
  }
}

export function limparPendentes() {
  try {
    localStorage.removeItem(CHAVE_PENDENTES);
  } catch {
    /* nada a limpar */
  }
}
