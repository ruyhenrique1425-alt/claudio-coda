import { describe, expect, it } from "vitest";

import { laudoDe } from "./laudos";
import type { Stats } from "./paciente-local";

const ZERO: Stats = {
  fatorCoringa: 0,
  imunidadeEtilica: 0,
  inimigoDoFim: 0,
  aptidaoAudio: 0,
  amnesia: 0,
};

describe("laudoDe", () => {
  it("dá o laudo de ficha em branco quando tudo é zero", () => {
    expect(laudoDe(ZERO)).toMatch(/ficha em branco/i);
  });

  it("dá laudo de traço único quando o segundo maior é zero", () => {
    const stats: Stats = { ...ZERO, fatorCoringa: 4 };
    expect(laudoDe(stats)).toMatch(/caos puro/i);
  });

  it("dá laudo de traço único quando o primeiro está 3+ pontos acima do segundo", () => {
    const stats: Stats = { ...ZERO, imunidadeEtilica: 5, fatorCoringa: 2 };
    expect(laudoDe(stats)).toMatch(/resistência acima da média/i);
  });

  it("combina os dois maiores quando estão próximos", () => {
    const stats: Stats = { ...ZERO, fatorCoringa: 4, imunidadeEtilica: 3 };
    // Diferença de 1 ponto: laudo combinado, não solo.
    expect(laudoDe(stats)).toMatch(/alto risco combinado/i);
  });

  it("não quebra com empate exato entre os dois maiores", () => {
    const stats: Stats = { ...ZERO, aptidaoAudio: 3, amnesia: 3 };
    expect(() => laudoDe(stats)).not.toThrow();
    expect(laudoDe(stats).length).toBeGreaterThan(0);
  });
});
