import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { useSession, usePermissions } from "@/hooks/useSession";
import { useMaintenanceAlerts } from "@/hooks/useMaintenanceAlerts";
import { supabase } from "@/integrations/supabase/client";
import {
  MapPin,
  Beer,
  LogOut,
  LayoutDashboard,
  Wrench,
  BarChart3,
  TrendingUp,
  CreditCard,
  Warehouse,
  PlusCircle,
  ClipboardCheck,
  AlertTriangle,
  X,
  Archive,
  CloudOff,
  FileText,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";

import { DispelIcon } from "@/components/DispelLogo";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type NavKey =
  | "dashboard"
  | "bi"
  | "central"
  | "map"
  | "equipe"
  | "consumo"
  | "consumotempo"
  | "vendas"
  | "manutencao"
  | "estoque"
  | "notas"
  | "inventarios"
  | "cargas"
  | "backups"
  | "importar"
  | "relatorio"
  | "governanca"
  | "perfil";
type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  key: NavKey;
};

const NAV: NavItem[] = [
  { key: "dashboard", to: "/app", label: "DASHBOARD", icon: LayoutDashboard, exact: true },
  { key: "bi", to: "/app/bi", label: "BI BARRIS", icon: BarChart3 },
  { key: "map", to: "/app/map", label: "MAPA", icon: MapPin },
  { key: "inventarios", to: "/app/inventarios", label: "INVENTÁRIOS", icon: ClipboardCheck },
  { key: "central", to: "/app/central", label: "CENTRAL DE ESTOQUE", icon: Warehouse },
  { key: "equipe", to: "/app/equipe-bar", label: "EQUIPE DE BAR", icon: CreditCard },
  { key: "consumo", to: "/app/consumo", label: "CONSUMO", icon: BarChart3 },
  { key: "consumotempo", to: "/app/consumo-tempo", label: "CONSUMO × TEMPO", icon: TrendingUp },
  { key: "vendas", to: "/app/abastecimento-meep", label: "ABASTECIMENTO MEEP", icon: CreditCard },
  { key: "manutencao", to: "/app/manutencao", label: "MANUTENÇÃO", icon: Wrench },
  { key: "relatorio", to: "/app/relatorio", label: "RELATÓRIO", icon: FileText },
  { key: "backups", to: "/app/backups", label: "BACKUPS", icon: Archive },
  { key: "governanca", to: "/app/governanca", label: "GOVERNANÇA", icon: ShieldCheck },
  { key: "perfil", to: "/app/perfil", label: "MEU PERFIL", icon: UserIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const { user } = useSession();
  const perms = usePermissions(user?.id);
  const isGestor = perms.isGestor;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const canSee = (key: NavKey) => {
    if (perms.loading) return true;
    switch (key) {
      case "dashboard":
        return perms.canAccessDashboard;
      case "bi":
        return perms.isGestor || perms.isManutencao;
      case "central":
        return perms.isGestor || perms.isManutencao;
      case "map":
        return perms.canAccessMap;
      case "inventarios":
        return perms.canAccessDashboard;
      case "estoque":
        return perms.isGestor || perms.isManutencao;
      case "notas":
        return perms.isGestor || perms.isAdmin || perms.isManutencao;
      case "cargas":
        return perms.isGestor || perms.isManutencao;
      case "equipe":
        return perms.canAccessEquipeBar;
      case "consumo":
        return perms.canAccessConsumo;
      case "consumotempo":
        return perms.isGestor || perms.isManutencao;
      case "vendas":
        return perms.isGestor || perms.isManutencao;
      case "manutencao":
        return perms.canAccessManutencao;
      case "backups":
        return perms.isGestor;
      case "importar":
        return perms.isGestor;
      case "relatorio":
        return perms.isGestor || perms.isManutencao;
      case "governanca":
        return perms.isAdmin;
      case "perfil":
        return !!user;
    }
  };
  const visibleNav = NAV.filter((n) => canSee(n.key));

  const alertsEnabled = !perms.loading && !!user && (perms.isGestor || perms.isManutencao);
  const { unread, clear, latestAlert, dismissAlert } = useMaintenanceAlerts(alertsEnabled);
  const { pending: offlinePending, syncing: offlineSyncing } = useOfflineSync();
  const [barName, setBarName] = useState<string | null>(null);

  useEffect(() => {
    if (!latestAlert?.bar_id) {
      setBarName(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("bars")
      .select("name")
      .eq("id", latestAlert.bar_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setBarName((data as any)?.name ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [latestAlert?.bar_id]);

  useEffect(() => {
    if (perms.loading || !user) return;
    if (perms.onlyEquipeBar && !pathname.startsWith("/app/equipe-bar")) {
      nav({ to: "/app/equipe-bar" });
    }
  }, [perms.loading, perms.onlyEquipeBar, pathname, user, nav]);

  useEffect(() => {
    if (pathname.startsWith("/app/manutencao") && unread > 0) clear();
  }, [pathname, unread, clear]);

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar collapsible="offcanvas">
          <SidebarHeader className="border-b border-sidebar-border">
            <Link to="/app" className="flex items-center gap-2.5 px-2 py-2">
              <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl ring-1 ring-sidebar-border bg-sidebar-accent/40">
                <DispelIcon className="h-8 w-8" />
              </span>
              <div className="leading-tight">
                <div className="font-brand text-xl text-sidebar-foreground">Dispel</div>
                <div className="text-[10px] tracking-[0.35em] text-accent font-display">
                  OPERAÇÃO
                </div>
              </div>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navegação</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleNav.map(({ to, label, icon: Icon, exact, key }) => (
                    <SidebarMenuItem key={to}>
                      <SidebarMenuButton asChild isActive={isActive(to, exact)}>
                        <Link
                          to={to}
                          className="font-display text-[11px] tracking-[0.15em] relative"
                        >
                          <Icon className="h-4 w-4" />
                          <span>{label}</span>
                          {key === "manutencao" && unread > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold animate-pulse">
                              {unread > 99 ? "99+" : unread}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {(isGestor || perms.isManutencao) && (
              <SidebarGroup>
                <SidebarGroupLabel>Ações</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <Link
                          to="/app/bars/new"
                          className="font-display text-[11px] tracking-[0.15em] bg-gradient-gold text-accent-foreground hover:opacity-90"
                        >
                          <PlusCircle className="h-4 w-4" />
                          <span>NOVO BAR</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border">
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <div className="min-w-0 leading-tight">
                <div className="truncate text-xs text-sidebar-foreground">
                  {user?.email?.split("@")[0]}
                </div>
                {isGestor && (
                  <div className="text-[9px] font-display tracking-[0.3em] text-accent">GESTOR</div>
                )}
                {perms.isManutencao && !isGestor && (
                  <div className="text-[9px] font-display tracking-[0.3em] text-accent">
                    MANUTENÇÃO
                  </div>
                )}
                {perms.onlyEquipeBar && (
                  <div className="text-[9px] font-display tracking-[0.3em] text-accent">EQUIPE</div>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 text-sidebar-foreground/80 hover:bg-sidebar-accent"
                onClick={async () => {
                  await signOut();
                  nav({ to: "/auth" });
                }}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 bg-gradient-brand text-sidebar-foreground shadow-elegant">
            <div className="flex items-center gap-3 px-3 py-3">
              <SidebarTrigger className="text-white hover:bg-white/10" />
              <Link to="/app" className="flex items-center gap-2 min-w-0">
                <DispelIcon className="h-7 w-7 shrink-0" />
                <div className="leading-tight min-w-0">
                  <div className="font-brand text-lg truncate">Dispel</div>
                  <div className="text-[9px] tracking-[0.3em] text-accent font-display">
                    OPERAÇÃO
                  </div>
                </div>
              </Link>
              <div className="ml-auto flex items-center gap-2">
                {offlinePending > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-display tracking-[0.15em] px-2 py-1 rounded-full bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/40"
                    title={offlineSyncing ? "Sincronizando…" : "Aguardando rede para sincronizar"}
                  >
                    <CloudOff className="h-3 w-3" />
                    {offlineSyncing
                      ? "SINCRONIZANDO"
                      : `${offlinePending} PENDENTE${offlinePending > 1 ? "S" : ""}`}
                  </span>
                )}
                {alertsEnabled && (
                  <Link
                    to="/app/manutencao"
                    className="relative inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-white/10 transition"
                    aria-label={`${unread} solicitações de manutenção`}
                  >
                    <Wrench className="h-5 w-5 text-white" />
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold animate-pulse ring-2 ring-[var(--sidebar-background,theme(colors.green.900))]">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </Link>
                )}
                {isGestor && (
                  <span className="hidden sm:inline text-[10px] font-display tracking-[0.3em] px-2 py-0.5 rounded-full bg-accent/20 text-accent ring-1 ring-accent/40">
                    GESTOR
                  </span>
                )}
              </div>
            </div>
          </header>
          <main className="flex-1">
            <OfflineBanner />
            <ErrorBoundary resetKey={pathname} boundary="app_shell_main">
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>

      {latestAlert && (
        <div className="fixed inset-0 z-[100] bg-red-600/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in text-white">
          <div className="absolute inset-0 animate-pulse bg-red-700/40 pointer-events-none" />
          <button
            onClick={dismissAlert}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            aria-label="Fechar"
          >
            <X className="h-6 w-6" />
          </button>
          <AlertTriangle className="h-24 w-24 md:h-32 md:w-32 mb-6 animate-bounce drop-shadow-2xl" />
          <div className="font-brand text-4xl md:text-6xl text-center tracking-wide drop-shadow-lg">
            NOVA MANUTENÇÃO
          </div>
          {barName && (
            <div className="mt-4 font-display text-2xl md:text-4xl text-center tracking-[0.15em] uppercase">
              {barName}
            </div>
          )}
          {latestAlert.description && (
            <div className="mt-6 max-w-2xl text-center text-lg md:text-2xl leading-snug px-4">
              {latestAlert.description}
            </div>
          )}
          {latestAlert.requester_name && (
            <div className="mt-4 text-base md:text-lg opacity-90">
              Solicitado por: <strong>{latestAlert.requester_name}</strong>
            </div>
          )}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="bg-white text-red-700 hover:bg-white/90 font-display tracking-widest text-base h-14 px-8"
              onClick={() => {
                dismissAlert();
                nav({ to: "/app/manutencao" });
              }}
            >
              VER MANUTENÇÃO
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white bg-transparent hover:bg-white/10 font-display tracking-widest text-base h-14 px-8"
              onClick={dismissAlert}
            >
              DISPENSAR
            </Button>
          </div>
        </div>
      )}
    </SidebarProvider>
  );
}
