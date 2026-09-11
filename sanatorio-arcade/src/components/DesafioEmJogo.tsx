import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Swords } from "lucide-react";

import { ArcadeButton } from "./ArcadeButton";
import { supabase } from "@/integrations/supabase/client";
import { jogarDesafio } from "@/lib/pontos";

type Desafio = {
  id: string;
  de_paciente: string;
  para_paciente: string;
  pontos: number;
  status: string;
  escolha_de: number | null;
  escolha_para: number | null;
  vencedor: string | null;
};

/**
 * Par ou ímpar valendo fichas. Cada um manda um número de 0 a 5 sem ver o do
 * outro — quem escolheu primeiro só vê "aguardando". A soma decide, e quem
 * desafiou fica com o par.
 */
export function DesafioEmJogo({ pacienteId }: { pacienteId: string }) {
  const [desafio, setDesafio] = useState<Desafio | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const puxar = useCallback(async () => {
    const { data } = await supabase
      .from("desafios")
      .select("id, de_paciente, para_paciente, pontos, status, escolha_de, escolha_para, vencedor")
      .or(`de_paciente.eq.${pacienteId},para_paciente.eq.${pacienteId}`)
      .in("status", ["aceito", "resolvido"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return;
    // Some com o resultado depois de uns segundos, para não travar a tela.
    if (data.status === "resolvido") {
      setDesafio(data as Desafio);
      setTimeout(() => setDesafio(null), 6000);
      return;
    }
    setDesafio(data as Desafio);
  }, [pacienteId]);

  useEffect(() => {
    void puxar();
    const canal = supabase
      .channel(`desafio-jogo-${pacienteId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "desafios" }, () => {
        void puxar();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [pacienteId, puxar]);

  if (!desafio) return null;

  const souDesafiante = desafio.de_paciente === pacienteId;
  const minhaEscolha = souDesafiante ? desafio.escolha_de : desafio.escolha_para;
  const resolvido = desafio.status === "resolvido";
  const venci = desafio.vencedor === pacienteId;

  async function escolher(n: number) {
    if (!desafio) return;
    setEnviando(true);
    setErro(null);
    try {
      await jogarDesafio(desafio.id, n);
      await puxar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "A jogada não foi.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/95 px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`w-full max-w-sm rounded-sm border-2 p-6 text-center ${
          resolvido
            ? venci
              ? "border-neon bg-neon/10"
              : "border-destructive bg-destructive/10"
            : "border-purple bg-card/80"
        }`}
      >
        <Swords
          className={`mx-auto h-8 w-8 ${resolvido ? (venci ? "text-neon" : "text-destructive") : "text-whisky"}`}
        />

        {resolvido ? (
          <>
            <p
              className={`font-arcade mt-4 text-[12px] uppercase text-glow ${
                venci ? "text-neon" : "text-destructive"
              }`}
            >
              {venci ? `Você levou ${desafio.pontos} fichas` : `Perdeu ${desafio.pontos} fichas`}
            </p>
            <p className="mt-3 text-[12px] text-muted-foreground">
              {desafio.escolha_de} + {desafio.escolha_para} ={" "}
              {(desafio.escolha_de ?? 0) + (desafio.escolha_para ?? 0)} —{" "}
              {((desafio.escolha_de ?? 0) + (desafio.escolha_para ?? 0)) % 2 === 0
                ? "par"
                : "ímpar"}
            </p>
            <p className="mt-4 text-[12px] leading-relaxed text-whisky">
              {venci ? "Cobre a dose." : "Pague a dose."}
            </p>
          </>
        ) : minhaEscolha !== null ? (
          <>
            <p className="font-arcade mt-4 text-[11px] uppercase text-whisky text-glow">
              Aguardando o outro paciente
            </p>
            <p className="mt-3 text-[12px] text-muted-foreground">
              Você mandou {minhaEscolha}. Ele não vê o seu número.
            </p>
          </>
        ) : (
          <>
            <p className="font-arcade mt-4 text-[11px] uppercase leading-relaxed text-neon text-glow">
              Valendo {desafio.pontos} fichas
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
              Escolha um número. {souDesafiante ? "Você fica com o par." : "Você fica com o ímpar."}
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <ArcadeButton
                  key={n}
                  disabled={enviando}
                  onClick={() => void escolher(n)}
                  className="py-4 text-[12px]"
                >
                  {n}
                </ArcadeButton>
              ))}
            </div>
          </>
        )}

        {erro ? <p className="mt-3 text-[11px] text-destructive">{erro}</p> : null}
      </motion.div>
    </div>
  );
}
