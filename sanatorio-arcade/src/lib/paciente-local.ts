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
  personagem: PersonagemId;
  avatar: Avatar;
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

export function limparProntuario() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem("paciente_id");
  } catch {
    /* nada a limpar */
  }
}
