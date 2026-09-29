import { describe, expect, it } from "vitest";

import { estadoDoPost } from "./datas";

// Meio-dia em Brasília (UTC-3) = 15h UTC — longe de qualquer virada de dia.
const CRIADO = new Date("2026-10-15T15:00:00Z");

describe("estadoDoPost", () => {
  it("é 'recente' logo após postar", () => {
    expect(estadoDoPost(CRIADO, new Date(CRIADO.getTime() + 5 * 60 * 1000))).toBe("recente");
  });

  it("continua 'recente' até completar 1 hora", () => {
    expect(estadoDoPost(CRIADO, new Date(CRIADO.getTime() + 59 * 60 * 1000))).toBe("recente");
  });

  it("vira 'anonimo' assim que completa 1 hora, no mesmo dia", () => {
    expect(estadoDoPost(CRIADO, new Date(CRIADO.getTime() + 60 * 60 * 1000))).toBe("anonimo");
    expect(estadoDoPost(CRIADO, new Date(CRIADO.getTime() + 5 * 60 * 60 * 1000))).toBe("anonimo");
  });

  it("vira 'revelado' assim que muda o dia civil em Brasília", () => {
    // 23h59 de Brasília (15/10) = 02h59 UTC do dia 16 — ainda é dia 15 em Brasília.
    const antesDaMeiaNoite = new Date("2026-10-16T02:59:00Z");
    expect(estadoDoPost(CRIADO, antesDaMeiaNoite)).toBe("anonimo");

    // 00h01 de Brasília do dia 16 = 03h01 UTC — já é o dia seguinte.
    const depoisDaMeiaNoite = new Date("2026-10-16T03:01:00Z");
    expect(estadoDoPost(CRIADO, depoisDaMeiaNoite)).toBe("revelado");
  });

  it("aceita string ISO além de Date", () => {
    expect(estadoDoPost(CRIADO.toISOString(), new Date(CRIADO.getTime() + 60_000))).toBe("recente");
  });

  it("nunca regride: uma vez revelado, dias depois continua revelado", () => {
    const semanaDepois = new Date(CRIADO.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(estadoDoPost(CRIADO, semanaDepois)).toBe("revelado");
  });
});
