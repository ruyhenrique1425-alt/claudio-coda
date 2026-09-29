/**
 * As datas da festa. Todas em UTC, porque o horário de Brasília é UTC-3 e o
 * relógio do celular de cada convidado pode estar em qualquer fuso.
 */

/** O pódio congela às 3:33 do dia 30/10, horário de Brasília. */
export const APURACAO = new Date("2026-10-30T06:33:00Z");

/** A alta só é liberada entre 22h e 7h. */
export const ALTA_ABRE = 22;
export const ALTA_FECHA = 7;

/* ------------------------- revelação de fotos e mural ---------------------- */

export type EstadoRevelacao = "recente" | "anonimo" | "revelado";

const JANELA_RECENTE_MS = 60 * 60 * 1000;
const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * "Dia civil" em Brasília como um número inteiro, imune ao fuso de quem roda
 * o código (celular do convidado ou servidor). Dois horários caem no mesmo
 * dia quando esse número bate.
 */
function diaBrasilia(data: Date): number {
  return Math.floor((data.getTime() - BRASILIA_OFFSET_MS) / 86_400_000);
}

/**
 * Uma foto ou recado nasce visível (com autor e conteúdo), fica em segredo
 * depois de uma hora — o autor continua à vista, só o conteúdo (a foto, o
 * texto do recado) embaça — e volta a revelar tudo no dia seguinte. É o "o
 * que rolou ontem?" da manhã seguinte, todo dia, em vez de um embargo único
 * até uma data fixa da festa.
 */
export function estadoDoPost(criadoEm: Date | string, agora: Date = new Date()): EstadoRevelacao {
  const quando = typeof criadoEm === "string" ? new Date(criadoEm) : criadoEm;
  if (diaBrasilia(agora) !== diaBrasilia(quando)) return "revelado";
  return agora.getTime() - quando.getTime() < JANELA_RECENTE_MS ? "recente" : "anonimo";
}

export function jaApurou(agora: Date = new Date()): boolean {
  return agora.getTime() >= APURACAO.getTime();
}

/** Usa o horário local do aparelho: o convidado está na festa, não em outro fuso. */
export function altaLiberada(agora: Date = new Date()): boolean {
  const h = agora.getHours();
  return h >= ALTA_ABRE || h < ALTA_FECHA;
}

/** Próxima abertura da alta, para o contador regressivo. */
export function proximaAlta(agora: Date = new Date()): Date {
  const alvo = new Date(agora);
  alvo.setHours(ALTA_ABRE, 0, 0, 0);
  if (alvo.getTime() <= agora.getTime()) alvo.setDate(alvo.getDate() + 1);
  return alvo;
}

/** "14H 22M 09S" — o formato do painel de fliperama. */
export function formatarRestante(ms: number): string {
  if (ms <= 0) return "00H 00M 00S";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}H ${pad(m)}M ${pad(s)}S`;
}
