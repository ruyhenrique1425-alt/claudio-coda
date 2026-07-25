import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePermissions } from "@/hooks/useSession";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale, CircleCheck, TriangleAlert, Info } from "lucide-react";

export const Route = createFileRoute("/app/balanco")({ component: BalancoPage });

const BRAND_LABEL: Record<string, string> = { heineken: "Heineken", amstel: "Amstel" };

type Linha = {
  marca: string; // 'heineken' | 'amstel' | 'TOTAL'
  recebido: number;
  devolvido: number;
  disp_cheio: number;
  vasilhames_dispel: number;
  allstar_cheio: number;
  allstar_vazio: number;
  bar_plugado: number;
  bar_fechado: number;
  bar_vazio: number;
  pontos_allstar_cheio: number;
  pontos_allstar_vazio: number;
  rastreavel: number;
  em_maos: number;
  quebra: number;
};

export function BalancoPage() {
  const { user } = useSession();
  const perms = usePermissions(user?.id);
  const canView = perms.isGestor || perms.isManutencao;

  const { data, isLoading } = useQuery({
    queryKey: ["balanco-barris"],
    enabled: canView,
    refetchInterval: 60_000,
    queryFn: async () => {
      try {
        const res = await (supabase as any).rpc("balanco_barris");
        if (res.error) return { ok: false, linhas: [] as Linha[] };
        return { ok: true, linhas: (res.data ?? []) as Linha[] };
      } catch {
        return { ok: false, linhas: [] as Linha[] };
      }
    },
  });

  if (!canView) {
    return (
      <div className="p-4">
        <Card className="p-6 text-sm text-muted-foreground">Acesso restrito.</Card>
      </div>
    );
  }

  if (isLoading) return <Skeleton className="h-72" />;

  if (!data?.ok) {
    return (
      <Card className="p-4 text-sm text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          O balanço ainda não está disponível. Aplique a migration{" "}
          <code>20260724200000_balanco_barris.sql</code> (e a{" "}
          <code>20260724190000_fluxo_barril_vazio.sql</code>, que cria o estoque de vazios).
        </span>
      </Card>
    );
  }

  const linhas = data.linhas;
  const total = linhas.find((l) => l.marca === "TOTAL");
  const porMarca = linhas.filter((l) => l.marca !== "TOTAL");
  const quebraTotal = Number(total?.quebra) || 0;
  // Por marca, o que importa é NEGATIVO (mais contado do que entrou).
  const marcasComErro = porMarca.filter((l) => (Number(l.quebra) || 0) < 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg tracking-wider flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" /> BALANÇO DO PARQUE
        </h2>
        <p className="text-xs text-muted-foreground">
          <b>Entrou = saiu + em mãos.</b> Todo barril recebido tem que estar em algum lugar ou já
          ter voltado para a cervejaria.
        </p>
      </div>

      {/* Veredito */}
      <Card
        className={`p-4 border-l-4 ${
          quebraTotal === 0 ? "border-l-primary bg-primary/5" : "border-l-destructive bg-destructive/5"
        }`}
      >
        <div className="flex items-start gap-3">
          {quebraTotal === 0 ? (
            <CircleCheck className="h-6 w-6 text-primary shrink-0" />
          ) : (
            <TriangleAlert className="h-6 w-6 text-destructive shrink-0" />
          )}
          <div>
            <div className="font-display text-lg tracking-wider">
              {quebraTotal === 0
                ? "CONTA FECHADA"
                : `${Math.abs(quebraTotal)} ${Math.abs(quebraTotal) === 1 ? "BARRIL" : "BARRIS"} ${
                    quebraTotal > 0 ? "SEM LOCALIZAÇÃO" : "A MAIS DO QUE O RECEBIDO"
                  }`}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {quebraTotal === 0
                ? "Nenhuma ponta solta: tudo que entrou está contado ou já voltou."
                : quebraTotal > 0
                  ? "Barril recebido que não aparece em nenhum estoque, bar ou devolução. Confira a declaração da Allstar e os inventários pendentes antes de tratar como perda."
                  : "Há mais barril contado do que entrou por nota. Provável ajuste manual de estoque ou entrada não lançada."}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              O fechamento exato é no <b>total</b>: no estoque da DISPEL o vazio vira vasilhame e
              perde a marca, então Heineken e Amstel somam juntos daí em diante.
            </p>
          </div>
        </div>
      </Card>

      {/* Conta que fecha: TOTAL */}
      {total && (
        <Card className="p-4 border-l-4 border-l-primary">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-display tracking-wider">CONTA DO EVENTO (TOTAL)</span>
            <Badge
              variant="outline"
              className={`ml-auto text-[10px] ${
                quebraTotal === 0
                  ? "border-primary/40 text-primary"
                  : "border-destructive/40 text-destructive"
              }`}
            >
              {quebraTotal === 0 ? "fecha" : `quebra ${quebraTotal > 0 ? "+" : ""}${quebraTotal}`}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <Box rotulo="Recebido" valor={total.recebido} />
            <Box rotulo="Devolvido" valor={total.devolvido} />
            <Box rotulo="Em mãos" valor={total.em_maos} destaque />
          </div>

          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            Onde estão os {total.em_maos}
          </div>
          <table className="w-full text-xs">
            <tbody>
              <Ln rot="Estoque DISPEL · cheios (por marca)" v={total.disp_cheio} />
              <Ln rot="Estoque DISPEL · vasilhames (sem marca)" v={total.vasilhames_dispel} vazio />
              <Ln rot="Estoque Allstar · cheios" v={total.allstar_cheio} />
              <Ln rot="Estoque Allstar · vazios" v={total.allstar_vazio} vazio />
              <Ln rot="Bares · plugado" v={total.bar_plugado} />
              <Ln rot="Bares · fechado" v={total.bar_fechado} />
              <Ln rot="Bares · vazio (a recolher)" v={total.bar_vazio} vazio />
              <Ln rot="Pontos Allstar · cheios" v={total.pontos_allstar_cheio} declarado />
              <Ln rot="Pontos Allstar · vazios" v={total.pontos_allstar_vazio} declarado vazio />
            </tbody>
          </table>

          <div className="mt-3 rounded bg-muted/40 p-2 text-[11px] font-mono">
            {total.recebido} − {total.devolvido} − {total.em_maos} ={" "}
            <b className={quebraTotal === 0 ? "text-primary" : "text-destructive"}>{quebraTotal}</b>
          </div>
        </Card>
      )}

      {/* Conferência por marca */}
      <Card className="p-4">
        <h3 className="font-display text-sm tracking-widest text-muted-foreground mb-1">
          CONFERÊNCIA POR MARCA
        </h3>
        <p className="text-[11px] text-muted-foreground mb-3">
          Aqui a conta <b>não</b> fecha em zero de propósito: a diferença é o que daquela marca já
          virou vasilhame ou foi devolvido — e vasilhame não tem marca. O que importa nesta tabela
          é não haver <b>número negativo</b>, que significaria mais barril contado do que entrou.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground text-right">
                <th className="text-left py-1">Marca</th>
                <th className="py-1 px-2">Recebido</th>
                <th className="py-1 px-2">Ainda com marca</th>
                <th className="py-1 pl-2">Virou vasilhame</th>
              </tr>
            </thead>
            <tbody>
              {porMarca.map((l) => {
                const dif = Number(l.quebra) || 0;
                return (
                  <tr key={l.marca} className="border-t border-border/50 text-right">
                    <td className="text-left py-1.5 uppercase">
                      {BRAND_LABEL[l.marca] ?? l.marca}
                    </td>
                    <td className="py-1.5 px-2 tabular-nums">{l.recebido}</td>
                    <td className="py-1.5 px-2 tabular-nums">{l.rastreavel}</td>
                    <td
                      className={`py-1.5 pl-2 tabular-nums font-bold ${
                        dif < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {dif}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {marcasComErro.length > 0 && (
          <p className="text-[11px] text-destructive mt-2">
            {marcasComErro.map((l) => BRAND_LABEL[l.marca] ?? l.marca).join(" e ")} com valor
            negativo: há mais barril contado do que entrou por nota. Erro de lançamento — confira
            as NFs e os ajustes manuais de estoque.
          </p>
        )}
      </Card>

      <Card className="p-3 text-[11px] text-muted-foreground space-y-1.5">
        <div className="flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>
            <b>Antes de tratar quebra como perda física, cheque nesta ordem:</b>
            <ol className="list-decimal ml-4 mt-1 space-y-0.5">
              <li>
                A <b>declaração da Allstar</b> está atualizada? Sem ela, tudo que foi para
                camarote/stand/haras vira quebra aparente.
              </li>
              <li>
                Todos os bares têm <b>inventário recente</b>? Bar sem inventário não soma nada e
                infla a quebra.
              </li>
              <li>
                Todas as <b>notas fiscais</b> foram conciliadas? NF pendente não entra em
                "recebido".
              </li>
              <li>
                Houve <b>ajuste manual</b> de estoque? Ajuste aparece como quebra negativa.
              </li>
            </ol>
          </div>
        </div>
        <p className="pl-5.5">
          "Declarado" = informado pela Allstar, não contado pelo app.
        </p>
      </Card>
    </div>
  );
}

function Box({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`rounded py-2 ${destaque ? "bg-primary/10" : "bg-muted/40"}`}>
      <div className="font-display text-2xl tabular-nums">{valor}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{rotulo}</div>
    </div>
  );
}

function Ln({
  rot,
  v,
  vazio,
  declarado,
}: {
  rot: string;
  v: number;
  vazio?: boolean;
  declarado?: boolean;
}) {
  return (
    <tr className="border-t border-border/50">
      <td className="py-1 pr-2">
        {rot}
        {declarado && (
          <span className="ml-1 text-[9px] uppercase tracking-wider text-muted-foreground">
            declarado
          </span>
        )}
      </td>
      <td className={`py-1 text-right tabular-nums ${vazio ? "text-accent" : ""}`}>{v}</td>
    </tr>
  );
}
