import {
  normalizarAvatar,
  normalizarPersonagem,
  type Avatar,
  type PersonagemId,
} from "@/components/avatar/personagens";

export const STORAGE_KEY = "paciente_sanatorio";
const LEGACY_KEY = "sanatorio:paciente";

export type Stats = {
  fatorCoringa: number;
  imunidadeEtilica: number;
  inimigoDoFim: number;
  aptidaoAudio: number;
  amnesia: number;
};

export type Prontuario = {
  nome: string;
  stats: Stats;
  internadoEm: string;
  pacienteId?: string;
  /** Senha do paciente. Sai do banco na internação e nunca mais é lida de lá. */
  token?: string;
  personagem: PersonagemId;
  avatar: Avatar;
  /** Quando o paciente assinou a alta. Ausente enquanto ele estiver internado. */
  altaEm?: string;
};

export function lerProntuario(): Prontuario | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Prontuario>;
    if (!parsed?.nome || !parsed?.stats) return null;
    return {
      nome: parsed.nome,
      stats: parsed.stats,
      internadoEm: parsed.internadoEm ?? new Date().toISOString(),
      ...(parsed.pacienteId ? { pacienteId: parsed.pacienteId } : {}),
      ...(parsed.token ? { token: parsed.token } : {}),
      ...(parsed.altaEm ? { altaEm: parsed.altaEm } : {}),
      personagem: normalizarPersonagem(parsed.personagem),
      avatar: normalizarAvatar(parsed.avatar),
    };
  } catch {
    return null;
  }
}

export function salvarProntuario(p: Prontuario) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    if (p.pacienteId) localStorage.setItem("paciente_id", p.pacienteId);
  } catch {
    /* armazenamento indisponível */
  }
}

/** Credenciais para as funções de pontos. Sem as duas, nada é gravado. */
export function credenciais(): { pacienteId: string; token: string } | null {
  const p = lerProntuario();
  if (!p?.pacienteId || !p.token) return null;
  return { pacienteId: p.pacienteId, token: p.token };
}

export function registrarAlta() {
  const p = lerProntuario();
  if (!p) return null;
  const comAlta: Prontuario = { ...p, altaEm: new Date().toISOString() };
  salvarProntuario(comAlta);
  return comAlta;
}

export function limparProntuario() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem("paciente_id");
  } catch {
    /* nada a limpar */
  }
}
