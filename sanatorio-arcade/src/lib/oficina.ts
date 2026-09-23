import { supabase } from "@/integrations/supabase/client";
import { definirCustomizacoes, type CustomizacaoPersonagem } from "@/components/avatar/personagens";
import { comPrazo } from "@/lib/rede";

/**
 * Busca as customizações da oficina e aplica no catálogo de personagens.
 * Chamada uma vez, cedo (ver `__root.tsx`), para todo avatar renderizado
 * depois já sair com nome/cores/cabeça/corpo/acessório/item customizados.
 * Tem prazo: sem sinal, a tela segue com o catálogo padrão em vez de travar
 * esperando uma resposta que não chega.
 */
export async function carregarCustomizacoes(): Promise<void> {
  try {
    const { data } = await comPrazo(
      Promise.resolve(supabase.from("personagens_customizados").select("*")),
    );
    definirCustomizacoes((data ?? []) as CustomizacaoPersonagem[]);
  } catch {
    /* sem sinal ou sem resposta a tempo: segue com o catálogo padrão */
  }
}

export type CampoCustomizacao = {
  nome: string;
  tagline: string;
  head: string;
  body: string;
  cabelo: string;
  roupa: string;
  acessorio: string;
  item: string;
};

/** Salva a customização de um personagem. Lança se a senha estiver errada. */
export async function salvarCustomizacao(
  senha: string,
  personagemId: string,
  campos: CampoCustomizacao,
): Promise<void> {
  const { error } = await supabase.rpc("salvar_personagem_customizado", {
    _senha: senha,
    _personagem_id: personagemId,
    _nome: campos.nome,
    _tagline: campos.tagline,
    _head: campos.head,
    _body: campos.body,
    _cabelo: campos.cabelo,
    _roupa: campos.roupa,
    _acessorio: campos.acessorio,
    _item: campos.item,
  });
  if (error) throw new Error(error.message);
  await carregarCustomizacoes();
}

/** Apaga a customização, devolvendo o personagem ao catálogo original. */
export async function restaurarCustomizacao(senha: string, personagemId: string): Promise<void> {
  const { error } = await supabase.rpc("restaurar_personagem_customizado", {
    _senha: senha,
    _personagem_id: personagemId,
  });
  if (error) throw new Error(error.message);
  await carregarCustomizacoes();
}
