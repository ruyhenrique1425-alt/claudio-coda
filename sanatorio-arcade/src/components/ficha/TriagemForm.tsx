import { motion } from "motion/react";
import { Stethoscope } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { CartaoPixel } from "@/components/CartaoPixel";
import { Logo } from "@/components/Logo";
import { AttributeRow } from "@/components/AttributeRow";
import type { Stats } from "@/lib/paciente-local";

export const ATTRIBUTES = [
  {
    key: "fatorCoringa",
    label: "Fator Coringa",
    hint: "O quão caótico e imprevisível você é. (0 = Planta decorativa / 5 = Capaz de sumir da festa e reaparecer com um cone de trânsito na cabeça).",
  },
  {
    key: "imunidadeEtilica",
    label: "Imunidade Etílica",
    hint: "Seu escudo natural. (0 = Beba água / 5 = Fígado blindado, capaz de aguentar até os combos mais pesados de Smirnoff - da caixa de 6, lógico - com Red Bull Zero).",
  },
  {
    key: "inimigoDoFim",
    label: "Síndrome do Inimigo do Fim",
    hint: "Sua resistência ao fim da festa. (0 = Bateu meia-noite, vira abóbora / 5 = Ignora que o sol raiou, a música parou e o faxineiro já tá varrendo o seu pé).",
  },
  {
    key: "aptidaoAudio",
    label: "Aptidão para Mandar Áudio",
    hint: "O risco social com o celular. (0 = Aparelho no bolso, comportado / 5 = Risco altíssimo de mandar aquele áudio inexplicável de 5 minutos para quem não deveria às 4 da manhã).",
  },
  {
    key: "amnesia",
    label: "Amnésia Anterógrada",
    hint: 'O apagão programado. (0 = Memória fotográfica / 5 = Certeza de que vai mandar no grupo amanhã: "Gente, como eu cheguei em casa?").',
  },
] as const;

export type AttrKey = (typeof ATTRIBUTES)[number]["key"];

export const MAX_PER_ATTR = 5;

/** Etapa 1 da internação: nome de paciente + distribuição dos 15 pontos. */
export function TriagemForm({
  nome,
  onNomeChange,
  stats,
  remaining,
  canConfirm,
  onChange,
  onAvancar,
  erro,
}: {
  nome: string;
  onNomeChange: (v: string) => void;
  stats: Stats;
  remaining: number;
  canConfirm: boolean;
  onChange: (key: AttrKey, delta: number) => void;
  onAvancar: () => void;
  erro: string | null;
}) {
  return (
    <motion.section
      key="triagem"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="mb-5 flex justify-center">
        <Logo tamanho="grande" />
      </div>

      <CartaoPixel tom="purple">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 shrink-0 text-whisky" />
          <h1 className="font-arcade text-[10px] uppercase text-whisky text-glow">
            Sua ficha de internação
          </h1>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          Identifique-se e distribua 15 pontos entre os diagnósticos. No máximo 5 por doença.
        </p>

        <label htmlFor="nome" className="font-arcade mt-5 block text-[8px] uppercase text-neon">
          Nome de paciente
        </label>
        <input
          id="nome"
          value={nome}
          onChange={(e) => onNomeChange(e.target.value)}
          maxLength={24}
          placeholder="DIGITE AQUI"
          className="tap-44 mt-2 w-full rounded-sm border-2 border-neon/50 bg-background px-3 py-3 font-mono text-sm uppercase text-foreground outline-none placeholder:text-muted-foreground focus:border-neon focus:shadow-[0_0_14px_-4px_var(--neon)]"
        />
      </CartaoPixel>

      <div className="sticky top-[86px] z-30 mt-4 rounded-sm border-2 border-whisky bg-background/95 px-4 py-3 backdrop-blur">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <span className="font-arcade truncate text-[9px] uppercase text-foreground">
            Pontos restantes
          </span>
          <motion.span
            key={remaining}
            initial={{ scale: 1.35 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
            className={`font-arcade shrink-0 text-xl ${
              remaining === 0 ? "text-neon text-glow" : "text-whisky text-glow"
            }`}
          >
            {remaining}
          </motion.span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {ATTRIBUTES.map((attr) => (
          <AttributeRow
            key={attr.key}
            label={attr.label}
            hint={attr.hint}
            value={stats[attr.key]}
            max={MAX_PER_ATTR}
            canIncrease={remaining > 0}
            onChange={(delta) => onChange(attr.key, delta)}
          />
        ))}
      </div>

      <ArcadeButton
        onClick={onAvancar}
        disabled={!canConfirm}
        className="mt-6 w-full py-5 text-[11px] uppercase leading-relaxed"
      >
        Escolher personagem
      </ArcadeButton>

      {erro ? (
        <p role="alert" className="mt-3 text-center text-[11px] text-destructive">
          {erro}
        </p>
      ) : null}

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        {nome.trim().length < 2
          ? "Informe seu nome de paciente."
          : remaining > 0
            ? `Distribua os ${remaining} pontos restantes.`
            : "Pronto para internação."}
      </p>
    </motion.section>
  );
}
