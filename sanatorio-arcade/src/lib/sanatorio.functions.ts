import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { jaRevelou } from "@/lib/datas";

export const MORADORES = ["Camarão", "Recruta", "Canela"] as const;
export type Morador = (typeof MORADORES)[number];

function client() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const atributo = z.number().int().min(0).max(10);

const fichaSchema = z
  .object({
    nome: z.string().trim().min(2).max(24),
    fator_coringa: atributo,
    imunidade_etilica: atributo,
    inimigo_do_fim: atributo,
    aptidao_audio: atributo,
    amnesia_anterograda: atributo,
    personagem: z.string().trim().min(1).max(30).optional(),
    avatar: z.record(z.string(), z.string()).optional(),
  })
  .refine(
    (f) =>
      f.fator_coringa +
        f.imunidade_etilica +
        f.inimigo_do_fim +
        f.aptidao_audio +
        f.amnesia_anterograda <=
      15,
    { message: "Total de pontos acima de 15" },
  );

export const internarPaciente = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => fichaSchema.parse(input))
  .handler(async ({ data }) => {
    // A internação é a única porta de entrada: a função devolve o token que
    // o paciente vai usar para mexer nos próprios pontos daqui para frente.
    const { data: linhas, error } = await client().rpc("internar_paciente", {
      _nome: data.nome,
      _fator_coringa: data.fator_coringa,
      _imunidade_etilica: data.imunidade_etilica,
      _inimigo_do_fim: data.inimigo_do_fim,
      _aptidao_audio: data.aptidao_audio,
      _amnesia_anterograda: data.amnesia_anterograda,
      _personagem: data.personagem ?? "interno",
      _avatar: data.avatar ?? {},
    });

    const linha = linhas?.[0];
    if (error || !linha) throw new Error("Não foi possível registrar a ficha.");
    return { id: linha.id, token: linha.token, nome: data.nome };
  });

/** Mapa nome -> avatar dos pacientes, para enfeitar os feeds. */
async function avataresPorNome(sb: ReturnType<typeof client>) {
  const { data } = await sb
    .from("pacientes_publicos")
    .select("nome, personagem, avatar, itens")
    .limit(500);
  const mapa = new Map<string, { personagem: string; avatar: unknown; itens: unknown }>();
  for (const p of data ?? []) {
    if (p.nome && !mapa.has(p.nome)) {
      mapa.set(p.nome, { personagem: p.personagem ?? "interno", avatar: p.avatar, itens: p.itens });
    }
  }
  return mapa;
}

export const listarMural = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ destinatario: z.enum(MORADORES) }).parse(input))
  .handler(async ({ data }) => {
    const sb = client();
    const { data: rows, error } = await sb
      .from("mural")
      .select("id, autor, mensagem, created_at")
      .eq("destinatario", data.destinatario)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new Error("Não foi possível carregar o mural.");
    if (!rows?.length) return [];

    const mapa = await avataresPorNome(sb);
    const revelado = jaRevelou();

    // Antes da revelação o texto não sai daqui. O borrão do front é enfeite;
    // a fechadura é esta linha.
    return rows.map((r) => ({
      id: r.id,
      autor: r.autor,
      created_at: r.created_at,
      mensagem: revelado ? r.mensagem : null,
      tamanho: revelado ? null : r.mensagem.length,
      personagem: mapa.get(r.autor)?.personagem ?? null,
      avatar: mapa.get(r.autor)?.avatar ?? null,
      itens: mapa.get(r.autor)?.itens ?? null,
    }));
  });

export const postarNoMural = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        destinatario: z.enum(MORADORES),
        mensagem: z.string().trim().min(1).max(280),
        autor: z.string().trim().min(1).max(40),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { error } = await client().rpc("postar_recado", {
      _destinatario: data.destinatario,
      _mensagem: data.mensagem,
      _autor: data.autor,
      _chave: null,
    });
    if (error) throw new Error("Não foi possível enviar o recado.");
    return { ok: true };
  });

export const registrarFoto = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        path: z.string().trim().min(3).max(200),
        autor: z.string().trim().min(1).max(40),
        legenda: z.string().trim().max(140).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { error } = await client()
      .from("fotos")
      .insert({
        path: data.path,
        autor: data.autor,
        legenda: data.legenda ?? null,
      });
    if (error) throw new Error("Não foi possível registrar a foto.");
    return { ok: true };
  });

export const listarFotos = createServerFn({ method: "GET" }).handler(async () => {
  const sb = client();
  const { data: rows, error } = await sb
    .from("fotos")
    .select("id, autor, legenda, path, created_at")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) throw new Error("Não foi possível carregar a galeria.");
  if (!rows?.length) return [];

  const mapa = await avataresPorNome(sb);
  const revelado = jaRevelou();

  // Antes de 30/10 às 12h nenhuma URL assinada é gerada. O que sai daqui é
  // só quem registrou e o que registrou.
  const urls = new Map<string, string>();
  if (revelado) {
    const { data: signed } = await sb.storage.from("galeria").createSignedUrls(
      rows.map((r) => r.path),
      60 * 60 * 6,
    );
    for (const assinada of signed ?? []) {
      if (assinada.path && assinada.signedUrl) urls.set(assinada.path, assinada.signedUrl);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    autor: r.autor,
    created_at: r.created_at,
    legenda: revelado ? r.legenda : null,
    url: revelado ? (urls.get(r.path) ?? null) : null,
    atividade: "registrou um momento",
    personagem: mapa.get(r.autor)?.personagem ?? null,
    avatar: mapa.get(r.autor)?.avatar ?? null,
    itens: mapa.get(r.autor)?.itens ?? null,
  }));
});

export const listarPacientes = createServerFn({ method: "GET" }).handler(async () => {
  const { data: rows, error } = await client()
    .from("pacientes_publicos")
    .select(
      "id, nome, fator_coringa, imunidade_etilica, inimigo_do_fim, aptidao_audio, amnesia_anterograda, personagem, avatar, itens, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw new Error("Não foi possível carregar os pacientes.");

  // A view expõe tudo como anulável. Como as colunas são NOT NULL na tabela,
  // normalizamos aqui e o front recebe uma ficha inteira.
  return (rows ?? [])
    .filter((r) => r.id && r.nome)
    .map((r) => ({
      id: r.id as string,
      nome: r.nome as string,
      fator_coringa: r.fator_coringa ?? 0,
      imunidade_etilica: r.imunidade_etilica ?? 0,
      inimigo_do_fim: r.inimigo_do_fim ?? 0,
      aptidao_audio: r.aptidao_audio ?? 0,
      amnesia_anterograda: r.amnesia_anterograda ?? 0,
      personagem: r.personagem ?? "interno",
      avatar: r.avatar,
      itens: r.itens,
      created_at: r.created_at ?? new Date(0).toISOString(),
    }));
});
