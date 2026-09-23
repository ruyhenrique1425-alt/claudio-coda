import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Dices, Brain, Users, Siren, Wind, Spade } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { CartaoPixel } from "@/components/CartaoPixel";
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
import { BafometroDeDedo } from "@/components/arcade/BafometroDeDedo";
import { Sueca } from "@/components/arcade/Sueca";

export const Route = createFileRoute("/arcade")({
  head: () => ({
    meta: [
      { title: "Arcade do Sanatório — fliperama da ala" },
      {
        name: "description",
        content:
          "Cinco máquinas na ala, mais o Botão do Pânico: Sueca Bêbada, Teste de Sobriedade, Roleta Etílica, Terapia de Choque e Bafômetro de Dedo.",
      },
      { property: "og:title", content: "Arcade do Sanatório" },
      {
        property: "og:description",
        content: "Minigames caóticos para jogar direto do celular na festa, valendo fichas.",
      },
    ],
  }),
  component: ArcadePage,
});

type JogoId = "sueca" | "roleta" | "sobriedade" | "bafometro" | "terapia";

// Roleta e Terapia abrem a lista: são os dois jogos de entrada mais fácil
// (giro de roleta, missão social), o que a mesa costuma pedir primeiro
// quando ninguém sabe por onde começar. O Bafômetro fecha a lista: é o que
// mais exige do dedo e da atenção, então fica para quem já aqueceu.
const JOGOS = [
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
    id: "sueca" as JogoId,
    titulo: "Sueca Bêbada",
    resumo: "Dois baralhos, 104 cartas. Cada valor manda uma coisa na roda.",
    fichas: "3 fichas por carta",
    icon: Spade,
    tone: "purple" as const,
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
    id: "bafometro" as JogoId,
    titulo: "Bafômetro de Dedo",
    resumo: "Dez segundos martelando a garrafa, três segurando firme.",
    fichas: "até 50 fichas",
    icon: Wind,
    tone: "whisky" as const,
  },
];

function ArcadePage() {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState<JogoId | null>(null);
  const jogo = JOGOS.find((j) => j.id === aberto) ?? null;

  return (
    <section>
      <CartaoPixel tom="neon" className="text-center">
        <h1 className="font-arcade text-[11px] uppercase leading-relaxed text-neon text-glow">
          Arcade da ala
        </h1>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          Cinco máquinas valendo fichas para o ranking, mais o Pânico coletivo. A Sueca é de mesa:
          um celular no meio da roda e todo mundo joga junto.
        </p>
      </CartaoPixel>

      <div className="mt-5 space-y-4">
        {JOGOS.slice(0, 3).map((jogo) => (
          <BotaoJogo key={jogo.id} {...jogo} onAbrir={() => setAberto(jogo.id)} />
        ))}

        {/* O Pânico é coletivo e ao vivo: abre a tela dedicada, não um diálogo. */}
        <ArcadeButton
          tone="vermelho"
          onClick={() => void navigate({ to: "/panico" })}
          className="w-full p-4 text-left"
        >
          <span className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-sm border-2 border-current">
              <Siren className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="font-arcade block text-[9px] uppercase leading-relaxed">
                Botão do Pânico
              </span>
              <span className="mt-2 block text-[11px] leading-relaxed text-muted-foreground">
                Contador coletivo ao vivo. Todo mundo clica no mesmo botão.
              </span>
              <span className="font-arcade mt-2 block text-[7px] uppercase text-whisky">
                Sem fichas — é só caos em grupo
              </span>
            </span>
          </span>
        </ArcadeButton>

        {JOGOS.slice(3).map((jogo) => (
          <BotaoJogo key={jogo.id} {...jogo} onAbrir={() => setAberto(jogo.id)} />
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
            {aberto === "sueca" ? <Sueca /> : null}
            {aberto === "roleta" ? <RoletaEtilica /> : null}
            {aberto === "sobriedade" ? <TesteSobriedade /> : null}
            {aberto === "bafometro" ? <BafometroDeDedo /> : null}
            {aberto === "terapia" ? <TerapiaDeChoque /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function BotaoJogo({
  titulo,
  resumo,
  fichas,
  icon: Icon,
  tone,
  onAbrir,
}: (typeof JOGOS)[number] & { onAbrir: () => void }) {
  return (
    <ArcadeButton tone={tone} onClick={onAbrir} className="w-full p-4 text-left">
      <span className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-sm border-2 border-current">
          <Icon className="h-6 w-6" />
        </span>
        <span className="min-w-0">
          <span className="font-arcade block text-[9px] uppercase leading-relaxed">{titulo}</span>
          <span className="mt-2 block text-[11px] leading-relaxed text-muted-foreground">
            {resumo}
          </span>
          <span className="font-arcade mt-2 block text-[7px] uppercase text-whisky">{fichas}</span>
        </span>
      </span>
    </ArcadeButton>
  );
}
