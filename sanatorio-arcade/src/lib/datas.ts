/**
 * As datas da festa. Todas em UTC, porque o horário de Brasília é UTC-3 e o
 * relógio do celular de cada convidado pode estar em qualquer fuso.
 */

/** Fotos e recados ficam embargados até 30/10 às 12h de Brasília. */
export const REVELACAO = new Date("2026-10-30T15:00:00Z");

/** O pódio congela às 3:33 do dia 30/10, horário de Brasília. */
export const APURACAO = new Date("2026-10-30T06:33:00Z");

/** A alta só é liberada entre 22h e 7h. */
export const ALTA_ABRE = 22;
export const ALTA_FECHA = 7;

export function jaRevelou(agora: Date = new Date()): boolean {
  return agora.getTime() >= REVELACAO.getTime();
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
