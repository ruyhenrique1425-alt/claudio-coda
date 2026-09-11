import { Link, useRouterState } from "@tanstack/react-router";
import { Camera, Gamepad2, HeartCrack, MessageSquare, Siren, User } from "lucide-react";
import type { ReactNode } from "react";
import { motion } from "motion/react";

import { CrtOverlay } from "./CrtOverlay";
import { Logo } from "./Logo";

const TABS = [
  { to: "/", label: "Ficha", icon: User },
  { to: "/mural", label: "Mural", icon: MessageSquare },
  { to: "/camera", label: "Câmera", icon: Camera },
  { to: "/match", label: "Match", icon: HeartCrack },
  { to: "/arcade", label: "Arcade", icon: Gamepad2 },
  { to: "/panico", label: "Pânico", icon: Siren },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <CrtOverlay />

      <header className="fixed inset-x-0 top-0 z-40 border-b border-neon/30 bg-background/90 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-[minmax(0,1fr)_auto] items-end gap-3 px-4 py-3">
          <Logo />
          <span className="font-arcade shrink-0 text-[8px] text-neon/70">● ONLINE</span>
        </div>
      </header>

      <main className="mx-auto min-h-screen max-w-md px-4 pb-28 pt-[86px]">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neon/30 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto grid max-w-md grid-cols-6">
          {TABS.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={`tap-44 flex h-16 flex-col items-center justify-center gap-1 transition-colors ${
                    active ? "text-neon" : "text-muted-foreground"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${active ? "drop-shadow-[0_0_6px_var(--neon)]" : ""}`}
                  />
                  <span className="font-arcade text-[7px] uppercase">{label}</span>
                  <span
                    className={`h-0.5 w-6 rounded-full transition-all ${
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
