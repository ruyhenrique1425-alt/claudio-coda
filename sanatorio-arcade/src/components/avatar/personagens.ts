/**
 * Catálogo de personagens de fliperama do Sanatório.
 * Cada boneco é desenhado por uma grade de pixels (14 x 16) composta em camadas:
 * corpo -> expressão -> acessório -> item na mão.
 */

export const GRID_W = 14;
export const GRID_H = 16;

/* ---------------------------------- cores --------------------------------- */

export const CORES = [
  { id: "verde", label: "Verde neon", css: "var(--neon)" },
  { id: "roxo", label: "Roxo", css: "var(--purple)" },
  { id: "amarelo", label: "Amarelo", css: "var(--whisky)" },
  { id: "branco", label: "Branco", css: "var(--foreground)" },
  { id: "vermelho", label: "Vermelho", css: "var(--destructive)" },
] as const;

export type CorId = (typeof CORES)[number]["id"];

const SKIN = "var(--pixel-skin)";
const INK = "var(--pixel-ink)";
const COAT = "var(--pixel-coat)";
const OUTLINE = "var(--pixel-outline)";

function cor(id: CorId): string {
  return (CORES.find((c) => c.id === id) ?? CORES[0]).css;
}

/* --------------------------------- cabeças -------------------------------- */

type Rows = readonly string[];

const HEADS: Record<string, Rows> = {
  curto: [
    "..............",
    "....HHHHHH....",
    "...HHHHHHHH...",
    "...HSSSSSSH...",
    "...SSSSSSSS...",
    "...SSSSSSSS...",
    "....SSSSSS....",
    ".....SSSS.....",
  ],
  longo: [
    "....HHHHHH....",
    "...HHHHHHHH...",
    "..HHHHHHHHHH..",
    "..HHSSSSSSHH..",
    "..HSSSSSSSSH..",
    "..HSSSSSSSSH..",
    "..H.SSSSSS.H..",
    ".....SSSS.....",
  ],
  espetado: [
    "..H..HHHH..H..",
    "..HHHHHHHHHH..",
    "...HHHHHHHH...",
    "...HSSSSSSH...",
    "...SSSSSSSS...",
    "...SSSSSSSS...",
    "....SSSSSS....",
    ".....SSSS.....",
  ],
  achatado: [
    "..............",
    "...HHHHHHHH...",
    "..HHHHHHHHHH..",
    "...SSSSSSSS...",
    "...SSSSSSSS...",
    "...SSSSSSSS...",
    "...SSSSSSSS...",
    ".....SSSS.....",
  ],
  moicano: [
    ".....HHHH.....",
    "....HHHHHH....",
    "...HHHHHHHH...",
    "...HSSSSSSH...",
    "...SSSSSSSS...",
    "...SSSSSSSS...",
    "....SSSSSS....",
    ".....SSSS.....",
  ],
  calvo: [
    "..............",
    ".....SSSS.....",
    "...HSSSSSSH...",
    "...HSSSSSSH...",
    "...SSSSSSSS...",
    "...SSSSSSSS...",
    "....SSSSSS....",
    ".....SSSS.....",
  ],
};

const BODIES: Record<string, Rows> = {
  jaqueta: [
    "..RRRRRRRRRR..",
    ".RRRRRRRRRRRR.",
    ".SRRRRRRRRRRS.",
    ".SRRRRRRRRRRS.",
    "..RRRRRRRRRR..",
    "..RRR....RRR..",
    "..OOO....OOO..",
    "..OOO....OOO..",
  ],
  jaleco: [
    "..CCCCRRCCCC..",
    ".CCCCCRRCCCCC.",
    ".SCCCCRRCCCCS.",
    ".SCCCCRRCCCCS.",
    "..CCCCCCCCCC..",
    "..CCC....CCC..",
    "..OOO....OOO..",
    "..OOO....OOO..",
  ],
};

/* ------------------------------- expressões ------------------------------- */

type Pixels = readonly (readonly [number, number])[];

export const EXPRESSOES = [
  {
    id: "caotico",
    label: "Sorriso caótico",
    olhos: [
      [4, 4],
      [9, 4],
    ],
    boca: [
      [4, 6],
      [5, 6],
      [6, 6],
      [7, 6],
      [8, 6],
      [9, 6],
    ],
  },
  {
    id: "vazio",
    label: "Olhar vazio",
    olhos: [
      [4, 4],
      [5, 4],
      [8, 4],
      [9, 4],
    ],
    boca: [
      [6, 6],
      [7, 6],
    ],
  },
  {
    id: "surpresa",
    label: "Surpresa",
    olhos: [
      [4, 4],
      [9, 4],
    ],
    boca: [
      [6, 5],
      [7, 5],
      [6, 6],
      [7, 6],
    ],
  },
  {
    id: "serio",
    label: "Sério",
    olhos: [
      [4, 4],
      [9, 4],
    ],
    boca: [
      [5, 6],
      [6, 6],
      [7, 6],
      [8, 6],
    ],
  },
] as const satisfies readonly { id: string; label: string; olhos: Pixels; boca: Pixels }[];

