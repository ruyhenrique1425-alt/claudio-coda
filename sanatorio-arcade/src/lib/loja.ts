/**
 * Catálogo da loja. Tudo é desenhado em CSS, sem imagem externa, para a loja
 * não pesar no celular de ninguém no meio da festa.
 */

export type Slot = "moldura" | "adereco" | "nome";

export type ItemLoja = {
  id: string;
  slot: Slot;
  nome: string;
  descricao: string;
  preco: number;
};

export const ITENS_LOJA: ItemLoja[] = [
  {
    id: "moldura-camisa",
    slot: "moldura",
    nome: "Camisa de força",
    descricao: "Cinza com fivelas. O básico de quem foi internado cedo.",
    preco: 50,
  },
  {
    id: "moldura-sirene",
    slot: "moldura",
    nome: "Sirene",
    descricao: "Borda que pisca vermelho e azul. Impossível de ignorar.",
    preco: 120,
  },
  {
    id: "moldura-cartela",
    slot: "moldura",
    nome: "Cartela do Coringa",
    descricao: "Roxo e verde com os naipes girando na borda.",
    preco: 200,
  },
  {
    id: "moldura-rotulo",
    slot: "moldura",
    nome: "Rótulo dourado",
    descricao: "Ouro sobre preto, com o caminhante no canto.",
    preco: 350,
  },
  {
    id: "moldura-prontuario",
    slot: "moldura",
    nome: "Prontuário lacrado",
    descricao: "Papel envelhecido com o carimbo URGENTE atravessado.",
    preco: 500,
  },
  {
    id: "adereco-cone",
    slot: "adereco",
    nome: "Cone de trânsito",
    descricao: "Na cabeça. Clássico da categoria.",
    preco: 80,
  },
  {
    id: "adereco-copo",
    slot: "adereco",
    nome: "Copo americano",
    descricao: "Na mão, sempre cheio pela metade.",
    preco: 60,
  },
  {
    id: "adereco-oculos",
    slot: "adereco",
    nome: "Óculos escuros às 6h",
    descricao: "Para encarar o nascer do sol sem se render.",
    preco: 90,
  },
  {
    id: "adereco-sorriso",
    slot: "adereco",
    nome: "Sorriso do Coringa",
    descricao: "De orelha a orelha, em vermelho.",
    preco: 250,
  },
  {
    id: "nome-neon",
    slot: "nome",
    nome: "Nome em neon",
    descricao: "Seu nome pisca na lista de pacientes dos outros.",
    preco: 150,
  },
  {
    id: "nome-glitch",
    slot: "nome",
    nome: "Nome com glitch",
    descricao: "O nome treme e se descola em vermelho e ciano.",
    preco: 300,
  },
];

export function itemPorId(id: string | null | undefined): ItemLoja | null {
  if (!id) return null;
  return ITENS_LOJA.find((i) => i.id === id) ?? null;
}

export type Inventario = {
  comprados: string[];
  equipados: Partial<Record<Slot, string | null>>;
};

const VAZIO: Inventario = { comprados: [], equipados: {} };

/** Lê o jsonb de itens vindo do banco sem confiar no formato. */
export function normalizarInventario(valor: unknown): Inventario {
  if (!valor || typeof valor !== "object") return VAZIO;
  const v = valor as { comprados?: unknown; equipados?: unknown };
  const comprados = Array.isArray(v.comprados)
    ? v.comprados.filter((x): x is string => typeof x === "string")
    : [];
  const equipados: Inventario["equipados"] = {};
  if (v.equipados && typeof v.equipados === "object") {
    for (const slot of ["moldura", "adereco", "nome"] as const) {
      const item = (v.equipados as Record<string, unknown>)[slot];
      if (typeof item === "string") equipados[slot] = item;
    }
  }
  return { comprados, equipados };
}

export function equipado(inventario: unknown, slot: Slot): ItemLoja | null {
  return itemPorId(normalizarInventario(inventario).equipados[slot]);
}
