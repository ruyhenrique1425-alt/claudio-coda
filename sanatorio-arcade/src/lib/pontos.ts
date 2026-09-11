/**
 * Carteira do paciente. Nenhuma dessas funções escreve pontos diretamente:
 * todas chamam uma função do Postgres que valida o par (paciente, token).
 * Mexer no localStorage não muda saldo nenhum.
 */
import { supabase } from "@/integrations/supabase/client";
import { credenciais } from "@/lib/paciente-local";

export type Carteira = { saldo: number; ganhos: number };

export type LinhaRanking = {
  paciente_id: string;
  nome: string;
  personagem: string;
  avatar: unknown;
  itens: unknown;
  ganhos_total: number;
  saldo: number;
};

export type Movimento = {
  id: string;
  de_paciente: string | null;
  para_paciente: string;
  pontos: number;
  motivo: string;
  referencia: string | null;
  created_at: string;
};

function exigirCredenciais() {
  const c = credenciais();
  if (!c) throw new Error("Faça sua ficha de admissão antes de mexer nas fichas.");
  return c;
}

/** Traduz o erro cru do Postgres para algo legível às 3h da manhã. */
function explicar(erro: { message?: string } | null): never {
  const m = erro?.message ?? "";
  if (m.includes("Prontuário não confere"))
    throw new Error("Prontuário não confere. Refaça sua ficha.");
  if (m.includes("Fichas insuficientes")) throw new Error("Fichas insuficientes.");
  if (m.includes("já comprou")) throw new Error("Você já tem esse item.");
  if (m.includes("15 minutos"))
    throw new Error("Espere 15 minutos para mandar outra prenda para essa pessoa.");
  if (m.includes("Teto de pontos")) throw new Error("Teto deste jogo atingido. Vá jogar outro.");
  throw new Error(m || "Não deu certo. Tente de novo.");
}

export async function lerCarteira(pacienteId: string): Promise<Carteira> {
  const { data, error } = await supabase
    .from("saldo_pacientes")
    .select("saldo, ganhos_total")
    .eq("paciente_id", pacienteId)
    .maybeSingle();

  if (error) explicar(error);
  return { saldo: Number(data?.saldo ?? 0), ganhos: Number(data?.ganhos_total ?? 0) };
}

export async function lerRanking(limite = 50): Promise<LinhaRanking[]> {
  const { data, error } = await supabase
    .from("saldo_pacientes")
    .select("paciente_id, nome, personagem, avatar, itens, ganhos_total, saldo")
    .order("ganhos_total", { ascending: false })
    .limit(limite);

  if (error) explicar(error);
  return (data ?? []) as LinhaRanking[];
}

export async function lerExtrato(pacienteId: string, limite = 10): Promise<Movimento[]> {
  const { data, error } = await supabase
    .from("transacoes")
    .select("id, de_paciente, para_paciente, pontos, motivo, referencia, created_at")
    .or(`para_paciente.eq.${pacienteId},de_paciente.eq.${pacienteId}`)
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) explicar(error);
  return (data ?? []) as Movimento[];
}

/** Pontos ganhos num minigame. O servidor tem teto por hora e por jogo. */
export async function creditarJogo(pontos: number, jogo: string): Promise<number> {
  const { pacienteId, token } = exigirCredenciais();
  const { data, error } = await supabase.rpc("creditar_pontos", {
    _paciente: pacienteId,
    _token: token,
    _pontos: pontos,
    _motivo: "jogo",
    _referencia: jogo,
  });
  if (error) explicar(error);
  return Number(data);
}

export async function doarPontos(para: string, pontos: number): Promise<number> {
  const { pacienteId, token } = exigirCredenciais();
  const { data, error } = await supabase.rpc("transferir_pontos", {
    _de: pacienteId,
    _token: token,
    _para: para,
    _pontos: pontos,
    _motivo: "doacao",
  });
  if (error) explicar(error);
  return Number(data);
}

export async function comprarItem(itemId: string, preco: number): Promise<number> {
  const { pacienteId, token } = exigirCredenciais();
  const { data, error } = await supabase.rpc("gastar_pontos", {
    _paciente: pacienteId,
    _token: token,
    _pontos: preco,
    _item: itemId,
  });
  if (error) explicar(error);
  return Number(data);
}

export async function equiparItem(slot: string, itemId: string | null): Promise<unknown> {
  const { pacienteId, token } = exigirCredenciais();
  const { data, error } = await supabase.rpc("equipar_item", {
    _paciente: pacienteId,
    _token: token,
    _slot: slot,
    _item: itemId,
  });
  if (error) explicar(error);
  return data;
}

/** Devolve true quando a curtida é mútua. */
export async function curtir(para: string): Promise<boolean> {
  const { pacienteId, token } = exigirCredenciais();
  const { data, error } = await supabase.rpc("curtir", {
    _de: pacienteId,
    _token: token,
    _para: para,
  });
  if (error) explicar(error);
  return Boolean(data);
}

export async function mandarPrenda(para: string): Promise<{ id: string; segundos: number }> {
  const { pacienteId, token } = exigirCredenciais();
  const { data, error } = await supabase.rpc("mandar_prenda", {
    _de: pacienteId,
    _token: token,
    _para: para,
  });
  if (error) explicar(error);
  const linha = (data as { id: string; segundos: number }[] | null)?.[0];
  if (!linha) throw new Error("O dado não rolou. Tente de novo.");
  return linha;
}

export async function responderPrenda(prendaId: string, cumpriu: boolean): Promise<number> {
  const { pacienteId, token } = exigirCredenciais();
  const { data, error } = await supabase.rpc("responder_prenda", {
    _prenda: prendaId,
    _paciente: pacienteId,
    _token: token,
    _cumpriu: cumpriu,
  });
  if (error) explicar(error);
  return Number(data);
}

export async function criarDesafio(para: string, pontos: number): Promise<string> {
  const { pacienteId, token } = exigirCredenciais();
  const { data, error } = await supabase.rpc("criar_desafio", {
    _de: pacienteId,
    _token: token,
    _para: para,
    _pontos: pontos,
  });
  if (error) explicar(error);
  return String(data);
}

export async function responderDesafio(desafioId: string, aceita: boolean): Promise<string> {
  const { pacienteId, token } = exigirCredenciais();
  const { data, error } = await supabase.rpc("responder_desafio", {
    _desafio: desafioId,
    _paciente: pacienteId,
    _token: token,
    _aceita: aceita,
  });
  if (error) explicar(error);
  return String(data);
}

export async function jogarDesafio(desafioId: string, escolha: number): Promise<string> {
  const { pacienteId, token } = exigirCredenciais();
  const { data, error } = await supabase.rpc("jogar_desafio", {
    _desafio: desafioId,
    _paciente: pacienteId,
    _token: token,
    _escolha: escolha,
  });
  if (error) explicar(error);
  return String(data);
}

export type Podio = {
  paciente_id: string;
  nome: string;
  ganhos_total: number;
  posicao: number;
  apurado_em: string;
};

/** Congela o pódio no servidor. Antes da hora, devolve lista vazia. */
export async function apurarPremiacao(momento: Date): Promise<Podio[]> {
  const { data, error } = await supabase.rpc("apurar_premiacao", {
    _momento: momento.toISOString(),
  });
  if (error) explicar(error);
  return (data ?? []) as Podio[];
}
