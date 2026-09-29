import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

import { ArcadeButton } from "./ArcadeButton";

type PromptInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

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
 *
 * Fechar o banner não esconde a instalação para sempre: vira um botãozinho
 * fixo no canto, porque quem recusou na hora pode querer instalar depois,
 * já com a festa rolando.
 */
export function InstalarPwa() {
  const [prompt, setPrompt] = useState<PromptInstalacao | null>(null);
  const [disponivelIos, setDisponivelIos] = useState(false);
  const [bannerAberto, setBannerAberto] = useState(true);

  useEffect(() => {
    // O service worker é registrado pelo ModoSitio, que também cuida do cache.
    if (jaInstalado()) return;

    const aoPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as PromptInstalacao);
    };
    window.addEventListener("beforeinstallprompt", aoPrompt);

    if (ehIos()) setDisponivelIos(true);

    return () => window.removeEventListener("beforeinstallprompt", aoPrompt);
  }, []);

  const disponivel = Boolean(prompt) || disponivelIos;
  if (!disponivel) return null;

  if (!bannerAberto) {
    return (
      <button
        onClick={() => setBannerAberto(true)}
        aria-label="Instalar o app na tela inicial"
        title="Instalar o app na tela inicial"
        className="tap-44 fixed bottom-[calc(92px+env(safe-area-inset-bottom))] right-4 z-40 grid h-11 w-11 place-items-center rounded-full border-2 border-whisky bg-background/95 text-whisky shadow-[0_0_14px_-4px_var(--whisky)] backdrop-blur"
      >
        <Download className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-[92px] z-40 mx-auto max-w-md px-4">
      <div className="relative rounded-sm border-2 border-whisky bg-background/95 p-3 backdrop-blur">
        <button
          onClick={() => setBannerAberto(false)}
          aria-label="Fechar (você pode instalar depois pelo botão que fica no canto)"
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
              void prompt.prompt().then(() => setBannerAberto(false));
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
