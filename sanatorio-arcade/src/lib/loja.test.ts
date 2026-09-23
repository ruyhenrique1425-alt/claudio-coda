import { describe, expect, it } from "vitest";

import { equipado, itemPorId, normalizarInventario } from "./loja";

describe("normalizarInventario", () => {
  it("devolve vazio para entrada nula ou não-objeto", () => {
    expect(normalizarInventario(null)).toEqual({ comprados: [], equipados: {} });
    expect(normalizarInventario(undefined)).toEqual({ comprados: [], equipados: {} });
    expect(normalizarInventario("lixo")).toEqual({ comprados: [], equipados: {} });
    expect(normalizarInventario(42)).toEqual({ comprados: [], equipados: {} });
  });

  it("filtra entradas de 'comprados' que não são string", () => {
    const v = { comprados: ["moldura-sirene", 123, null, "adereco-cone"] };
    expect(normalizarInventario(v).comprados).toEqual(["moldura-sirene", "adereco-cone"]);
  });

  it("só aceita os três slots conhecidos em 'equipados'", () => {
    const v = {
      equipados: {
        moldura: "moldura-sirene",
        adereco: "adereco-cone",
        nome: "nome-neon",
        slot_invalido: "nao devia aparecer",
      },
    };
    expect(normalizarInventario(v).equipados).toEqual({
      moldura: "moldura-sirene",
      adereco: "adereco-cone",
      nome: "nome-neon",
    });
  });

  it("ignora valor não-string equipado num slot", () => {
    const v = { equipados: { moldura: 123 } };
    expect(normalizarInventario(v).equipados).toEqual({});
  });
});

describe("itemPorId", () => {
  it("acha um item real do catálogo", () => {
    expect(itemPorId("adereco-cone")?.nome).toBe("Cone de trânsito");
  });

  it("devolve null para id desconhecido, vazio ou ausente", () => {
    expect(itemPorId("item-que-nao-existe")).toBeNull();
    expect(itemPorId("")).toBeNull();
    expect(itemPorId(null)).toBeNull();
    expect(itemPorId(undefined)).toBeNull();
  });
});

describe("equipado", () => {
  it("devolve o item equipado num slot", () => {
    const itens = { equipados: { adereco: "adereco-copo" } };
    expect(equipado(itens, "adereco")?.id).toBe("adereco-copo");
  });

  it("devolve null quando o slot está vazio ou o inventário é inválido", () => {
    expect(equipado({}, "moldura")).toBeNull();
    expect(equipado(null, "nome")).toBeNull();
  });
});
