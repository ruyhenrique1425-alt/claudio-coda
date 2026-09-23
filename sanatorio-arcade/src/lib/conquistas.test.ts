import { afterEach, describe, expect, it } from "vitest";

import {
  CONQUISTAS,
  conquistaPor,
  definirConquistasBar,
  guardarPendente,
  lerPendentes,
  limparPendentes,
  todasConquistas,
  totalConquistas,
} from "./conquistas";

afterEach(() => {
  definirConquistasBar([]);
  localStorage.clear();
});

describe("todasConquistas / conquistaPor", () => {
  it("sem código do bar, devolve só as cinco originais", () => {
    expect(todasConquistas()).toHaveLength(CONQUISTAS.length);
    expect(totalConquistas()).toBe(CONQUISTAS.length);
  });

  it("soma os códigos do bar às originais", () => {
    definirConquistasBar([
      {
        codigo: "piscina",
        titulo: "Mergulho",
        ondeFica: "Na piscina",
        legenda: "Molhou.",
        fichas: 20,
      },
    ]);
    expect(totalConquistas()).toBe(CONQUISTAS.length + 1);
    expect(conquistaPor("piscina")?.titulo).toBe("Mergulho");
  });

  it("um código do bar não pode substituir uma das cinco originais", () => {
    definirConquistasBar([
      { codigo: "bar", titulo: "Forjado", ondeFica: "?", legenda: "?", fichas: 99 },
    ]);
    // A original prevalece — o código reservado do bar é descartado no merge.
    expect(totalConquistas()).toBe(CONQUISTAS.length);
    expect(conquistaPor("bar")?.titulo).toBe("Medicação Líquida");
  });

  it("devolve null para código desconhecido", () => {
    expect(conquistaPor("nao-existe")).toBeNull();
  });
});

describe("pendências guardadas antes da ficha", () => {
  it("guarda e lê um código válido", () => {
    guardarPendente("bar");
    expect(lerPendentes()).toEqual(["bar"]);
  });

  it("aceita um código do bar cadastrado depois de guardado", () => {
    definirConquistasBar([
      {
        codigo: "piscina",
        titulo: "Mergulho",
        ondeFica: "Na piscina",
        legenda: "Molhou.",
        fichas: 20,
      },
    ]);
    guardarPendente("piscina");
    expect(lerPendentes()).toEqual(["piscina"]);
  });

  it("descarta código que não existe em nenhum catálogo", () => {
    localStorage.setItem("sanatorio:conquistas-pendentes", JSON.stringify(["fantasma"]));
    expect(lerPendentes()).toEqual([]);
  });

  it("não duplica o mesmo código", () => {
    guardarPendente("bar");
    guardarPendente("bar");
    expect(lerPendentes()).toEqual(["bar"]);
  });

  it("limparPendentes esvazia a lista", () => {
    guardarPendente("bar");
    limparPendentes();
    expect(lerPendentes()).toEqual([]);
  });
});
