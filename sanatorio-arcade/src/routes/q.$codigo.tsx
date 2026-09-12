import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Gamepad2, ScanLine, Trophy } from "lucide-react";

import { ArcadeButton } from "@/components/ArcadeButton";
import { CenaCoringa } from "@/components/conquistas/CenaCoringa";
import { conquistaPor, guardarPendente, TOTAL_CONQUISTAS } from "@/lib/conquistas";
import { credenciais } from "@/lib/paciente-local";
import { creditarQrCode } from "@/lib/pontos";

/**
 * O que o QR code abre.
 *
 * De propósito, não exige ficha: a graça é ler o código e já ver a cena. Quem
 * ainda não se internou tem a conquista guardada no aparelho e recebe as
 * fichas assim que fizer o prontuário.
 */
export const Route = createFileRoute("/q/$codigo")({
  component: PaginaConquista,
  head: () => ({
    meta: [
      { title: "Conquista destravada — República Sanatório" },
      {
        name: "description",
        content: "Você achou um dos cinco códigos escondidos na festa Sanatório.",
      },
    ],
  }),
});

type Estado = "carregando" | "creditada" | "guardada" | "invalida" | "repetida";

function PaginaConquista() {
  const { codigo } = useParams({ from: "/q/$codigo" });
  const navigate = useNavigate();
  const conquista = conquistaPor(codigo);
  const [estado, setEstado] = useState<Estado>("carregando");

  useEffect(() => {
    if (!conquista) {
      setEstado("invalida");
      return;
    }

    // Sem prontuário: guarda no aparelho e credita depois da internação.
    if (!credenciais()) {
      guardarPendente(conquista.codigo);
      setEstado("guardada");
      return;
    }

    void creditarQrCode(conquista.fichas, conquista.codigo)
      .then(() => setEstado("creditada"))
      .catch(() => setEstado("repetida"));
  }, [conquista]);

  if (!conquista) {
    return (
      <section className="rounded-sm border-2 border-destructive bg-destructive/10 p-6 text-center">
        <ScanLine className="mx-auto h-8 w-8 text-destructive" />
        <p className="font-arcade mt-4 text-[11px] uppercase leading-relaxed text-destructive">
          Código corrompido
        </p>
        <p className="mt-4 text-[13px] leading-relaxed text-foreground">
          Esse QR não é da festa, ou o papel já estava molhado demais. Procure outro.
        </p>
        <Link to="/" className="font-arcade mt-6 block text-[9px] uppercase text-neon underline">
          Voltar para o prontuário
        </Link>
      </section>
    );
  }

  return (
    <section>
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
        <CenaCoringa codigo={conquista.codigo} />
      </motion.div>

      <div className="mt-4 rounded-sm border-2 border-neon bg-card/60 p-5 text-center shadow-[0_0_24px_-8px_var(--neon)]">
        <p className="font-arcade text-[7px] uppercase text-muted-foreground">
          Conquista destravada
        </p>
        <h1 className="font-arcade mt-3 text-[12px] uppercase leading-relaxed text-neon text-glow">
          {conquista.titulo}
        </h1>
        <p className="mt-4 text-[13px] leading-relaxed text-foreground">{conquista.legenda}</p>

        <p className="font-arcade mt-5 text-[14px] text-whisky text-glow">
          +{conquista.fichas} fichas
        </p>

        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {estado === "guardada"
            ? "Guardada no seu aparelho. As fichas entram assim que você preencher a ficha de admissão."
            : estado === "repetida"
              ? "Você já tinha achado este código. As fichas contam uma vez só."
              : estado === "creditada"
                ? "Fichas na conta. Uma das cinco conquistas da noite."
                : "Registrando…"}
        </p>
      </div>

      {estado === "guardada" ? (
        <ArcadeButton
          onClick={() => navigate({ to: "/" })}
          className="mt-5 flex w-full items-center justify-center gap-2 py-5 text-[10px] uppercase"
        >
          Fazer minha ficha e resgatar
        </ArcadeButton>
      ) : (
        <ArcadeButton
          onClick={() => navigate({ to: "/arcade" })}
          className="mt-5 flex w-full items-center justify-center gap-2 py-5 text-[10px] uppercase"
        >
          <Gamepad2 className="h-4 w-4" />
          Voltar para a festa
        </ArcadeButton>
      )}

      <p className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground">
        <Trophy className="h-3.5 w-3.5 text-whisky" aria-hidden />
        Faltam achar os outros códigos. São {TOTAL_CONQUISTAS} pela festa.
      </p>
    </section>
  );
}
