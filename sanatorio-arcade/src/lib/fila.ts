/**
 * Fila de envio — o que o paciente fez sem sinal.
 *
 * Toda ação que muda dado no servidor entra aqui primeiro e só depois tenta
 * subir. Se o sinal estiver bom, sobe na hora e o paciente nem percebe a fila.
 * Se não estiver, fica guardada no IndexedDB e vai junto na próxima brecha.
 *
 * Cada item carrega uma chave de idempotência gerada no celular, então
 * reenviar o que talvez já tenha chegado não duplica nada.
 */
import { supabase } from "@/integrations/supabase/client";
import { apagar, gravar, listar } from "@/lib/deposito";
import { comPrazo, online } from "@/lib/rede";

export type TipoEnvio = "pontos" | "recado" | "foto" | "curtida";

/** O que cada tipo de envio carrega. */
export type Carga = {
  pontos: {
    paciente: string;
    token: string;
    pontos: number;
    motivo: string;
    referencia: string | null;
  };
  recado: { destinatario: string; mensagem: string; autor: string };
  curtida: { de: string; token: string; para: string };
  foto: { arquivo: Blob; path: string; autor: string; legenda: string | null };
};

export type Envio = {
  [T in TipoEnvio]: {
    id: string;
    tipo: T;
    dados: Carga[T];
    criadoEm: number;
    tentativas: number;
    /** Última mensagem de erro, para a tela poder explicar o que travou. */
    ultimoErro?: string;
  };
}[TipoEnvio];

const MAX_TENTATIVAS = 8;

type Ouvinte = (pendentes: number) => void;
const ouvintes = new Set<Ouvinte>();

export function ouvirFila(f: Ouvinte): () => void {
  ouvintes.add(f);
  void contar().then(f);
  return () => ouvintes.delete(f);
}

async function avisar() {
  const n = await contar();
  ouvintes.forEach((f) => f(n));
}

export async function contar(): Promise<number> {
  return (await listar<Envio>("fila")).length;
}

export async function pendentes(): Promise<Envio[]> {
  const itens = await listar<Envio>("fila");
  return itens.sort((a, b) => a.criadoEm - b.criadoEm);
}

/** Coloca na fila e tenta subir na hora. Devolve true se já subiu. */
export async function enfileirar<T extends TipoEnvio>(tipo: T, dados: Carga[T]): Promise<boolean> {
  const envio = {
    id: crypto.randomUUID(),
    tipo,
    dados,
    criadoEm: Date.now(),
    tentativas: 0,
  } as Envio;

  await gravar("fila", envio);
  await avisar();

  if (!online()) return false;

  const subiu = await tentar(envio);
  await avisar();
  return subiu;
}

/* ------------------------------ envio de fato ----------------------------- */

async function enviar(envio: Envio): Promise<void> {
  // Os construtores do Supabase são "thenables", não Promises: o Promise.resolve
  // normaliza para o comPrazo conseguir competir com o relógio.
  if (envio.tipo === "pontos") {
    const d = envio.dados;
    const { error } = await comPrazo(
      Promise.resolve(
        supabase.rpc("creditar_pontos", {
          _paciente: d.paciente,
          _token: d.token,
          _pontos: d.pontos,
          _motivo: d.motivo,
          _referencia: d.referencia,
          _chave: envio.id,
        }),
      ),
    );
    if (error) throw new Error(error.message);
    return;
  }

  if (envio.tipo === "recado") {
    const d = envio.dados;
    const { error } = await comPrazo(
      Promise.resolve(
        supabase.rpc("postar_recado", {
          _destinatario: d.destinatario,
          _mensagem: d.mensagem,
          _autor: d.autor,
          _chave: envio.id,
        }),
      ),
    );
    if (error) throw new Error(error.message);
    return;
  }

  if (envio.tipo === "curtida") {
    const d = envio.dados;
    const { error } = await comPrazo(
      Promise.resolve(supabase.rpc("curtir", { _de: d.de, _token: d.token, _para: d.para })),
    );
    if (error) throw new Error(error.message);
    return;
  }

  if (envio.tipo === "foto") {
    const d = envio.dados;
    // Sobe primeiro para o storage e só depois registra a linha. Se a linha
    // falhar, a próxima tentativa reusa o mesmo path com upsert e não duplica
    // o arquivo.
    const up = await comPrazo(
      Promise.resolve(
        supabase.storage.from("galeria").upload(d.path, d.arquivo, {
          contentType: "image/jpeg",
          upsert: true,
        }),
      ),
      45_000,
    );
    if (up.error) throw new Error(up.error.message);

    const { error } = await comPrazo(
      Promise.resolve(
        supabase.rpc("registrar_foto", {
          _path: d.path,
          _autor: d.autor,
          _legenda: d.legenda,
          _chave: envio.id,
        }),
      ),
    );
    if (error) throw new Error(error.message);
    return;
  }

  throw new Error("Tipo de envio desconhecido.");
}

async function tentar(envio: Envio): Promise<boolean> {
  try {
    await enviar(envio);
    await apagar("fila", envio.id);
    return true;
  } catch (e) {
    const atualizado = {
      ...envio,
      tentativas: envio.tentativas + 1,
      ultimoErro: e instanceof Error ? e.message : "Falha desconhecida",
    } as Envio;

    // Erro de validação não melhora com repetição: some com o item em vez de
    // deixar a fila entupida para sempre.
    const permanente =
      atualizado.tentativas >= MAX_TENTATIVAS ||
      /Prontuário não confere|Motivo inválido|fora da faixa|Destinatário desconhecido/.test(
        atualizado.ultimoErro ?? "",
      );

    if (permanente) await apagar("fila", envio.id);
    else await gravar("fila", atualizado);

    return false;
  }
}

/* -------------------------------- descarga -------------------------------- */

let descarregando = false;

/**
 * Sobe tudo que dá, um de cada vez. Em série de propósito: no sítio, seis
 * requisições simultâneas competem pelo mesmo fio e todas falham juntas.
 */
export async function descarregar(): Promise<{ subiram: number; ficaram: number }> {
  if (descarregando || !online()) return { subiram: 0, ficaram: await contar() };
  descarregando = true;

  let subiram = 0;
  try {
    for (const envio of await pendentes()) {
      if (!online()) break;
      const ok = await tentar(envio);
      if (ok) subiram += 1;
      else break; // falhou uma, o sinal caiu: para e tenta de novo depois
    }
  } finally {
    descarregando = false;
    await avisar();
  }

  return { subiram, ficaram: await contar() };
}

/** Liga a descarga automática: ao voltar o sinal, ao abrir o app e a cada 45s. */
export function manterFilaViva(): () => void {
  const tentarAgora = () => void descarregar();

  window.addEventListener("online", tentarAgora);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tentarAgora();
  });

  const id = setInterval(tentarAgora, 45_000);
  tentarAgora();

  return () => {
    window.removeEventListener("online", tentarAgora);
    clearInterval(id);
  };
}
