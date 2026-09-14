/**
 * Estado da conexão.
 *
 * `navigator.onLine` mente: no sítio ele diz "online" com um sinal que não
 * entrega um byte. Então a verdade aqui é a última requisição que deu certo,
 * e a API de conexão serve para decidir o que nem vale a pena tentar.
 */

export type Qualidade = "boa" | "fraca" | "sem-sinal";

type InfoConexao = {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (evento: string, ouvinte: () => void) => void;
  removeEventListener?: (evento: string, ouvinte: () => void) => void;
};

function conexao(): InfoConexao | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: InfoConexao }).connection;
}

/** Último instante em que uma requisição ao Supabase voltou. */
let ultimoSucesso = 0;
export function registrarSucesso() {
  ultimoSucesso = Date.now();
}
export function registrarFalha() {
  ultimoSucesso = 0;
}

export function qualidade(): Qualidade {
  if (typeof navigator === "undefined") return "boa";
  if (!navigator.onLine) return "sem-sinal";

  const c = conexao();
  const tipo = c?.effectiveType;
  if (tipo === "slow-2g" || tipo === "2g") return "fraca";
  if (c?.saveData) return "fraca";

  // Se a última resposta foi há mais de dois minutos, trate como fraca até
  // alguma requisição provar o contrário.
  if (ultimoSucesso && Date.now() - ultimoSucesso > 120_000) return "fraca";
  return "boa";
}

export const online = () => qualidade() !== "sem-sinal";

/** Realtime só quando o sinal aguenta: websocket em 2G só drena bateria. */
export const realtimeVale = () => qualidade() === "boa";

/** Espera o sinal voltar. Resolve na hora se já estiver online. */
export function aguardarSinal(): Promise<void> {
  if (online()) return Promise.resolve();
  return new Promise((resolve) => {
    const aoVoltar = () => {
      window.removeEventListener("online", aoVoltar);
      resolve();
    };
    window.addEventListener("online", aoVoltar);
  });
}

/**
 * Corta a requisição em vez de deixar o app pendurado. Sem isso, uma tela
 * pode ficar minutos esperando um socket que nunca responde.
 */
export async function comPrazo<T>(promessa: Promise<T>, ms = 12_000): Promise<T> {
  let id: ReturnType<typeof setTimeout> | undefined;
  try {
    const resultado = await Promise.race([
      promessa,
      new Promise<never>((_, rejeita) => {
        id = setTimeout(() => rejeita(new Error("Sem resposta a tempo.")), ms);
      }),
    ]);
    registrarSucesso();
    return resultado;
  } catch (e) {
    registrarFalha();
    throw e;
  } finally {
    if (id) clearTimeout(id);
  }
}

/** Avisa a interface quando o estado muda, sem ficar consultando. */
export function ouvirRede(aoMudar: (q: Qualidade) => void): () => void {
  const notificar = () => aoMudar(qualidade());
  window.addEventListener("online", notificar);
  window.addEventListener("offline", notificar);
  const c = conexao();
  c?.addEventListener?.("change", notificar);

  return () => {
    window.removeEventListener("online", notificar);
    window.removeEventListener("offline", notificar);
    c?.removeEventListener?.("change", notificar);
  };
}
