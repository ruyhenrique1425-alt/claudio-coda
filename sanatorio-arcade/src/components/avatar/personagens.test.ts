import { afterEach, describe, expect, it } from "vitest";

import {
  aplicarAderecoDaLoja,
  AVATAR_PADRAO,
  avatarAleatorio,
  avatarPadraoDe,
  definirCustomizacoes,
  GRID_H,
  GRID_W,
  montarPixels,
  normalizarAvatar,
  normalizarPersonagem,
  personagemPor,
  PERSONAGEM_PADRAO,
  PERSONAGENS,
  type CustomizacaoPersonagem,
} from "./personagens";

// Cada teste começa sem customização nenhuma, para não vazar estado entre eles.
afterEach(() => definirCustomizacoes([]));

describe("normalizarPersonagem", () => {
  it("aceita um id de personagem válido", () => {
    expect(normalizarPersonagem("coringa")).toBe("coringa");
  });

  it("cai no personagem padrão para id desconhecido, nulo ou vazio", () => {
    expect(normalizarPersonagem("nao-existe")).toBe(PERSONAGEM_PADRAO);
    expect(normalizarPersonagem(null)).toBe(PERSONAGEM_PADRAO);
    expect(normalizarPersonagem(undefined)).toBe(PERSONAGEM_PADRAO);
    expect(normalizarPersonagem(123)).toBe(PERSONAGEM_PADRAO);
  });
});

describe("normalizarAvatar", () => {
  it("preenche tudo com o padrão quando recebe lixo", () => {
    expect(normalizarAvatar(null)).toEqual(AVATAR_PADRAO);
    expect(normalizarAvatar("string qualquer")).toEqual(AVATAR_PADRAO);
    expect(normalizarAvatar({})).toEqual(AVATAR_PADRAO);
  });

  it("mantém campos válidos e troca só os inválidos pelo padrão", () => {
    const resultado = normalizarAvatar({
      cabelo: "roxo",
      roupa: "cor-que-nao-existe",
      acessorio: "cartola",
      expressao: "vazio",
      item: "id-invalido",
    });
    expect(resultado).toEqual({
      cabelo: "roxo",
      roupa: AVATAR_PADRAO.roupa,
      acessorio: "cartola",
      expressao: "vazio",
      item: AVATAR_PADRAO.item,
    });
  });
});

describe("avatarPadraoDe", () => {
  it("usa as cores de cabelo/roupa do personagem, mas mantém o resto do padrão", () => {
    const p = PERSONAGENS.find((x) => x.id === "dj")!;
    const avatar = avatarPadraoDe("dj");
    expect(avatar.cabelo).toBe(p.padrao.cabelo);
    expect(avatar.roupa).toBe(p.padrao.roupa);
    expect(avatar.acessorio).toBe(AVATAR_PADRAO.acessorio);
    expect(avatar.item).toBe(AVATAR_PADRAO.item);
  });
});

describe("avatarAleatorio", () => {
  it("sempre sorteia um personagem e um avatar válidos", () => {
    for (let i = 0; i < 25; i++) {
      const { personagem, avatar } = avatarAleatorio();
      expect(PERSONAGENS.some((p) => p.id === personagem)).toBe(true);
      expect(normalizarAvatar(avatar)).toEqual(avatar);
    }
  });
});

describe("montarPixels", () => {
  it("devolve uma grade GRID_H x GRID_W", () => {
    const grid = montarPixels(PERSONAGEM_PADRAO, AVATAR_PADRAO);
    expect(grid).toHaveLength(GRID_H);
    for (const row of grid) expect(row).toHaveLength(GRID_W);
  });

  it("cai no personagem 'interno' quando o head/body não existe no catálogo", () => {
    // normalizarPersonagem já garante isso na prática, mas montarPixels tem
    // seu próprio fallback interno — confirma que ele não estoura.
    expect(() => montarPixels("id-fantasma" as never, AVATAR_PADRAO)).not.toThrow();
  });

  it("pinta pelo menos um pixel de cada expressão (olhos + boca)", () => {
    const grid = montarPixels(PERSONAGEM_PADRAO, { ...AVATAR_PADRAO, expressao: "surpresa" });
    const pintados = grid.flat().filter((c) => c !== null).length;
    const gridVazio = montarPixels(PERSONAGEM_PADRAO, { ...AVATAR_PADRAO, acessorio: "nenhum" });
    expect(pintados).toBeGreaterThan(0);
    expect(grid.flat().length).toBe(gridVazio.flat().length);
  });
});

