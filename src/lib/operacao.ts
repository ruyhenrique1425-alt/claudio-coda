/**
 * Regras de negócio da operação, em um lugar só.
 *
 * Antes destes valores estarem aqui, eles viviam soltos e duplicados nas
 * telas (o IDEAL_TEMP existia em dois arquivos, e os cortes de severidade
 * eram percentuais escritos direto no dashboard). Isso apareceu na
 * auditoria de linhagem de dados — ver `docs/AUDITORIA-DADOS.md`.
 *
 * Todos os valores abaixo foram CONFIRMADOS PELO GESTOR em 2026-07-24.
 * Se algum precisar mudar, muda aqui e vale para o app inteiro.
 */

// ---------------------------------------------------------------------
// Temperatura do chopp
// ---------------------------------------------------------------------

/** Meta de qualidade: ≤ -1 °C ganha o selo "PADRÃO DISPEL · SUPER GELADO". */
export const IDEAL_TEMP = -1;

/** Acima deste valor o chopp está quente demais e vira alerta. */
export const TEMP_ALERTA = 1;

export type TempStatus = "ideal" | "aceitavel" | "quente";

/**
 * ≤ -1 °C  → ideal (selo)
 * ≤  1 °C  → aceitável
 * >  1 °C  → quente: alerta para o gestor
 */
export function classificarTemperatura(t: number | null | undefined): TempStatus | null {
  if (t === null || t === undefined || !isFinite(t)) return null;
  if (t <= IDEAL_TEMP) return "ideal";
  if (t <= TEMP_ALERTA) return "aceitavel";
  return "quente";
}

// ---------------------------------------------------------------------
// Severidade de reposição
// ---------------------------------------------------------------------
// Regra do gestor: o que importa é a contagem ABSOLUTA de barris cheios,
// não o percentual do padrão. Um bar com 1 cheio precisa de atenção
// mesmo que o padrão dele seja 20; um bar com 0 está parando de vender.

/** Sem nenhum barril cheio: o bar para. */
export const CHEIOS_CRITICO = 0;
/** Último barril cheio: avisar antes de acabar. */
export const CHEIOS_ALERTA = 1;

export type Severity = "ok" | "medium" | "high" | "critical";

/**
 * Severidade a partir da contagem de barris cheios (plugado + fechado).
 *
 *   0 cheios  → critical  (bar sem chopp)
 *   1 cheio   → high      (alerta: último barril)
 *   abaixo do padrão → medium (repor, mas sem urgência)
 *   no padrão → ok
 *
 * `padrao` só é usado para o nível "medium"; bares sem padrão definido
 * nunca passam de "high", porque não há como saber o que falta.
 */
export function severidadePorCheios(cheios: number, padrao: number): Severity {
  if (cheios <= CHEIOS_CRITICO) return "critical";
  if (cheios <= CHEIOS_ALERTA) return "high";
  if (padrao > 0 && cheios < padrao) return "medium";
  return "ok";
}

const ORDEM: Record<Severity, number> = { critical: 0, high: 1, medium: 2, ok: 3 };

/** Retorna a pior severidade entre as informadas. */
export function piorSeveridade(...ss: Severity[]): Severity {
  return ss.reduce((pior, s) => (ORDEM[s] < ORDEM[pior] ? s : pior), "ok" as Severity);
}

export const SEVERITY_ORDER = ORDEM;

// ---------------------------------------------------------------------
// Escopo da operação
// ---------------------------------------------------------------------

/**
 * Tipos de ponto que fazem parte da operação de chopp da DISPEL.
 *
 * `camarote`, `stand` e `haras` ficam de fora de propósito: são
 * abastecidos pela ALLSTAR e não entram na nossa contagem de barris nem
 * no consumo (confirmado pelo gestor). Eles seguem aparecendo nas telas
 * de MANUTENÇÃO e no localizador de chopeira, que usam outro escopo.
 */
export const BAR_TYPES_OPERACAO = ["bar_venda", "bar_parceiro"] as const;

// ---------------------------------------------------------------------
// Vazios "a recolher" — foto do inventário corrigida pelo que já saiu
// ---------------------------------------------------------------------
//
// PROBLEMA QUE ISTO RESOLVE:
// O número de vazios vem do ÚLTIMO inventário do bar, que é uma foto tirada
// num instante T. Quando o operador recolhe os vazios, a linha entra em
// `empties_removed`, mas o inventário NÃO é reescrito — não existe trigger
// nem código no app que faça isso (o único trigger de `empties_removed`
// alimenta o comodato). Resultado: entre um inventário e o próximo, a tela
// continua pedindo para recolher barril que já foi recolhido.
//
// CORREÇÃO: descontar da foto tudo que foi recolhido DEPOIS dela.
//
//     a_recolher = max(0, vazios_no_inventário − recolhidos_após_o_inventário)
//
// Usa só dado que já existe (`empties_removed.performed_at`), não precisa de
// migration nem de mudança no fluxo do operador.

export type EmptyRow = {
  bar_id: string;
  brand: string;
  quantidade: number | null;
  performed_at: string;
};

/**
 * Monta um índice de vazios recolhidos por (bar, marca) DEPOIS da data do
 * último inventário daquele bar.
 *
 * @param empties      linhas de `empties_removed` (qualquer período)
 * @param invAtPorBar  data do último inventário de cada bar (ISO)
 */
export function recolhidosAposInventario(
  empties: EmptyRow[],
  invAtPorBar: Map<string, string | null | undefined>,
): Map<string, number> {
  const idx = new Map<string, number>();
  for (const e of empties ?? []) {
    const invAt = invAtPorBar.get(e.bar_id);
    if (!invAt) continue; // bar sem inventário: não há foto para corrigir
    if (new Date(e.performed_at).getTime() <= new Date(invAt).getTime()) continue;
    const k = `${e.bar_id}|${e.brand}`;
    idx.set(k, (idx.get(k) ?? 0) + (Number(e.quantidade) || 0));
  }
  return idx;
}

/** Aplica o desconto a um valor de vazios vindo da foto do inventário. */
export function vaziosARecolher(
  vaziosNaFoto: number,
  barId: string,
  brand: string,
  recolhidosApos: Map<string, number>,
): number {
  const jaSaiu = recolhidosApos.get(`${barId}|${brand}`) ?? 0;
  return Math.max(0, vaziosNaFoto - jaSaiu);
}
