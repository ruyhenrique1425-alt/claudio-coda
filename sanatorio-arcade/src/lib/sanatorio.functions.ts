import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

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
    const { data: row, error } = await client()
      .from("pacientes")
      .insert({
        ...data,
        personagem: data.personagem ?? "interno",
        avatar: data.avatar ?? {},
      })
      .select("id, nome")
      .single();

    if (error) throw new Error("Não foi possível registrar a ficha.");
    return { id: row.id, nome: row.nome };
  });

/** Mapa nome -> avatar dos pacientes, para enfeitar os feeds. */
async function avataresPorNome(sb: ReturnType<typeof client>) {
  const { data } = await sb.from("pacientes").select("nome, personagem, avatar").limit(500);
  const mapa = new Map<string, { personagem: string; avatar: unknown }>();
  for (const p of data ?? []) {
    if (!mapa.has(p.nome)) mapa.set(p.nome, { personagem: p.personagem, avatar: p.avatar });
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
    return rows.map((r) => ({
      ...r,
      personagem: mapa.get(r.autor)?.personagem ?? null,
      avatar: mapa.get(r.autor)?.avatar ?? null,
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
    const { error } = await client().from("mural").insert(data);
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

  const { data: signed } = await sb.storage.from("galeria").createSignedUrls(
    rows.map((r) => r.path),
    60 * 60 * 6,
  );

  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const mapa = await avataresPorNome(sb);

  return rows.map((r) => ({
    id: r.id,
    autor: r.autor,
    legenda: r.legenda,
    created_at: r.created_at,
    url: urls.get(r.path) ?? null,
    personagem: mapa.get(r.autor)?.personagem ?? null,
    avatar: mapa.get(r.autor)?.avatar ?? null,
  }));
});

export const listarPacientes = createServerFn({ method: "GET" }).handler(async () => {
  const { data: rows, error } = await client()
    .from("pacientes")
    .select(
      "id, nome, fator_coringa, imunidade_etilica, inimigo_do_fim, aptidao_audio, amnesia_anterograda, personagem, avatar, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw new Error("Não foi possível carregar os pacientes.");
  return rows ?? [];
});