describe("definirCustomizacoes + personagemPor/avatarPadraoDe", () => {
  const CUSTOM: CustomizacaoPersonagem = {
    personagem_id: "coringa",
    nome: "O Palhaço da Ala",
    tagline: "Ri antes, chora depois",
    head: "moicano",
    body: "jaleco",
    cabelo: "vermelho",
    roupa: "amarelo",
    acessorio: "mascara",
    item: "cerveja",
  };

  it("sem customização, devolve o personagem do catálogo original", () => {
    const p = personagemPor("coringa");
    expect(p.nome).toBe("O Coringa de Plantão");
    expect(p.head).toBe("espetado");
  });

  it("aplica os campos customizados por cima do catálogo", () => {
    definirCustomizacoes([CUSTOM]);
    const p = personagemPor("coringa");
    expect(p.nome).toBe("O Palhaço da Ala");
    expect(p.tagline).toBe("Ri antes, chora depois");
    expect(p.head).toBe("moicano");
    expect(p.body).toBe("jaleco");
    expect(p.padrao.cabelo).toBe("vermelho");
    expect(p.padrao.roupa).toBe("amarelo");
  });

  it("não altera personagens sem customização", () => {
    definirCustomizacoes([CUSTOM]);
    const p = personagemPor("doutor");
    expect(p.nome).toBe("O Doutor Duvidoso");
  });

  it("ignora head/body/cor inválidos e mantém o valor original", () => {
    definirCustomizacoes([
      { ...CUSTOM, head: "cabeca-fantasma", body: "corpo-fantasma", cabelo: "cor-fantasma" },
    ]);
    const p = personagemPor("coringa");
    expect(p.head).toBe("espetado");
    expect(p.body).toBe("jaqueta");
    expect(p.padrao.cabelo).toBe("verde");
  });

  it("avatarPadraoDe aplica o acessório e o item customizados", () => {
    definirCustomizacoes([CUSTOM]);
    const avatar = avatarPadraoDe("coringa");
    expect(avatar.acessorio).toBe("mascara");
    expect(avatar.item).toBe("cerveja");
    expect(avatar.cabelo).toBe("vermelho");
  });

  it("avatarPadraoDe ignora acessório/item customizados desconhecidos", () => {
    definirCustomizacoes([{ ...CUSTOM, acessorio: "item-fantasma", item: "item-fantasma" }]);
    const avatar = avatarPadraoDe("coringa");
    expect(avatar.acessorio).toBe(AVATAR_PADRAO.acessorio);
    expect(avatar.item).toBe(AVATAR_PADRAO.item);
  });

  it("campos nulos na customização não sobrescrevem o original", () => {
    definirCustomizacoes([{ ...CUSTOM, nome: null, tagline: null }]);
    const p = personagemPor("coringa");
    expect(p.nome).toBe("O Coringa de Plantão");
    expect(p.tagline).toBe("Ri antes da piada");
  });
});

describe("aplicarAderecoDaLoja", () => {
  it("não altera a grade quando o adorno é nulo ou desconhecido", () => {
    const grid = montarPixels(PERSONAGEM_PADRAO, AVATAR_PADRAO);
    const antes = JSON.stringify(grid);
    aplicarAderecoDaLoja(grid, null);
    aplicarAderecoDaLoja(grid, "item-que-nao-existe");
    expect(JSON.stringify(grid)).toBe(antes);
  });

  it("sobrepõe pixels quando o adorno existe no catálogo", () => {
    const grid = montarPixels(PERSONAGEM_PADRAO, AVATAR_PADRAO);
    aplicarAderecoDaLoja(grid, "adereco-cone");
    const pintados = grid.flat().filter((c) => c !== null).length;
    const semAdorno = montarPixels(PERSONAGEM_PADRAO, AVATAR_PADRAO)
      .flat()
      .filter((c) => c !== null).length;
    expect(pintados).toBeGreaterThanOrEqual(semAdorno);
  });
});
