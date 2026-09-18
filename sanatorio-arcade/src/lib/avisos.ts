import { supabase } from "@/integrations/supabase/client";

/**
 * Avisos que chegam durante a festa. Tudo por realtime do Supabase: o app não
 * manda push, então o sino dentro da tela é o canal.
 */

export type TipoAviso =
  | "curtida"
  | "match"
  | "prenda"
  | "desafio"
  | "resultado"
  | "doacao"
  | "podio"
  | "ultrapassado"
  | "marco";

export type Aviso = {
  id: string;
  tipo: TipoAviso;
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
    // Fim de desafio: quem desafiou também precisa saber no que deu.
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "desafios" }, (payload) => {
      const linha = payload.new as {
        id: string;
        de_paciente: string;
        para_paciente: string;
        pontos: number;
        status: string;
        vencedor: string | null;
        created_at: string;
      };
      const souDe = linha.de_paciente === pacienteId;
      const souPara = linha.para_paciente === pacienteId;
      if (!souDe && !souPara) return;

      const outro = souDe ? linha.para_paciente : linha.de_paciente;

      void nomeDe(outro).then((nome) => {
        let texto: string | null = null;

        if (linha.status === "resolvido" && linha.vencedor) {
          texto =
            linha.vencedor === pacienteId
              ? `VOCÊ GANHOU ${linha.pontos} FICHAS DE ${nome}`
              : `${nome} LEVOU SUAS ${linha.pontos} FICHAS`;
        } else if (souDe && linha.status === "aceito") {
          texto = `${nome} ACEITOU O DESAFIO. ESCOLHA SEU NÚMERO`;
        } else if (souDe && linha.status === "recusado") {
          texto = `${nome} FUGIU DO DESAFIO`;
        }

        if (!texto) return;
        aoChegar({
          id: `desafio-${linha.id}-${linha.status}`,
          tipo: "resultado",
          texto,
          em: new Date().toISOString(),
          referencia: linha.id,
        });
      });
    })
    // Resposta da prenda que eu mandei.
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "prendas",
        filter: `de_paciente=eq.${pacienteId}`,
      },
      (payload) => {
        const linha = payload.new as {
          id: string;
          para_paciente: string;
          status: string;
          segundos: number;
        };
        if (linha.status !== "cumprida" && linha.status !== "passou") return;

        void nomeDe(linha.para_paciente).then((nome) => {
          aoChegar({
            id: `prenda-${linha.id}-${linha.status}`,
            tipo: "resultado",
            texto:
              linha.status === "cumprida"
                ? `${nome} CUMPRIU SUA PRENDA DE ${linha.segundos}s`
                : `${nome} PASSOU A VEZ. +5 FICHAS PARA VOCÊ`,
            em: new Date().toISOString(),
            referencia: linha.id,
          });
        });
      },
    )
    // Fichas que caíram na conta por doação.
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "transacoes",
        filter: `para_paciente=eq.${pacienteId}`,
      },
      (payload) => {
        const linha = payload.new as {
          id: string;
          de_paciente: string | null;
          pontos: number;
          motivo: string;
          created_at: string;
        };
        if (linha.motivo !== "doacao") return;

        void nomeDe(linha.de_paciente).then((nome) => {
          aoChegar({
            id: `doacao-${linha.id}`,
            tipo: "doacao",
            texto: `${nome} TE DOOU ${linha.pontos} FICHAS`,
            em: linha.created_at,
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
