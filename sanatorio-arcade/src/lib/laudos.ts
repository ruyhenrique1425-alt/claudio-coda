import type { Stats } from "@/lib/paciente-local";

/**
 * O laudo sai da combinação dos dois diagnósticos mais altos da ficha.
 * Dez pares possíveis entre os cinco atributos, todos escritos à mão.
 */

const ORDEM = [
  "fatorCoringa",
  "imunidadeEtilica",
  "inimigoDoFim",
  "aptidaoAudio",
  "amnesia",
] as const;

type Chave = (typeof ORDEM)[number];

const LAUDOS: Record<string, string> = {
  "fatorCoringa+imunidadeEtilica":
    "Paciente de alto risco combinado. Manter longe da mesa de som e do freezer.",
  "fatorCoringa+inimigoDoFim":
    "Vai sumir às 2h e reaparecer às 6h com uma história que ninguém vai acreditar.",
  "fatorCoringa+aptidaoAudio":
    "Perigo duplo: improvisa o caos e ainda documenta em áudio de cinco minutos.",
  "fatorCoringa+amnesia":
    "Faz o que quiser e não lembra de nada. Invejável e assustador em partes iguais.",
  "imunidadeEtilica+inimigoDoFim":
    "Este paciente vai apagar as luzes da festa. Literalmente, no interruptor.",
  "imunidadeEtilica+aptidaoAudio":
    "Fígado blindado e dedo solto. Recolha o celular por volta da terceira dose.",
  "imunidadeEtilica+amnesia":
    "Aguenta a noite inteira e acorda sem nenhuma prova disso. Um mistério clínico.",
  "inimigoDoFim+aptidaoAudio":
    "Às 5h da manhã vai mandar áudio perguntando se ainda tem gente acordada. Vai ter.",
  "inimigoDoFim+amnesia": "Fica até o fim e não lembra do fim. Pergunte aos outros como terminou.",
  "aptidaoAudio+amnesia": "Amanhã vai abrir o WhatsApp com medo. Com razão.",
};

const SOLO: Record<Chave, string> = {
  fatorCoringa: "Caos puro, sem segunda opinião. Não deixem perto do microfone.",
  imunidadeEtilica: "Resistência acima da média. O bar que se cuide.",
  inimigoDoFim: "Sai por último. Sempre. Mesmo quando pedem para sair.",
  aptidaoAudio: "Risco social concentrado no polegar direito.",
  amnesia: "Amanhã isso aqui tudo vira boato.",
};

export function laudoDe(stats: Stats): string {
  const ordenados = [...ORDEM].sort((a, b) => stats[b] - stats[a]);
  const [primeiro, segundo] = ordenados as [Chave, Chave];

  if (stats[primeiro] === 0) {
    return "Ficha em branco. Paciente entrou no manicômio por engano — ou está mentindo.";
  }

  // Empate no topo ou um atributo muito acima do resto: laudo de um traço só.
  if (stats[segundo] === 0 || stats[primeiro] - stats[segundo] >= 3) {
    return SOLO[primeiro];
  }

  const chave = ORDEM.filter((k) => k === primeiro || k === segundo).join("+");
  return LAUDOS[chave] ?? SOLO[primeiro];
}
