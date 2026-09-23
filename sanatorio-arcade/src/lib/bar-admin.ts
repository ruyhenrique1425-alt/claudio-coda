import { supabase } from "@/integrations/supabase/client";
import { definirConquistasBar, type Conquista } from "@/lib/conquistas";
import { comPrazo } from "@/lib/rede";

/**
 * Busca os códigos do bar cadastrados pela administração e aplica no
 * catálogo de conquistas. Chamada uma vez, cedo (ver `__root.tsx`), do mesmo
 * jeito que `carregarCustomizacoes` faz para os personagens.
 */
export async function carregarConquistasBar(): Promise<void> {
  try {
    const { data } = await comPrazo(
      Promise.resolve(supabase.from("conquistas_bar").select("*").order("criado_em")),
    );
    const linhas: Conquista[] = (data ?? []).map((row) => ({
      codigo: row.codigo,
      titulo: row.titulo,
      ondeFica: row.onde_fica,
      legenda: row.legenda,
      fichas: row.fichas,
    }));
    definirConquistasBar(linhas);
  } catch {
    /* sem sinal ou sem resposta a tempo: segue só com as cinco originais */
  }
}

export type CampoConquistaBar = {
  codigo: string;
  titulo: string;
  ondeFica: string;
  legenda: string;
  fichas: number;
};

/** Cadastra ou atualiza um código do bar. Lança se a senha estiver errada. */
export async function salvarConquistaBar(senha: string, campos: CampoConquistaBar): Promise<void> {
  const { error } = await supabase.rpc("salvar_conquista_bar", {
    _senha: senha,
    _codigo: campos.codigo,
    _titulo: campos.titulo,
    _onde_fica: campos.ondeFica,
    _legenda: campos.legenda,
    _fichas: campos.fichas,
  });
  if (error) throw new Error(error.message);
  await carregarConquistasBar();
}

/** Remove um código cadastrado pela administração (as cinco originais não passam por aqui). */
export async function apagarConquistaBar(senha: string, codigo: string): Promise<void> {
  const { error } = await supabase.rpc("apagar_conquista_bar", { _senha: senha, _codigo: codigo });
  if (error) throw new Error(error.message);
  await carregarConquistasBar();
}