export type ExpressaoId = (typeof EXPRESSOES)[number]["id"];

/* -------------------------------- acessórios ------------------------------- */

export const ACESSORIOS = [
  { id: "nenhum", label: "Nenhum", pixels: [] as Pixels, css: INK },
  {
    id: "cartola",
    label: "Cartola",
    css: "var(--purple)",
    pixels: [
      [4, 0],
      [5, 0],
      [6, 0],
      [7, 0],
      [8, 0],
      [9, 0],
      [3, 1],
      [4, 1],
      [5, 1],
      [6, 1],
      [7, 1],
      [8, 1],
      [9, 1],
      [10, 1],
    ] as Pixels,
  },
  {
    id: "oculos",
    label: "Óculos escuros",
    css: INK,
    pixels: [
      [3, 4],
      [4, 4],
      [5, 4],
      [6, 4],
      [7, 4],
      [8, 4],
      [9, 4],
      [10, 4],
    ] as Pixels,
  },
  {
    id: "mascara",
    label: "Máscara do Coringa",
    css: "var(--destructive)",
    pixels: [
      [4, 6],
      [5, 6],
      [6, 6],
      [7, 6],
      [8, 6],
      [9, 6],
      [5, 5],
      [8, 5],
    ] as Pixels,
  },
  {
    id: "faixa",
    label: "Faixa de hospital",
    css: "var(--foreground)",
    pixels: [
      [3, 3],
      [4, 3],
      [5, 3],
      [6, 3],
      [7, 3],
      [8, 3],
      [9, 3],
      [10, 3],
      [10, 2],
    ] as Pixels,
  },
] as const;

export type AcessorioId = (typeof ACESSORIOS)[number]["id"];

/* ----------------------------- itens na mão ------------------------------- */

type ItemPixel = readonly [number, number, string];

export const ITENS = [
  { id: "nenhum", label: "Mão livre", pixels: [] as readonly ItemPixel[] },
  {
    id: "cerveja",
    label: "Cerveja",
    pixels: [
      [12, 8, "var(--foreground)"],
      [13, 8, "var(--foreground)"],
      [12, 9, "var(--whisky)"],
      [13, 9, "var(--whisky)"],
      [12, 10, "var(--whisky)"],
      [13, 10, "var(--whisky)"],
    ] as readonly ItemPixel[],
  },
  {
    id: "cigarro",
    label: "Cigarro",
    pixels: [
      [12, 9, "var(--foreground)"],
      [13, 9, "var(--destructive)"],
      [13, 8, "var(--muted-foreground)"],
      [12, 7, "var(--muted-foreground)"],
    ] as readonly ItemPixel[],
  },
  {
    id: "raquete",
    label: "Raquete de tênis",
    pixels: [
      [12, 5, "var(--foreground)"],
      [11, 6, "var(--foreground)"],
      [13, 6, "var(--foreground)"],
      [11, 7, "var(--foreground)"],
      [13, 7, "var(--foreground)"],
      [12, 8, "var(--foreground)"],
      [12, 9, "var(--whisky)"],
      [12, 10, "var(--whisky)"],
    ] as readonly ItemPixel[],
  },
  {
    id: "energetico",
    label: "Energético",
    pixels: [
      [12, 8, "var(--muted-foreground)"],
      [13, 8, "var(--muted-foreground)"],
      [12, 9, "var(--neon)"],
      [13, 9, "var(--neon)"],
      [12, 10, "var(--purple)"],
      [13, 10, "var(--purple)"],
    ] as readonly ItemPixel[],
  },
] as const;

export type ItemId = (typeof ITENS)[number]["id"];

/* ------------------------------- personagens ------------------------------ */

export const PERSONAGENS = [
  {
    id: "interno",
    nome: "O Interno",
    tagline: "Paciente zero da pista",
    head: "curto",
    body: "jaqueta",
    padrao: { cabelo: "branco", roupa: "verde" },
  },
  {
    id: "enfermeira",
    nome: "A Enfermeira do Caos",
    tagline: "Aplica doses generosas",
    head: "longo",
    body: "jaleco",
    padrao: { cabelo: "amarelo", roupa: "roxo" },
  },
  {
    id: "coringa",
    nome: "O Coringa de Plantão",
    tagline: "Ri antes da piada",
    head: "espetado",
    body: "jaqueta",
    padrao: { cabelo: "verde", roupa: "roxo" },
  },
  {
    id: "seguranca",
    nome: "O Segurança Dorminhoco",
    tagline: "Vigia com os olhos fechados",
    head: "achatado",
    body: "jaqueta",
    padrao: { cabelo: "roxo", roupa: "vermelho" },
  },
  {
    id: "dj",
    nome: "A DJ do Isolamento",
    tagline: "Trilha sonora do delírio",
    head: "moicano",
    body: "jaqueta",
    padrao: { cabelo: "roxo", roupa: "amarelo" },
  },
  {
    id: "doutor",
    nome: "O Doutor Duvidoso",
    tagline: "Diploma em papel de bar",
    head: "calvo",
    body: "jaleco",
    padrao: { cabelo: "branco", roupa: "verde" },
  },
] as const;

