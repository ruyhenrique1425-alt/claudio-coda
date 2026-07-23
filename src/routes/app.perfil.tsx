import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSession, usePermissions } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, ShieldCheck, ClipboardList, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/app/perfil")({ component: PerfilPage });

function badgeForRole(r: string) {
  const map: Record<string, string> = {
    admin: "bg-red-100 text-red-800 ring-red-300",
    gestor: "bg-emerald-100 text-emerald-800 ring-emerald-300",
    manutencao: "bg-blue-100 text-blue-800 ring-blue-300",
    operador: "bg-amber-100 text-amber-800 ring-amber-300",
    equipe_bar: "bg-violet-100 text-violet-800 ring-violet-300",
  };
  return map[r] ?? "bg-muted text-foreground ring-border";
}

function PerfilPage() {
  const { user } = useSession();
  const perms = usePermissions(user?.id);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [saving, setSaving] = useState(false);

  const changePassword = async () => {
    if (pwd.length < 6) { toast.error("Senha deve ter ao menos 6 caracteres"); return; }
    if (pwd !== pwd2) { toast.error("As senhas não conferem"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      await logAudit({ acao: "change_password", tabela: "auth.users", registroId: user?.id ?? null });
      toast.success("Senha alterada com sucesso");
      setPwd(""); setPwd2("");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao alterar senha");
    } finally {
      setSaving(false);
    }
  };

  const { data: profile, isLoading: pl } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: activity, isLoading: al } = useQuery({
    queryKey: ["profile-activity", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const uid = user!.id;
      const [inv, ref, temp, org, cargas, transf] = await Promise.all([
        supabase.from("inventories").select("id,performed_at,bar_id,bars(name)").eq("performed_by", uid).order("performed_at", { ascending: false }).limit(20),
        supabase.from("refills").select("id,performed_at,bar_id,bars(name)").eq("performed_by", uid).order("performed_at", { ascending: false }).limit(20),
        supabase.from("bar_temperature_checks").select("id,performed_at,bar_id,horario,temperatura,bars(name)").eq("performed_by", uid).order("performed_at", { ascending: false }).limit(20),
        supabase.from("bar_organization_checks").select("id,performed_at,bar_id,bars(name)").eq("performed_by", uid).order("performed_at", { ascending: false }).limit(20),
        supabase.from("heineken_cargas").select("id,performed_at,heineken_barris,amstel_barris").eq("performed_by", uid).order("performed_at", { ascending: false }).limit(20),
        supabase.from("bar_transfers").select("id,performed_at,origem_bar_id,destino_bar_id").eq("performed_by", uid).order("performed_at", { ascending: false }).limit(20),
      ]);
      const events: { at: string; label: string; detail: string }[] = [];
      (inv.data ?? []).forEach((r: any) => events.push({ at: r.performed_at, label: "Inventário", detail: r.bars?.name ?? r.bar_id }));
      (ref.data ?? []).forEach((r: any) => events.push({ at: r.performed_at, label: "Reposição", detail: r.bars?.name ?? r.bar_id }));
      (temp.data ?? []).forEach((r: any) => events.push({ at: r.performed_at, label: `Temperatura ${r.horario}`, detail: `${r.bars?.name ?? r.bar_id} · ${r.temperatura}°C` }));
      (org.data ?? []).forEach((r: any) => events.push({ at: r.performed_at, label: "Organização", detail: r.bars?.name ?? r.bar_id }));
      (cargas.data ?? []).forEach((r: any) => events.push({ at: r.performed_at, label: "Carga Heineken", detail: `H:${r.heineken_barris} A:${r.amstel_barris}` }));
      (transf.data ?? []).forEach((r: any) => events.push({ at: r.performed_at, label: "Transferência", detail: `${r.origem_bar_id?.slice(0,6)} → ${r.destino_bar_id?.slice(0,6)}` }));
      return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
    },
  });

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="font-display text-2xl tracking-wider">MEU PERFIL</h1>
        <p className="text-xs text-muted-foreground">Dados operacionais e histórico das últimas atividades.</p>
      </div>

      <Card className="p-4">
        {pl ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-brand text-white flex items-center justify-center">
              <User className="h-8 w-8" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg truncate">{profile?.display_name ?? profile?.username ?? user?.email}</div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {(perms.roles ?? []).map((r) => (
                  <span key={r} className={`text-[10px] font-display tracking-widest px-2 py-0.5 rounded-full ring-1 ${badgeForRole(r)}`}>
                    {r.toUpperCase()}
                  </span>
                ))}
                {perms.roles.length === 0 && (
                  <span className="text-[10px] text-muted-foreground">Sem papel atribuído</span>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm tracking-widest">ALTERAR SENHA</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="pwd">Nova senha</Label>
            <Input id="pwd" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pwd2">Confirmar nova senha</Label>
            <Input id="pwd2" type="password" autoComplete="new-password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
          </div>
        </div>
        <div>
          <Button onClick={changePassword} disabled={saving || !pwd || !pwd2}>
            {saving ? "Salvando…" : "Salvar nova senha"}
          </Button>
        </div>
      </Card>



      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm tracking-widest">HISTÓRICO DE ATIVIDADES</h2>
        </div>
        {al ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : (activity ?? []).length === 0 ? (
          <div className="text-xs text-muted-foreground">Nenhuma atividade registrada.</div>
        ) : (
          <ul className="text-sm divide-y">
            {(activity ?? []).map((e, i) => (
              <li key={i} className="py-2 flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{e.label}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{e.detail}</div>
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {new Date(e.at).toLocaleString("pt-BR")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
