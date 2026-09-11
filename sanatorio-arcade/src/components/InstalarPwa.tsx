import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

import { ArcadeButton } from "./ArcadeButton";

type PromptInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISPENSADO = "sanatorio:instalacao-dispensada";

function jaInstalado() {
  if (typeof window === "undefined") return true;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return Boolean(standalone || iosStandalone);
}

function ehIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Registra o service worker e convida a instalar na tela inicial.
 * No Android usa o beforeinstallprompt. No iOS esse evento não existe, então
 * resta ensinar o caminho do menu Compartilhar.
 */
export function InstalarPwa() {
  const [prompt, setPrompt] = useState<PromptInstalacao | null>(null);
  const [mostrarIos, setMostrarIos] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    let dispensado = false;
    try {
      dispensado = localStorage.getItem(DISPENSADO) === "1";
    } catch {
      /* armazenamento indisponível */
    }
    if (dispensado || jaInstalado()) return;

    const aoPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as PromptInstalacao);
    };
    window.addEventListener("beforeinstallprompt", aoPrompt);

    if (ehIos()) setMostrarIos(true);

    return () => window.removeEventListener("beforeinstallprompt", aoPrompt);
  }, []);

  function dispensar() {
    try {
      localStorage.setItem(DISPENSADO, "1");
    } catch {
      /* segue sem lembrar */
    }
    setPrompt(null);
    setMostrarIos(false);
  }

  if (!prompt && !mostrarIos) return null;

  return (
    <div className="fixed inset-x-0 bottom-[92px] z-40 mx-auto max-w-md px-4">
      <div className="relative rounded-sm border-2 border-whisky bg-background/95 p-3 backdrop-blur">
        <button
          onClick={dispensar}
          aria-label="Dispensar aviso de instalação"
          className="tap-44 absolute right-1 top-1 grid h-8 w-8 place-items-center text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="font-arcade pr-8 text-[8px] uppercase leading-relaxed text-whisky">
          Instale o prontuário na tela inicial
        </p>

        {prompt ? (
          <ArcadeButton
            tone="whisky"
            onClick={() => {
              void prompt.prompt().then(() => dispensar());
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 py-3 text-[9px] uppercase"
          >
            <Download className="h-4 w-4" />
            Instalar agora
          </ArcadeButton>
        ) : (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            No iPhone: toque em <span className="text-neon">Compartilhar</span> e depois em{" "}
            <span className="text-neon">Adicionar à Tela de Início</span>. O app abre sem a barra do
            navegador.
          </p>
        )}
      </div>
    </div>
  );
}
