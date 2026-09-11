import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Dices, Brain, Users, ScanFace, Wind } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoletaEtilica } from "@/components/arcade/RoletaEtilica";
import { TesteSobriedade } from "@/components/arcade/TesteSobriedade";
import { TerapiaDeChoque } from "@/components/arcade/TerapiaDeChoque";
import { DetectorMentiras } from "@/components/arcade/DetectorMentiras";
import { BafometroDeDedo } from "@/components/arcade/BafometroDeDedo";

export const Route = createFileRoute("/arcade")({
  head: () => ({
    meta: [
      { title: "Arcade do Sanatório — fliperama da ala" },
      {
        name: "description",
        content:
          "Cinco máquinas na ala: Roleta Etílica, Teste de Sobriedade, Bafômetro de Dedo, Terapia de Choque e Detector de Mentiras.",
      },
      { property: "og:title", content: "Arcade do Sanatório" },
      {
        property: "og:description",
        content: "Cinco minigames caóticos para jogar direto do celular na festa, valendo fichas.",
      },
    ],
  }),
  component: ArcadePage,
});

type JogoId = "roleta" | "sobriedade" | "bafometro" | "terapia" | "detector";

const JOGOS = [
  {
    id: "bafometro" as JogoId,
    titulo: "Bafômetro de Dedo",
    resumo: "Dez segundos martelando a garrafa, três segurando firme.",
    fichas: "até 50 fichas",
    icon: Wind,
    tone: "whisky" as const,
  },
  {
    id: "sobriedade" as JogoId,
    titulo: "Teste de Sobriedade",
    resumo: "A sequência acelera até ficar impossível. Sempre acelera.",
    fichas: "8 fichas por rodada",
    icon: Brain,
    tone: "purple" as const,
  },
  {
    id: "roleta" as JogoId,
    titulo: "Roleta Russa Etílica",
    resumo: "Gire e aceite o castigo. Duas fatias pagam fichas.",
    fichas: "25 ou 50, se der sorte",
    icon: Dices,
    tone: "neon" as const,
  },
  {
    id: "terapia" as JogoId,
    titulo: "Terapia de Choque",
    resumo: "Missão social com dois minutos no relógio. Você escolhe a dose.",
    fichas: "10, 20 ou 35 fichas",
    icon: Users,
    tone: "whisky" as const,
  },
  {
    id: "detector" as JogoId,
    titulo: "Detector de Mentiras",
    resumo: "O giroscópio sente o tremor de quem mente.",
    fichas: "8 fichas por análise",
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
          Cinco máquinas, todas valendo fichas para o ranking. Cada um joga do próprio celular.
        </p>
      </header>

      <div className="mt-5 space-y-4">
        {JOGOS.map(({ id, titulo, resumo, fichas, icon: Icon, tone }) => (
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
                <span className="font-arcade mt-2 block text-[7px] uppercase text-whisky">
                  {fichas}
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
            {aberto === "sobriedade" ? <TesteSobriedade /> : null}
            {aberto === "bafometro" ? <BafometroDeDedo /> : null}
            {aberto === "terapia" ? <TerapiaDeChoque /> : null}
            {aberto === "detector" ? <DetectorMentiras /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
