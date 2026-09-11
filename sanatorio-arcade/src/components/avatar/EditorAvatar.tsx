import { useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Dices } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { PixelAvatar } from "./PixelAvatar";
import {
  ACESSORIOS,
  AVATAR_PADRAO,
  CORES,
  EXPRESSOES,
  ITENS,
  PERSONAGENS,
  avatarAleatorio,
  avatarPadraoDe,
  personagemPor,
  type Avatar,
  type PersonagemId,
} from "./personagens";

type Escolha = { personagem: PersonagemId; avatar: Avatar };

function Seletor<T extends { id: string; label: string }>({
  titulo,
  opcoes,
  valor,
  onChange,
}: {
  titulo: string;
  opcoes: readonly T[];
  valor: string;
  onChange: (id: T["id"]) => void;
}) {
  const i = Math.max(
    0,
    opcoes.findIndex((o) => o.id === valor),
  );
  const passo = (d: number) => onChange(opcoes[(i + d + opcoes.length) % opcoes.length]!.id);

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border border-purple/60 bg-card/40 p-2">
      <button
        type="button"
        aria-label={`${titulo}: anterior`}
        onClick={() => passo(-1)}
        className="tap-44 grid h-10 w-10 place-items-center rounded-sm border border-neon/50 text-neon active:scale-95"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="min-w-0 text-center">
        <p className="font-arcade text-[7px] uppercase tracking-widest text-muted-foreground">
          {titulo}
        </p>
        <p className="mt-1 truncate text-[12px] text-foreground">{opcoes[i]!.label}</p>
      </div>
      <button
        type="button"
        aria-label={`${titulo}: próximo`}
        onClick={() => passo(1)}
        className="tap-44 grid h-10 w-10 place-items-center rounded-sm border border-neon/50 text-neon active:scale-95"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function EditorAvatar({
  valorInicial,
  onConfirmar,
  onVoltar,
  enviando = false,
  textoConfirmar = "Confirmar diagnóstico",
}: {
  valorInicial?: Escolha;
  onConfirmar: (escolha: Escolha) => void;
  onVoltar?: () => void;
  enviando?: boolean;
  textoConfirmar?: string;
}) {
  const [personagem, setPersonagem] = useState<PersonagemId>(
    valorInicial?.personagem ?? PERSONAGENS[0].id,
  );
  const [avatar, setAvatar] = useState<Avatar>(
    valorInicial?.avatar ?? { ...AVATAR_PADRAO, ...avatarPadraoDe(PERSONAGENS[0].id) },
  );

  const p = personagemPor(personagem);

  function escolher(id: PersonagemId) {
    setPersonagem(id);
    setAvatar((a) => ({ ...a, ...avatarPadraoDe(id) }));
  }

  function sortear() {
    const s = avatarAleatorio();
    setPersonagem(s.personagem);
    setAvatar(s.avatar);
  }

  return (
    <section>
      <header className="rounded-sm border-2 border-neon bg-card/50 p-4 text-center">
        <h2 className="font-arcade text-[10px] uppercase leading-relaxed text-neon text-glow">
          Selecione seu paciente
        </h2>
        <p className="mt-3 text-[12px] text-muted-foreground">
          Escolha o boneco e personalize do seu jeito.
        </p>
      </header>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {PERSONAGENS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => escolher(item.id)}
            aria-pressed={item.id === personagem}
            className={`grid place-items-center gap-1 rounded-sm border-2 p-2 transition ${
              item.id === personagem
                ? "border-neon bg-neon/10 shadow-[0_0_16px_-6px_var(--neon)]"
                : "border-purple/50 bg-card/30"
            }`}
          >
            <PixelAvatar
              personagem={item.id}
              avatar={{ ...AVATAR_PADRAO, ...item.padrao }}
              size="sm"
            />
            <span className="font-arcade text-center text-[6px] uppercase leading-tight text-muted-foreground">
              {item.nome}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid place-items-center rounded-sm border-2 border-whisky bg-background/60 py-5">
        <motion.div
          key={personagem}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        >
          <PixelAvatar personagem={personagem} avatar={avatar} size="lg" glow />
        </motion.div>
        <p className="font-arcade mt-4 text-[9px] uppercase text-whisky">{p.nome}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">{p.tagline}</p>
      </div>

      <div className="mt-4 space-y-2">
        <Seletor
          titulo="Roupa"
          opcoes={CORES}
          valor={avatar.roupa}
          onChange={(roupa) => setAvatar((a) => ({ ...a, roupa }))}
        />
        <Seletor
          titulo="Cabelo"
          opcoes={CORES}
          valor={avatar.cabelo}
          onChange={(cabelo) => setAvatar((a) => ({ ...a, cabelo }))}
        />
        <Seletor
          titulo="Acessório"
          opcoes={ACESSORIOS}
          valor={avatar.acessorio}
          onChange={(acessorio) => setAvatar((a) => ({ ...a, acessorio }))}
        />
        <Seletor
          titulo="Expressão"
          opcoes={EXPRESSOES}
          valor={avatar.expressao}
          onChange={(expressao) => setAvatar((a) => ({ ...a, expressao }))}
        />
        <Seletor
          titulo="Item na mão"
          opcoes={ITENS}
          valor={avatar.item}
          onChange={(item) => setAvatar((a) => ({ ...a, item }))}
        />
      </div>

      <ArcadeButton
        tone="purple"
        onClick={sortear}
        className="mt-4 flex w-full items-center justify-center gap-2 py-3 text-[9px] uppercase"
      >
        <Dices className="h-4 w-4" /> Sortear
      </ArcadeButton>

      <ArcadeButton
        onClick={() => onConfirmar({ personagem, avatar })}
        disabled={enviando}
        className="mt-3 w-full py-5 text-[10px] uppercase"
      >
        {enviando ? "Internando…" : textoConfirmar}
      </ArcadeButton>

      {onVoltar ? (
        <ArcadeButton
          tone="whisky"
          onClick={onVoltar}
          className="mt-3 w-full py-3 text-[9px] uppercase"
        >
          Voltar
        </ArcadeButton>
      ) : null}
    </section>
  );
}
