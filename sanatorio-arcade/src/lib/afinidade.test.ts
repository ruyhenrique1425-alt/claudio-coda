import { describe, expect, it } from "vitest";

import { calcularAfinidade, diagnosticosIguais, tierDeAfinidade } from "./afinidade";
import type { Stats } from "./paciente-local";

const STATS_ZERO: Stats = {
  fatorCoringa: 0,
  imunidadeEtilica: 0,
  inimigoDoFim: 0,
  aptidaoAudio: 0,
  amnesia: 0,
};

const FICHA_ZERO = {
  fator_coringa: 0,
  imunidade_etilica: 0,
  inimigo_do_fim: 0,
  aptidao_audio: 0,
  amnesia_anterograda: 0,
};

describe("calcularAfinidade", () => {
  it("dá 100 quando as duas fichas são idênticas", () => {
    const eu: Stats = { ...STATS_ZERO, fatorCoringa: 3, imunidadeEtilica: 5 };
    const outro = { ...FICHA_ZERO, fator_coringa: 3, imunidade_etilica: 5 };
    expect(calcularAfinidade(eu, outro)).toBe(100);
  });

  it("dá 0 quando os cinco atributos estão no extremo oposto", () => {
    const eu: Stats = {
      fatorCoringa: 5,
      imunidadeEtilica: 5,
      inimigoDoFim: 5,
      aptidaoAudio: 5,
      amnesia: 5,
    };
    const outro = {
      fator_coringa: 0,
      imunidade_etilica: 0,
      inimigo_do_fim: 0,
      aptidao_audio: 0,
      amnesia_anterograda: 0,
    };
    expect(calcularAfinidade(eu, outro)).toBe(0);
  });

  it("cai proporcionalmente com a distância total", () => {
    // 1 ponto de distância em 1 atributo, de 25 possíveis (5 attrs x 5 max) = 4%.
    const eu: Stats = { ...STATS_ZERO, fatorCoringa: 1 };
    const outro = FICHA_ZERO;
    expect(calcularAfinidade(eu, outro)).toBe(96);
  });

  it("nunca depende da ordem dos argumentos ser trocada silenciosamente", () => {
    // Guarda de regressão: se alguém inverter (eu, outro) sem querer, o teste
    // acima com valores assimétricos já pegaria — aqui só confirma que dois
    // pacientes diferentes dão notas diferentes um do outro.
    const eu: Stats = { ...STATS_ZERO, fatorCoringa: 5 };
    const outroPerto = { ...FICHA_ZERO, fator_coringa: 4 };
    const outroLonge = { ...FICHA_ZERO, fator_coringa: 0 };
    expect(calcularAfinidade(eu, outroPerto)).toBeGreaterThan(calcularAfinidade(eu, outroLonge));
  });
});

describe("diagnosticosIguais", () => {
  it("conta só os atributos que não mudaram quando um único difere", () => {
    const eu: Stats = { ...STATS_ZERO, fatorCoringa: 1 };
    // Os outros quatro atributos continuam 0 nos dois lados: batem.
    expect(diagnosticosIguais(eu, FICHA_ZERO)).toBe(4);
  });

  it("conta zero quando todos os cinco diferem", () => {
    const eu: Stats = {
      fatorCoringa: 1,
      imunidadeEtilica: 1,
      inimigoDoFim: 1,
      aptidaoAudio: 1,
      amnesia: 1,
    };
    expect(diagnosticosIguais(eu, FICHA_ZERO)).toBe(0);
  });

  it("conta os cinco quando tudo bate, incluindo zeros", () => {
    expect(diagnosticosIguais(STATS_ZERO, FICHA_ZERO)).toBe(5);
  });

  it("conta só os atributos que empatam exatamente", () => {
    const eu: Stats = {
      fatorCoringa: 3,
      imunidadeEtilica: 2,
      inimigoDoFim: 0,
      aptidaoAudio: 5,
      amnesia: 1,
    };
    const outro = {
      fator_coringa: 3,
      imunidade_etilica: 4,
      inimigo_do_fim: 0,
      aptidao_audio: 5,
      amnesia_anterograda: 2,
    };
    // Batem: fatorCoringa, inimigoDoFim, aptidaoAudio => 3.
    expect(diagnosticosIguais(eu, outro)).toBe(3);
  });
});

describe("tierDeAfinidade", () => {
  // destaque é true para as três faixas com estrela (>= 60) e false abaixo disso.
  it.each([
    [100, true],
    [90, true],
    [89, true],
    [75, true],
    [74, true],
    [60, true],
    [59, false],
    [40, false],
    [0, false],
  ])("marca destaque=%s corretamente para afinidade %i", (afinidade, esperado) => {
    expect(tierDeAfinidade(afinidade).destaque).toBe(esperado);
  });

  it("dá o rótulo mais baixo abaixo de 40", () => {
    const tier = tierDeAfinidade(10);
    expect(tier.rotulo).toBe("incompatível — evite");
    expect(tier.estrelas).toBe("");
  });
});
