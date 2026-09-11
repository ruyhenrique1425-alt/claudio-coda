import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Dices, Brain, Users, ScanFace } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoletaEtilica } from "@/components/arcade/RoletaEtilica";
import { GeniusManicomio } from "@/components/arcade/GeniusManicomio";
import { DiagnosticoCruzado } from "@/components/arcade/DiagnosticoCruzado";
import { DetectorMentiras } from "@/components/arcade/DetectorMentiras";

export const Route = createFileRoute("/arcade")({
  head: () => ({
    meta: [
      { title: "Arcade do Sanatório — fliperama da ala" },
      {
        name: "description",
        content:
          "Roleta Russa Etílica, Genius do Manicômio e Diagnóstico Cruzado: os três minigames da festa Sanatório.",
      },
      { property: "og:title", content: "Arcade do Sanatório" },
      {
        property: "og:description",
        content: "Três minigames caóticos para jogar direto do celular na festa.",
      },
    ],
  }),
  component: ArcadePage,
});

type JogoId = "roleta" | "genius" | "cruzado" | "detector";

const JOGOS = [
  {
    id: "roleta" as JogoId,
    titulo: "Roleta Russa Etílica",
    resumo: "Gire e aceite o castigo líquido.",
    icon: Dices,
    tone: "neon" as const,
  },
  {
    id: "genius" as JogoId,
    titulo: "Genius do Manicômio",
    resumo: "Repita a sequência antes que os reflexos te traiam.",
    icon: Brain,
    tone: "purple" as const,
  },
  {
    id: "cruzado" as JogoId,
    titulo: "Diagnóstico Cruzado",
    resumo: "Missões sociais obrigatórias com desconhecidos.",
    icon: Users,
    tone: "whisky" as const,
  },
  {
    id: "detector" as JogoId,
    titulo: "Detector de Mentiras",
    resumo: "O giroscópio sente o tremor de quem mente.",
    icon: ScanFace,
    tone: "neon" as const,
  },
];

function ArcadePage() {
  const [aberto, setAberto] = useState<JogoId | null>(null);
  const jogo = JOGOS.find((j) => j.id === aberto) ?? null;

  return (
    <section>
      <header className="rounded-sm border-2 border-neon/50 bg-card/50 p-4 text-center">
        <h1 className="font-arcade text-[11px] uppercase leading-relaxed text-neon text-glow">
          Arcade da ala
        </h1>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          Insira sua ficha imaginária e escolha um tratamento. Todos jogam do próprio celular.
        </p>
      </header>

      <div className="mt-5 space-y-4">
        {JOGOS.map(({ id, titulo, resumo, icon: Icon, tone }) => (
          <ArcadeButton
            key={id}
            tone={tone}
            onClick={() => setAberto(id)}
            className="w-full p-4 text-left"
          >
            <span className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-sm border-2 border-current">
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="font-arcade block text-[9px] uppercase leading-relaxed">
                  {titulo}
                </span>
                <span className="mt-2 block text-[11px] leading-relaxed text-muted-foreground">
                  {resumo}
                </span>
              </span>
            </span>
          </ArcadeButton>
        ))}
      </div>

      <Dialog open={aberto !== null} onOpenChange={(o) => setAberto(o ? aberto : null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-sm border-2 border-neon bg-background p-5">
          <DialogHeader>
            <DialogTitle className="font-arcade text-[10px] uppercase leading-relaxed text-neon text-glow">
              {jogo?.titulo}
            </DialogTitle>
            <DialogDescription className="text-[12px] leading-relaxed text-muted-foreground">
              {jogo?.resumo}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            {aberto === "roleta" ? <RoletaEtilica /> : null}
            {aberto === "genius" ? <GeniusManicomio /> : null}
            {aberto === "cruzado" ? <DiagnosticoCruzado /> : null}
            {aberto === "detector" ? <DetectorMentiras /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
