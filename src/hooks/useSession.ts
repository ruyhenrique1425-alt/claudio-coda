import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}

export function useRoles(userId: string | undefined) {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!userId) {
      setRoles([]);
      setLoading(true);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data }) => {
        setRoles((data ?? []).map((r: any) => r.role as string));
        setLoading(false);
      });
  }, [userId]);

  return { roles, loading };
}

export function useIsGestor(userId: string | undefined) {
  const { roles, loading } = useRoles(userId);
  return { isGestor: roles.includes("gestor"), loading };
}

export function usePermissions(userId: string | undefined) {
  const { roles, loading } = useRoles(userId);
  const isAdmin = roles.includes("admin");
  const isGestor = roles.includes("gestor") || isAdmin;
  const isManutencao = roles.includes("manutencao");
  const isEquipeBar = roles.includes("equipe_bar");
  return {
    loading,
    roles,
    isAdmin,
    isGestor,
    isManutencao,
    isEquipeBar,
    canManageAll: isGestor,
    canAccessDashboard: isGestor || isManutencao,
    canAccessMap: isGestor || isManutencao,
    canAccessBars: isGestor || isManutencao,
    canAccessConsumo: isGestor || isManutencao,
    canAccessManutencao: isGestor || isManutencao,
    canAccessEquipeBar: isGestor || isEquipeBar,
    onlyEquipeBar: !isGestor && !isManutencao && isEquipeBar,
  };
}
