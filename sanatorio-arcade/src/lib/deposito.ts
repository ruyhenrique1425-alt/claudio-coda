/**
 * Depósito local em IndexedDB.
 *
 * O localStorage não serve aqui: ele é síncrono, trava a thread da interface e
 * tem teto de uns 5 MB, que uma foto da festa estoura sozinha. IndexedDB é
 * assíncrono e aguenta as fotos esperando sinal.
 *
 * Sem biblioteca: são três operações (ler, gravar, apagar) sobre dois
 * armazéns. Uma dependência a mais é mais um download no sítio.
 */

const BANCO = "sanatorio";
const VERSAO = 1;

/** Fila de envios pendentes e cache de leitura. */
export type Armazem = "fila" | "cache";

let conexao: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Este navegador não tem IndexedDB."));
  }
  if (conexao) return conexao;

  conexao = new Promise((resolve, reject) => {
    const req = indexedDB.open(BANCO, VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("fila")) {
        db.createObjectStore("fila", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("cache")) {
        db.createObjectStore("cache");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return conexao;
}

function transacao<T>(
  armazem: Armazem,
  modo: IDBTransactionMode,
  acao: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return abrir().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(armazem, modo);
        const req = acao(tx.objectStore(armazem));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function ler<T>(armazem: Armazem, chave: IDBValidKey): Promise<T | null> {
  try {
    const valor = await transacao<T>(armazem, "readonly", (s) => s.get(chave));
    return valor ?? null;
  } catch {
    return null;
  }
}

export async function gravar(armazem: Armazem, valor: unknown, chave?: IDBValidKey) {
  try {
    await transacao(armazem, "readwrite", (s) =>
      chave === undefined
        ? (s.put(valor) as IDBRequest<IDBValidKey>)
        : (s.put(valor, chave) as IDBRequest<IDBValidKey>),
    );
  } catch {
    /* armazenamento cheio ou bloqueado: o app segue sem cache */
  }
}

export async function apagar(armazem: Armazem, chave: IDBValidKey) {
  try {
    await transacao(armazem, "readwrite", (s) => s.delete(chave));
  } catch {
    /* nada a apagar */
  }
}

export async function listar<T>(armazem: Armazem): Promise<T[]> {
  try {
    return await transacao<T[]>(armazem, "readonly", (s) => s.getAll());
  } catch {
    return [];
  }
}