export type PersonagemId = (typeof PERSONAGENS)[number]["id"];

export type Avatar = {
  cabelo: CorId;
  roupa: CorId;
  acessorio: AcessorioId;
  expressao: ExpressaoId;
  item: ItemId;
};

export const AVATAR_PADRAO: Avatar = {
  cabelo: "branco",
  roupa: "verde",
  acessorio: "nenhum",
  expressao: "caotico",
  item: "nenhum",
};

export const PERSONAGEM_PADRAO: PersonagemId = "interno";

function idsDe<T extends { id: string }>(lista: readonly T[]): string[] {
  return lista.map((i) => i.id);
}

/** Lê um avatar de fonte desconhecida (banco/localStorage) sem quebrar. */
export function normalizarAvatar(valor: unknown): Avatar {
  const v = (valor ?? {}) as Partial<Record<keyof Avatar, string>>;
  const cores = CORES.map((c) => c.id) as string[];
  return {
    cabelo: (cores.includes(v.cabelo ?? "") ? v.cabelo : AVATAR_PADRAO.cabelo) as CorId,
    roupa: (cores.includes(v.roupa ?? "") ? v.roupa : AVATAR_PADRAO.roupa) as CorId,
    acessorio: (idsDe(ACESSORIOS).includes(v.acessorio ?? "")
      ? v.acessorio
      : AVATAR_PADRAO.acessorio) as AcessorioId,
    expressao: (idsDe(EXPRESSOES).includes(v.expressao ?? "")
      ? v.expressao
      : AVATAR_PADRAO.expressao) as ExpressaoId,
    item: (idsDe(ITENS).includes(v.item ?? "") ? v.item : AVATAR_PADRAO.item) as ItemId,
  };
}

export function normalizarPersonagem(valor: unknown): PersonagemId {
  const ids = idsDe(PERSONAGENS);
  return (ids.includes(String(valor)) ? String(valor) : PERSONAGEM_PADRAO) as PersonagemId;
}

export function personagemPor(id: PersonagemId) {
  return PERSONAGENS.find((p) => p.id === id) ?? PERSONAGENS[0];
}

export function avatarPadraoDe(id: PersonagemId): Avatar {
  const p = personagemPor(id);
  return { ...AVATAR_PADRAO, cabelo: p.padrao.cabelo, roupa: p.padrao.roupa };
}

export function avatarAleatorio(): { personagem: PersonagemId; avatar: Avatar } {
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
  const personagem = pick(PERSONAGENS).id;
  return {
    personagem,
    avatar: {
      cabelo: pick(CORES).id,
      roupa: pick(CORES).id,
      acessorio: pick(ACESSORIOS).id,
      expressao: pick(EXPRESSOES).id,
      item: pick(ITENS).id,
    },
  };
}

/** Monta a matriz final de cores (null = pixel transparente). */
export function montarPixels(personagemId: PersonagemId, avatar: Avatar): (string | null)[][] {
  const p = personagemPor(personagemId);
  const rows = [...(HEADS[p.head] ?? HEADS["curto"]!), ...(BODIES[p.body] ?? BODIES["jaqueta"]!)];
  const hair = cor(avatar.cabelo);
  const cloth = cor(avatar.roupa);

  const grid: (string | null)[][] = Array.from({ length: GRID_H }, (_, y) =>
    Array.from({ length: GRID_W }, (_, x) => {
      const ch = rows[y]?.[x] ?? ".";
      if (ch === "H") return hair;
      if (ch === "S") return SKIN;
      if (ch === "R") return cloth;
      if (ch === "C") return COAT;
      if (ch === "O") return OUTLINE;
      return null;
    }),
  );

  const set = (x: number, y: number, c: string) => {
    if (y >= 0 && y < GRID_H && x >= 0 && x < GRID_W) grid[y]![x] = c;
  };

  const exp = EXPRESSOES.find((e) => e.id === avatar.expressao) ?? EXPRESSOES[0];
  for (const [x, y] of [...exp.olhos, ...exp.boca]) set(x, y, INK);

  const acc = ACESSORIOS.find((a) => a.id === avatar.acessorio);
  if (acc) for (const [x, y] of acc.pixels) set(x, y, acc.css);

  const item = ITENS.find((i) => i.id === avatar.item);
  if (item) for (const [x, y, c] of item.pixels) set(x, y, c);

  return grid;
}
