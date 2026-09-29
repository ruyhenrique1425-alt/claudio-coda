import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { internarPaciente } from "@/lib/sanatorio.functions";
import { lerProntuario, salvarProntuario } from "@/lib/paciente-local";
import { online } from "@/lib/rede";

/**
 * Reativa fichas feitas antes da carteira existir.
 *
 * O token do paciente só passou a existir junto com o sistema de pontos. Quem
 * já tinha prontuário salvo ficou com id sem token: `credenciais()` devolvia
 * nulo, todo jogo recusava creditar e a tela ainda pedia para fazer a ficha
 * que a pessoa já tinha feito. O ranking, por tabela, ficava zerado.
 *
 * Não dá para recuperar o token de um id antigo sem abrir a porta para
 * qualquer um reivindicar qualquer ficha. Então a ficha é reemitida com o
 * mesmo nome, os mesmos atributos e o mesmo avatar, e o prontuário do aparelho
 * passa a apontar para a nova. A linha antiga fica órfã no banco, o que é
 * inofensivo enquanto a festa não começou.
 */
/**
 * Trava de módulo contra reemissão dupla.
 *
 * O StrictMode do React monta o efeito duas vezes em desenvolvimento, e uma
 * reconexão pode remontar o componente. Sem a trava, cada disparo criaria uma
 * ficha nova — o paciente acabaria com três linhas no banco e o ranking com
 * três nomes iguais.
 */
let reemitindo = false;

export function ReativarFicha() {
  const internar = useServerFn(internarPaciente);
  const [estado, setEstado] = useState<"parado" | "reativando" | "pronto">("parado");

  useEffect(() => {
    const p = lerProntuario();
    if (!p || p.token) return;
    if (!online()) return;
    if (reemitindo) return;

    reemitindo = true;
    let ativo = true;
    setEstado("reativando");

    void internar({
      data: {
        nome: p.nome,
        fator_coringa: p.stats.fatorCoringa,
        imunidade_etilica: p.stats.imunidadeEtilica,
        inimigo_do_fim: p.stats.inimigoDoFim,
        aptidao_audio: p.stats.aptidaoAudio,
        amnesia_anterograda: p.stats.amnesia,
        personagem: p.personagem,
        avatar: p.avatar,
      },
    })
      .then(({ id, token }) => {
        if (!ativo) return;
        salvarProntuario({ ...p, pacienteId: id, token });
        setEstado("pronto");
        // Recarrega para as telas pegarem o prontuário novo já com token.
        setTimeout(() => window.location.reload(), 900);
      })
      .catch(() => {
        // Falhou (sem sinal, servidor fora): libera para tentar no próximo
        // carregamento, em vez de deixar o paciente sem token para sempre.
        reemitindo = false;
        if (ativo) setEstado("parado");
      });

    return () => {
      ativo = false;
    };
  }, [internar]);

  if (estado === "parado") return null;

  return (
    <div className="fixed inset-x-0 top-[96px] z-50 mx-auto max-w-md px-4">
      <p className="font-arcade rounded-sm border-2 border-whisky bg-background/95 px-3 py-3 text-center text-[8px] uppercase leading-relaxed text-whisky backdrop-blur">
        {estado === "reativando"
          ? "Reemitindo seu prontuário…"
          : "Prontuário reemitido. Suas fichas já contam."}
      </p>
    </div>
  );
}
