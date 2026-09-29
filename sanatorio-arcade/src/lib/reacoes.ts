import { supabase } from "@/integrations/supabase/client";
import { credenciais } from "@/lib/paciente-local";

export type TipoItemReacao = "foto" | "mural";

/** Alterna a reação do paciente num item. Devolve true se ficou reagido, false se removeu. */
export async function reagir(tipo: TipoItemReacao, itemId: string): Promise<boolean> {
  const c = credenciais();
  if (!c) throw new Error("Faça sua ficha de admissão antes de reagir.");
  const { pacienteId, token } = c;
  const { data, error } = await supabase.rpc("reagir", {
    _tipo_item: tipo,
    _item_id: itemId,
    _paciente: pacienteId,
    _token: token,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}
