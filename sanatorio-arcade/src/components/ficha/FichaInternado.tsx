import { useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ClipboardCheck, Gamepad2, RotateCcw } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { AltaMedica } from "@/components/AltaMedica";
import { Carteira } from "@/components/Carteira";
import { Extrato } from "@/components/Extrato";
import { Moldura, NomeDoPaciente } from "@/components/Moldura";
import { RadarAtributos } from "@/components/RadarAtributos";
import { Inventario } from "@/components/conquistas/Inventario";
import { PixelAvatar } from "@/components/avatar/PixelAvatar";
import { laudoDe } from "@/lib/laudos";
import type { Prontuario } from "@/lib/paciente-local";

import { ATTRIBUTES, MAX_PER_ATTR } from "./TriagemForm";

/** Etapa final: resumo do paciente já internado — avatar, carteira, atributos, alta. */
export function FichaInternado({
  prontuario,
  itens,
  onRefazer,
  onAltaConcluida,
}: {
  prontuario: Prontuario;
  itens: unknown;
  onRefazer: () => void;
  onAltaConcluida: () => void;
}) {
  const navigate = useNavigate();

  return (
    <motion.section
      key="internado"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="rounded-sm border-2 border-neon bg-card/60 p-5 text-center shadow-[0_0_28px_-10px_var(--neon)]">
        <div className="flex justify-center">
          <Moldura itens={itens}>
            <PixelAvatar
              personagem={prontuario.personagem}
              avatar={prontuario.avatar}
              itens={itens}
              size="lg"
              glow
              title={`Avatar de ${prontuario.nome}`}
            />
          </Moldura>
        </div>
        <ClipboardCheck className="mx-auto mt-3 h-8 w-8 text-neon" />

        <h1 className="font-arcade mt-4 text-[11px] uppercase leading-relaxed text-neon text-glow">
          {prontuario.altaEm ? "Paciente com alta" : "Paciente internado"}
        </h1>
        <p className="font-arcade mt-3 text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
          Leito {prontuario.pacienteId?.slice(0, 4).toUpperCase() ?? "—"}
        </p>
        <p className="font-arcade mt-2 break-words text-sm text-whisky">
          <NomeDoPaciente nome={prontuario.nome} itens={itens} />
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Internado em {new Date(prontuario.internadoEm).toLocaleDateString("pt-BR")}
        </p>
      </div>

      {prontuario.pacienteId ? (
        <div className="mt-4">
          <Carteira pacienteId={prontuario.pacienteId} />
        </div>
      ) : null}

      <div className="mt-4 rounded-sm border-2 border-purple/70 bg-card/50 p-4">
        <div className="flex justify-center">
          <RadarAtributos stats={prontuario.stats} />
        </div>
        <p className="mt-3 rounded-sm border border-whisky/50 bg-whisky/10 px-3 py-3 text-center text-[12px] leading-relaxed text-whisky">
          {laudoDe(prontuario.stats)}
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {ATTRIBUTES.map(({ key, label }) => (
          <div
            key={key}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm border border-purple/60 bg-card/40 px-3 py-3"
          >
            <span className="min-w-0 text-[13px] leading-snug text-foreground">{label}</span>
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex gap-1">
                {Array.from({ length: MAX_PER_ATTR }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-3 w-1.5 rounded-sm ${
                      i < prontuario.stats[key] ? "bg-whisky" : "bg-input"
                    }`}
                  />
                ))}
              </div>
              <span className="font-arcade w-4 text-right text-[10px] text-whisky">
                {prontuario.stats[key]}
              </span>
            </div>
          </div>
        ))}
      </div>

      {prontuario.pacienteId ? <Inventario pacienteId={prontuario.pacienteId} /> : null}

      {prontuario.pacienteId ? <Extrato pacienteId={prontuario.pacienteId} /> : null}

      <AltaMedica jaTemAlta={Boolean(prontuario.altaEm)} aoConcluir={onAltaConcluida} />

      <ArcadeButton
        onClick={() => navigate({ to: "/arcade" })}
        className="mt-6 flex w-full items-center justify-center gap-2 py-4 text-[10px] uppercase"
      >
        <Gamepad2 className="h-4 w-4" />
        Entrar no arcade
      </ArcadeButton>

      <ArcadeButton
        tone="whisky"
        onClick={onRefazer}
        className="mt-3 flex w-full items-center justify-center gap-2 py-4 text-[10px] uppercase"
      >
        <RotateCcw className="h-4 w-4" />
        Refazer triagem
      </ArcadeButton>
    </motion.section>
  );
}
