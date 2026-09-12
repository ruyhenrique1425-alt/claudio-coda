import { supabase } from "@/integrations/supabase/client";

/**
 * Avisos que chegam durante a festa. Tudo por realtime do Supabase: o app não
 * manda push, então o sino dentro da tela é o canal.
 */

export type Aviso = {
  id: string;
  tipo: "curtida" | "match" | "prenda" | "desafio";
  texto: string;
  em: string;
  /** Id da prenda ou do desafio, para a tela conseguir responder. */
  referencia?: string;
  lido?: boolean;
};

type Alvo = { pacienteId: string };

/**
 * Assina os três canais de uma vez e devolve a função de desinscrição.
 * O nome de quem agiu vem depois, numa consulta à view pública.
 */
export function ouvirAvisos({ pacienteId }: Alvo, aoChegar: (aviso: Aviso) => void) {
  async function nomeDe(id: string | null | undefined): Promise<string> {
    if (!id) return "ALGUÉM";
    const { data } = await supabase
      .from("pacientes_publicos")
      .select("nome")
      .eq("id", id)
      .maybeSingle();
    return (data?.nome ?? "ALGUÉM").toUpperCase();
  }

  const canal = supabase
    .channel(`avisos-${pacienteId}-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "curtidas",
        filter: `para_paciente=eq.${pacienteId}`,
      },
      (payload) => {
        const linha = payload.new as { id: string; de_paciente: string; created_at: string };
        void nomeDe(linha.de_paciente).then(async (nome) => {
          const { data } = await supabase
            .from("curtidas")
            .select("id")
            .eq("de_paciente", pacienteId)
            .eq("para_paciente", linha.de_paciente)
            .maybeSingle();

          aoChegar({
            id: linha.id,
            tipo: data ? "match" : "curtida",
            texto: data
              ? `DIAGNÓSTICO COMPATÍVEL COM ${nome}`
              : `PACIENTE ${nome} QUER FUGIR COM VOCÊ`,
            em: linha.created_at,
            referencia: linha.de_paciente,
          });
        });
      },
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "prendas",
        filter: `para_paciente=eq.${pacienteId}`,
      },
      (payload) => {
        const linha = payload.new as {
          id: string;
          de_paciente: string;
          segundos: number;
          created_at: string;
        };
        void nomeDe(linha.de_paciente).then((nome) => {
          aoChegar({
            id: linha.id,
            tipo: "prenda",
            texto: `PRENDA DE ${nome}: BEBA POR ${linha.segundos} SEGUNDO${
              linha.segundos > 1 ? "S" : ""
            }`,
            em: linha.created_at,
            referencia: linha.id,
          });
        });
      },
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "desafios",
        filter: `para_paciente=eq.${pacienteId}`,
      },
      (payload) => {
        const linha = payload.new as {
          id: string;
          de_paciente: string;
          pontos: number;
          created_at: string;
        };
        void nomeDe(linha.de_paciente).then((nome) => {
          aoChegar({
            id: linha.id,
            tipo: "desafio",
            texto: `${nome} DESAFIOU VOCÊ POR ${linha.pontos} FICHAS`,
            em: linha.created_at,
            referencia: linha.id,
          });
        });
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(canal);
  };
}

/** Prendas e desafios que ficaram esperando enquanto o app estava fechado. */
export async function pendencias(pacienteId: string): Promise<Aviso[]> {
  const [prendas, desafios] = await Promise.all([
    supabase
      .from("prendas")
      .select("id, de_paciente, segundos, created_at")
      .eq("para_paciente", pacienteId)
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("desafios")
      .select("id, de_paciente, pontos, created_at")
      .eq("para_paciente", pacienteId)
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const avisos: Aviso[] = [];

  for (const p of prendas.data ?? []) {
    avisos.push({
      id: p.id,
      tipo: "prenda",
      texto: `PRENDA PENDENTE: BEBA POR ${p.segundos} SEGUNDO${p.segundos > 1 ? "S" : ""}`,
      em: p.created_at,
      referencia: p.id,
    });
  }

  for (const d of desafios.data ?? []) {
    // Desafio só vale por 60 segundos; o que passou disso já era.
    if (Date.now() - new Date(d.created_at).getTime() > 60_000) continue;
    avisos.push({
      id: d.id,
      tipo: "desafio",
      texto: `DESAFIO ABERTO POR ${d.pontos} FICHAS`,
      em: d.created_at,
      referencia: d.id,
    });
  }

  return avisos.sort((a, b) => b.em.localeCompare(a.em));
}
