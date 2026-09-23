import { Link, useRouterState } from "@tanstack/react-router";
import {
  Camera,
  Gamepad2,
  HeartCrack,
  LayoutGrid,
  MessageSquare,
  ShoppingBag,
  Siren,
  Trophy,
  User,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

import { CrtOverlay } from "./CrtOverlay";
import { Logo } from "./Logo";
import { SinoAvisos } from "./SinoAvisos";
import { Carteira } from "./Carteira";
import { StatusRede } from "./StatusRede";
import { DesafioEmJogo } from "./DesafioEmJogo";
import { lerProntuario } from "@/lib/paciente-local";

/*
 * A barra inferior ocupa a largura inteira, em colunas iguais.
 *
 * Cinco destinos fixos + o botão "Mais" = seis ícones. A Ficha mora no
 * "Mais" junto com Ranking e Loja: é a tela que se visita uma vez para
 * internar e revisita pouco, então ela cede o lugar para as telas de uso
 * diário, que precisam estar sempre a um toque.
 */
const FIXAS = [
  { to: "/mural", label: "Mural", icon: MessageSquare },
  { to: "/camera", label: "Câmera", icon: Camera },
  { to: "/match", label: "Match", icon: HeartCrack },
  { to: "/arcade", label: "Arcade", icon: Gamepad2 },
  { to: "/panico", label: "Pânico", icon: Siren },
] as const;

const NO_MAIS = [
  {
    to: "/",
    label: "Ficha",
    icon: User,
    resumo: "Sua internação, atributos e avatar",
  },
  {
    to: "/ranking",
    label: "Ranking",
    icon: Trophy,
    resumo: "Placar ao vivo das fichas ganhas",
  },
  {
    to: "/loja",
    label: "Loja",
    icon: ShoppingBag,
    resumo: "Molduras e adereços do seu avatar",
  },
  {
    to: "/oficina",
    label: "Oficina",
    icon: Wrench,
    resumo: "Edite nome, cores e itens dos 6 bonecos (senha)",
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [maisAberto, setMaisAberto] = useState(false);

  useEffect(() => {
    setPacienteId(lerProntuario()?.pacienteId ?? null);
    setMaisAberto(false);
  }, [pathname]);

  const emMais = NO_MAIS.some((t) => t.to === pathname);

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
        <StatusRede />
      </header>

      <main className="mx-auto min-h-screen max-w-md px-4 pb-[calc(108px+env(safe-area-inset-bottom))] pt-[96px]">
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

      {/* Gaveta do "Mais": o que não cabe na barra fica a um toque, com nome
          e explicação, em vez de escondido fora da tela. */}
      <AnimatePresence>
        {maisAberto ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/80"
            onClick={() => setMaisAberto(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="fixed inset-x-0 bottom-[calc(82px+env(safe-area-inset-bottom))] mx-auto max-w-md px-4"
            >
              <div
                className="caixa-pixel p-4"
                style={{ "--moldura": "var(--neon)" } as React.CSSProperties}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-arcade text-[9px] uppercase text-neon">Resto da ala</p>
                  <button
                    onClick={() => setMaisAberto(false)}
                    aria-label="Fechar"
                    className="tap-44 grid h-9 w-9 place-items-center text-muted-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <ul className="mt-3 grid gap-2">
                  {NO_MAIS.map(({ to, label, icon: Icon, resumo }) => (
                    <li key={to}>
                      <Link
                        to={to}
                        onClick={() => setMaisAberto(false)}
                        className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-3 ${
                          pathname === to ? "text-neon" : "text-foreground"
                        }`}
                      >
                        <span className="grid h-12 w-12 place-items-center border-2 border-current">
                          <Icon className="h-7 w-7" />
                        </span>
                        <span className="min-w-0">
                          <span className="font-arcade block text-[9px] uppercase">{label}</span>
                          <span className="mt-1.5 block text-[12px] leading-snug text-muted-foreground">
                            {resumo}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-neon/30 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {/* Seis colunas iguais: cinco telas fixas + "Mais". Em 360px dá
            60px por coluna, folgado para ícone e rótulo. */}
        <ul className="mx-auto grid max-w-md grid-cols-6">
          {FIXAS.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={`flex h-[74px] flex-col items-center justify-center gap-1.5 transition-colors ${
                    active ? "text-neon" : "text-muted-foreground"
                  }`}
                >
                  <Icon
                    strokeWidth={active ? 2.4 : 2}
                    className={`h-[26px] w-[26px] ${active ? "drop-shadow-[0_0_10px_var(--neon)]" : ""}`}
                  />
                  <span className="font-arcade text-[7px] uppercase">{label}</span>
                  <span
                    className={`h-1 w-6 transition-all ${
                      active ? "bg-neon shadow-[0_0_10px_var(--neon)]" : "bg-transparent"
                    }`}
                  />
                </Link>
              </li>
            );
          })}

          <li>
            <button
              onClick={() => setMaisAberto((v) => !v)}
              aria-expanded={maisAberto}
              aria-label="Mais telas: ficha, ranking e loja"
              className={`flex h-[74px] w-full flex-col items-center justify-center gap-1.5 transition-colors ${
                maisAberto || emMais ? "text-neon" : "text-muted-foreground"
              }`}
            >
              <LayoutGrid
                strokeWidth={maisAberto || emMais ? 2.4 : 2}
                className={`h-[26px] w-[26px] ${maisAberto || emMais ? "drop-shadow-[0_0_10px_var(--neon)]" : ""}`}
              />
              <span className="font-arcade text-[7px] uppercase">Mais</span>
              <span
                className={`h-1 w-6 transition-all ${
                  emMais ? "bg-neon shadow-[0_0_10px_var(--neon)]" : "bg-transparent"
                }`}
              />
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
