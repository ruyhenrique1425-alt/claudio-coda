import { beforeEach, describe, expect, it } from "vitest";

import { avisosDoRanking } from "./avisos-ranking";
import type { LinhaRanking } from "./pontos";

function linha(id: string, nome: string, ganhos: number): LinhaRanking {
  return {
    paciente_id: id,
    nome,
    personagem: "interno",
    avatar: {},
    itens: {},
    ganhos_total: ganhos,
    saldo: ganhos,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("avisosDoRanking", () => {
  it("não avisa nada na primeira leitura — só guarda o retrato", () => {
    const linhas = [linha("a", "Ana", 300), linha("b", "Bia", 100)];
    expect(avisosDoRanking(linhas, "a")).toEqual([]);
    expect(localStorage.getItem("ranking_visto")).not.toBeNull();
  });

  it("avisa quando o dono do celular entra no top 3", () => {
    const antes = [linha("a", "Ana", 50), linha("b", "Bia", 40), linha("c", "Ciça", 30)];
    avisosDoRanking(antes, "d"); // "d" fora do placar na primeira leitura

    const depois = [
      linha("a", "Ana", 50),
      linha("d", "Duda", 45),
      linha("b", "Bia", 40),
      linha("c", "Ciça", 30),
    ];
    const avisos = avisosDoRanking(depois, "d");
    expect(avisos.some((a) => a.tipo === "podio" && /TOP 3/.test(a.texto))).toBe(true);
  });

  it("avisa quando alguém rouba a posição do dono do celular", () => {
    const antes = [linha("a", "Ana", 50), linha("d", "Duda", 40)];
    avisosDoRanking(antes, "d");

    // Ana continua na frente, mas agora "Zeca" também passou Duda.
    const depois = [linha("a", "Ana", 60), linha("z", "Zeca", 45), linha("d", "Duda", 40)];
    const avisos = avisosDoRanking(depois, "d");
    expect(avisos.some((a) => a.tipo === "ultrapassado" && a.texto.includes("ZECA"))).toBe(true);
  });

  it("avisa marco de fichas só quando cruza um novo limiar", () => {
    const antes = [linha("d", "Duda", 90)];
    avisosDoRanking(antes, "d");

    const cruzou100 = [linha("d", "Duda", 120)];
    const primeiro = avisosDoRanking(cruzou100, "d");
    expect(primeiro.some((a) => a.tipo === "marco" && a.texto.includes("100"))).toBe(true);

    // Subiu mais, mas ainda dentro do mesmo marco (100): não repete o aviso.
    const aindaNoMesmoMarco = [linha("d", "Duda", 150)];
    const segundo = avisosDoRanking(aindaNoMesmoMarco, "d");
    expect(segundo.some((a) => a.tipo === "marco")).toBe(false);
  });

  it("avisa troca de líder da ala para todo mundo, não só para quem virou líder", () => {
    const antes = [linha("a", "Ana", 100), linha("b", "Bia", 90)];
    avisosDoRanking(antes, "c"); // espectador, nem está no placar

    const depois = [linha("b", "Bia", 110), linha("a", "Ana", 100)];
    const avisos = avisosDoRanking(depois, "c");
    expect(avisos.some((a) => a.tipo === "podio" && a.texto.includes("BIA"))).toBe(true);
  });

  it("devolve lista vazia quando o placar está vazio", () => {
    expect(avisosDoRanking([], "qualquer")).toEqual([]);
  });
});
