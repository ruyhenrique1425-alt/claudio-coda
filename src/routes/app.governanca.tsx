import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useSession";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ShieldCheck, Users, Search, Check, X, ClipboardList, Trash2 } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { useServerFn } from "@tanstack/react-start";
import { deleteUser as deleteUserFn } from "@/lib/admin.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app/governanca")({ component: GovernancaPage });

const ALL_ROLES = ["admin", "gestor", "manutencao", "operador", "equipe_bar"] as const;
type Role = (typeof ALL_ROLES)[number];

function GovernancaPage() {
  const nav = useNavigate();
  const { user, loading: sl } = useSession();
  const perms = usePermissions(user?.id);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"users" | "audit">("users");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!sl && !perms.loading && !perms.isAdmin) {
      toast.error("Acesso restrito a administradores");
      nav({ to: "/app" });
    }
  }, [sl, perms.loading, perms.isAdmin, nav]);

  const deleteUserCall = useServerFn(deleteUserFn);

  const { data: users, isLoading: ul } = useQuery({
    queryKey: ["gov-users"],
    enabled: perms.isAdmin,
    queryFn: async () => {
      const { data: profs } = await supabase.from("profiles").select("id,username,display_name");
      const { data: rolesRows } = await supabase.from("user_roles").select("user_id,role");
      const rolesByUser: Record<string, Role[]> = {};
      (rolesRows ?? []).forEach((r: any) => {
        (rolesByUser[r.user_id] ??= []).push(r.role);
      });
      return (profs ?? []).map((p: any) => ({
        id: p.id,
        display: p.display_name || p.username || p.id.slice(0, 8),
        username: p.username,
        roles: rolesByUser[p.id] ?? [],
      }));
    },
  });

  const { data: audit, isLoading: aloading } = useQuery({
    queryKey: ["gov-audit"],
    enabled: perms.isAdmin && tab === "audit",
    queryFn: async () => {
      const { data } = await supabase
        .from("logs_auditoria" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as any[];
    },
  });

  const toggleRole = async (userId: string, role: Role, has: boolean) => {
    try {
      if (has) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
        if (error) throw error;
        await logAudit({ acao: "remove_role", tabela: "user_roles", registroId: userId, detalhe: { role } });
        toast.success(`Papel ${role} removido`);
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role } as any);
        if (error) throw error;
        await logAudit({ acao: "grant_role", tabela: "user_roles", registroId: userId, detalhe: { role } });
        toast.success(`Papel ${role} concedido`);
      }
      await qc.invalidateQueries({ queryKey: ["gov-users"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao alterar papel");
    }
  };

  const handleDelete = async (userId: string, label: string) => {
    try {
      await deleteUserCall({ data: { userId } });
      await logAudit({ acao: "delete_user", tabela: "auth.users", registroId: userId, detalhe: { label } });
      toast.success(`Usuário ${label} excluído`);
      await qc.invalidateQueries({ queryKey: ["gov-users"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir usuário");
    }
  };

  const filtered = (users ?? []).filter((u) =>
    !q.trim() ? true : (u.display + " " + (u.username ?? "")).toLowerCase().includes(q.toLowerCase())
  );

  if (!perms.isAdmin) {
    return (
      <div className="p-4">
        <Card className="p-6 text-sm text-muted-foreground">Verificando permissões…</Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="font-display text-2xl tracking-wider flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> GOVERNANÇA
        </h1>
        <p className="text-xs text-muted-foreground">Gestão de usuários, papéis e trilha de auditoria.</p>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === "users" ? "default" : "outline"} size="sm" onClick={() => setTab("users")}>
          <Users className="w-4 h-4 mr-1" /> Usuários
        </Button>
        <Button variant={tab === "audit" ? "default" : "outline"} size="sm" onClick={() => setTab("audit")}>
          <ClipboardList className="w-4 h-4 mr-1" /> Auditoria
        </Button>
      </div>

      {tab === "users" && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar usuário…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          </div>
          {ul ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">Nenhum usuário encontrado.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((u) => (
                <div key={u.id} className="border rounded p-3 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="min-w-0 md:w-56">
                    <div className="font-medium truncate">{u.display}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{u.username ?? u.id.slice(0, 8)}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {ALL_ROLES.map((r) => {
                      const has = u.roles.includes(r);
                      return (
                        <button
                          key={r}
                          onClick={() => toggleRole(u.id, r, has)}
                          className={`min-h-[36px] px-3 rounded-full text-[10px] font-display tracking-widest ring-1 transition ${
                            has
                              ? "bg-primary text-primary-foreground ring-primary"
                              : "bg-background text-muted-foreground ring-border hover:bg-muted"
                          }`}
                        >
                          {has ? <Check className="inline w-3 h-3 mr-1" /> : <X className="inline w-3 h-3 mr-1 opacity-40" />}
                          {r.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                  {u.id !== user?.id && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir {u.display}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação é permanente. O usuário e seu acesso serão removidos. Registros históricos (inventários, reposições etc.) permanecem no banco.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDelete(u.id, u.display)}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "audit" && (
        <Card className="p-4 space-y-2">
          {aloading ? (
            <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (audit ?? []).length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">Sem registros de auditoria.</div>
          ) : (
            <div className="max-h-[70vh] overflow-auto text-xs">
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1">Quando</th>
                    <th className="text-left px-2 py-1">Ação</th>
                    <th className="text-left px-2 py-1">Tabela</th>
                    <th className="text-left px-2 py-1">Registro</th>
                    <th className="text-left px-2 py-1">Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {(audit ?? []).map((r) => (
                    <tr key={r.id} className="border-t align-top">
                      <td className="px-2 py-1 tabular-nums whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                      <td className="px-2 py-1 font-medium">{r.acao}</td>
                      <td className="px-2 py-1">{r.tabela_afetada}</td>
                      <td className="px-2 py-1 text-muted-foreground">{r.registro_id?.slice(0, 8) ?? "—"}</td>
                      <td className="px-2 py-1 max-w-md truncate text-muted-foreground">
                        {r.detalhe_json ? JSON.stringify(r.detalhe_json) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
