/**
 * Cache de leitura que sobrevive a fechar o app.
 *
 * O TanStack Query guarda tudo em memória: fechou o app, perdeu. No sítio isso
 * significa abrir o app e ver tela vazia. Aqui a resposta de cada consulta é
 * copiada para o IndexedDB e devolvida na abertura seguinte, mesmo sem sinal.
 *
 * O dado velho aparece marcado como velho — a tela mostra de quando é.
 */
import type { QueryClient } from "@tanstack/react-query";

import { gravar, ler } from "@/lib/deposito";

type Foto = { dados: unknown; em: number };

const CHAVE = "consultas";
const VALIDADE = 1000 * 60 * 60 * 24 * 7; // uma semana: a festa e o dia seguinte

type Mapa = Record<string, Foto>;

/** Quando aquela consulta foi buscada pela última vez. */
export function idadeDe(mapa: Mapa | null, chave: string): number | null {
  const foto = mapa?.[chave];
  return foto ? Date.now() - foto.em : null;
}

export async function restaurar(cliente: QueryClient): Promise<Mapa> {
  const mapa = (await ler<Mapa>("cache", CHAVE)) ?? {};
  const agora = Date.now();

  for (const [chave, foto] of Object.entries(mapa)) {
    if (agora - foto.em > VALIDADE) continue;
    try {
      cliente.setQueryData(JSON.parse(chave) as unknown[], foto.dados);
    } catch {
      /* chave gravada por uma versão anterior: ignora */
    }
  }

  return mapa;
}

/** Copia cada resposta bem-sucedida para o depósito, sem travar a tela. */
export function persistir(cliente: QueryClient): () => void {
  let pendente: ReturnType<typeof setTimeout> | null = null;

  const salvar = () => {
    if (pendente) clearTimeout(pendente);
    // Agrupa as gravações: várias consultas voltando juntas viram um write só.
    pendente = setTimeout(() => {
      const mapa: Mapa = {};
      for (const consulta of cliente.getQueryCache().getAll()) {
        if (consulta.state.status !== "success") continue;
        if (consulta.state.data === undefined) continue;
        mapa[JSON.stringify(consulta.queryKey)] = {
          dados: consulta.state.data,
          em: consulta.state.dataUpdatedAt,
        };
      }
      void gravar("cache", mapa, CHAVE);
    }, 1500);
  };

  const parar = cliente.getQueryCache().subscribe((evento) => {
    if (evento.type === "updated" && evento.query.state.status === "success") salvar();
  });

  return () => {
    if (pendente) clearTimeout(pendente);
    parar();
  };
}
