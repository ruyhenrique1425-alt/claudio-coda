import { Link, useRouterState } from "@tanstack/react-router";
import {
  Camera,
  Gamepad2,
  HeartCrack,
  MessageSquare,
  ShoppingBag,
  Siren,
  Trophy,
  User,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";

import { CrtOverlay } from "./CrtOverlay";
import { Logo } from "./Logo";
import { SinoAvisos } from "./SinoAvisos";
import { Carteira } from "./Carteira";
import { DesafioEmJogo } from "./DesafioEmJogo";
import { lerProntuario } from "@/lib/paciente-local";

const TABS = [
  { to: "/", label: "Ficha", icon: User },
  { to: "/arcade", label: "Arcade", icon: Gamepad2 },
  { to: "/match", label: "Match", icon: HeartCrack },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/loja", label: "Loja", icon: ShoppingBag },
  { to: "/camera", label: "Câmera", icon: Camera },
  { to: "/mural", label: "Mural", icon: MessageSquare },
  { to: "/panico", label: "Pânico", icon: Siren },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [pacienteId, setPacienteId] = useState<string | null>(null);

  useEffect(() => {
    setPacienteId(lerProntuario()?.pacienteId ?? null);
  }, [pathname]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <CrtOverlay />

      <header className="fixed inset-x-0 top-0 z-40 border-b border-neon/30 bg-background/90 backdrop-blur">
        <div className="relative mx-auto grid max-w-md grid-cols-[minmax(0,1fr)_auto] items-end gap-2 px-4 py-3">
          <Logo />
          <div className="flex shrink-0 items-center gap-1">
            {pacienteId ? <Carteira pacienteId={pacienteId} compacta /> : null}
            {pacienteId ? <SinoAvisos pacienteId={pacienteId} /> : null}
          </div>
        </div>
      </header>

      {/* O padding inferior acompanha a barra maior e a safe area do iPhone. */}
      <main className="mx-auto min-h-screen max-w-md px-4 pb-[calc(104px+env(safe-area-inset-bottom))] pt-[92px]">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>

      {pacienteId ? <DesafioEmJogo pacienteId={pacienteId} /> : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neon/30 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {/* Oito abas não cabem numa linha só em tela de 360px: rola na horizontal
            com cada item em 64px, que é alvo confortável de polegar. */}
        <ul className="mx-auto flex max-w-md snap-x overflow-x-auto">
          {TABS.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <li key={to} className="shrink-0 basis-[20%] snap-start">
                <Link
                  to={to}
                  className={`flex h-[68px] min-w-[64px] flex-col items-center justify-center gap-1 transition-colors ${
                    active ? "text-neon" : "text-muted-foreground"
                  }`}
                >
                  <Icon
                    className={`h-[26px] w-[26px] ${active ? "drop-shadow-[0_0_8px_var(--neon)]" : ""}`}
                  />
                  <span className="font-arcade text-[8px] uppercase">{label}</span>
                  <span
                    className={`h-0.5 w-7 rounded-full transition-all ${
                      active ? "bg-neon shadow-[0_0_8px_var(--neon)]" : "bg-transparent"
                    }`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
