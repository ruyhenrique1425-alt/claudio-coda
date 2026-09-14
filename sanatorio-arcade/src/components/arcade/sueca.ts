/**
 * Regras da Sueca Bêbada.
 *
 * Dois baralhos sem coringa, 104 cartas. Cada valor tem uma função; o naipe é
 * só enfeite, como no jogo de mesa.
 *
 * Duas notas sobre a fonte das regras: ela descreve o 6 e o 9 como a mesma
 * continência, e a explicação do 9 está truncada no original. Aqui o 6 é a
 * continência na testa e o 9 é a versão dedo no nariz, que é como a mesa
 * costuma jogar — assim as duas cartas guardadas não fazem a mesma coisa.
 */

export type Naipe = "espadas" | "copas" | "ouros" | "paus";

export const NAIPES: { id: Naipe; simbolo: string; vermelho: boolean }[] = [
  { id: "espadas", simbolo: "♠", vermelho: false },
  { id: "copas", simbolo: "♥", vermelho: true },
  { id: "ouros", simbolo: "♦", vermelho: true },
  { id: "paus", simbolo: "♣", vermelho: false },
];

export type Valor = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export const VALORES: Valor[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/** O que a carta faz. `guardar` fica com o jogador; `regra` entra na lista. */
export type Efeito = "beber" | "brincadeira" | "guardar" | "regra";

export type Regra = {
  valor: Valor;
  titulo: string;
  resumo: string;
  comoJoga: string;
  exemplo?: string;
  efeito: Efeito;
};

export const REGRAS: Record<Valor, Regra> = {
  A: {
    valor: "A",
    titulo: "Escolha um",
    resumo: "Aponte uma pessoa. Ela bebe.",
    comoJoga: "Quem tirou o ás escolhe um paciente da roda para beber uma dose.",
    efeito: "beber",
  },
  "2": {
    valor: "2",
    titulo: "Escolha dois",
    resumo: "Duas pessoas bebem.",
    comoJoga: "Quem tirou o dois aponta duas pessoas. As duas bebem.",
    efeito: "beber",
  },
  "3": {
    valor: "3",
    titulo: "Escolha três",
    resumo: "Três pessoas bebem.",
    comoJoga: "Quem tirou o três aponta três pessoas. As três bebem.",
    efeito: "beber",
  },
  "4": {
    valor: "4",
    titulo: "Stop",
    resumo: "Categoria e letra. Quem travar, bebe.",
    comoJoga:
      "Quem tirou a carta escolhe uma categoria e uma letra, e dá o primeiro exemplo. A roda segue no sentido horário. Quem errar, repetir ou demorar, bebe.",
    exemplo: 'Categoria "carros com A": Audi, Astra, Alfa Romeo…',
    efeito: "brincadeira",
  },
  "5": {
    valor: "5",
    titulo: "Jogo da memória",
    resumo: "Cada um repete tudo e soma uma palavra.",
    comoJoga:
      "Quem tirou a carta fala uma palavra qualquer. O próximo repete e acrescenta outra. Quem errar a ordem ou travar, bebe.",
    exemplo: '"jamanta" → "jamanta cabrito" → "jamanta cabrito mesa"…',
    efeito: "brincadeira",
  },
  "6": {
    valor: "6",
    titulo: "Continência",
    resumo: "Guarde a carta. Use quando quiser.",
    comoJoga:
      "Guarde esta carta. A qualquer momento da noite, leve a mão à testa em continência, sem avisar ninguém. Quem for o último a perceber e repetir, bebe.",
    efeito: "guardar",
  },
  "7": {
    valor: "7",
    titulo: "Jogo do Pi",
    resumo: "Conte alto. Múltiplo de três vira 'pi'.",
    comoJoga:
      "Quem tirou a carta fala 'um'. A roda vai contando, mas todo múltiplo de três vira a palavra 'pi'. Quem errar ou demorar, bebe.",
    exemplo: "um, dois, pi, quatro, cinco, pi, sete…",
    efeito: "brincadeira",
  },
  "8": {
    valor: "8",
    titulo: "Regra geral",
    resumo: "Crie uma regra. Vale até alguém tirar outro 8.",
    comoJoga:
      "Quem tirou o oito inventa uma regra para a mesa inteira. Quem quebrar, bebe. A regra vale até outro oito aparecer e substituí-la.",
    exemplo: '"Proibido falar a palavra beber" ou "tem que rebolar antes de virar a dose".',
    efeito: "regra",
  },
  "9": {
    valor: "9",
    titulo: "Dedo no nariz",
    resumo: "Guarde a carta. Use quando quiser.",
    comoJoga:
      "Mesma ideia da continência, com outro gesto: a qualquer momento, leve o dedo ao nariz sem avisar. O último a perceber e repetir, bebe.",
    efeito: "guardar",
  },
  "10": {
    valor: "10",
    titulo: "Cafofo",
    resumo: "Lista sobre um tema. Quem repetir, bebe.",
    comoJoga:
      "Quem tirou a carta escolhe um tema e diz o primeiro item. A roda continua. Quem repetir um item já dito ou não souber, bebe.",
    exemplo: '"marcas de carro" ou "apelidos para o Piauí".',
    efeito: "brincadeira",
  },
  J: {
    valor: "J",
    titulo: "Valete",
    resumo: "Quem está à sua esquerda bebe.",
    comoJoga: "O paciente sentado à esquerda de quem tirou o valete bebe uma dose. Sem discussão.",
    efeito: "beber",
  },
  Q: {
    valor: "Q",
    titulo: "Dama",
    resumo: "Todas as mulheres da mesa bebem.",
    comoJoga: "Todas as mulheres da roda bebem uma dose.",
    efeito: "beber",
  },
  K: {
    valor: "K",
    titulo: "Rei",
    resumo: "Todos os homens da mesa bebem.",
    comoJoga: "Todos os homens da roda bebem uma dose.",
    efeito: "beber",
  },
};

export type Carta = { id: number; valor: Valor; naipe: Naipe };

/** Dois baralhos completos sem coringa: 104 cartas. */
export function montarMonte(): Carta[] {
  const cartas: Carta[] = [];
  let id = 0;
  for (let baralho = 0; baralho < 2; baralho++) {
    for (const naipe of NAIPES) {
      for (const valor of VALORES) {
        cartas.push({ id: id++, valor, naipe: naipe.id });
      }
    }
  }
  return embaralhar(cartas);
}

/** Fisher-Yates: cada ordem tem a mesma chance, que é o mínimo num carteado. */
export function embaralhar(cartas: Carta[]): Carta[] {
  const copia = [...cartas];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}

export function naipeDe(id: Naipe): { id: Naipe; simbolo: string; vermelho: boolean } {
  return NAIPES.find((n) => n.id === id) ?? NAIPES[0]!;
}
