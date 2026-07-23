import { supabase } from "@/integrations/supabase/client";

export async function logAudit(params: {
  acao: string;
  tabela: string;
  registroId?: string | null;
  detalhe?: Record<string, unknown> | null;
}) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    await supabase.from("logs_auditoria" as any).insert({
      user_id: uid,
      acao: params.acao,
      tabela_afetada: params.tabela,
      registro_id: params.registroId ?? null,
      detalhe_json: params.detalhe ?? null,
    } as any);
  } catch {
    // silencioso — auditoria nunca deve derrubar o fluxo
  }
}
