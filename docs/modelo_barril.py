"""
Modelo de conservação do barril — Dispel Operação.

Objetivo: tratar o parque de barris como um sistema fechado e descobrir
ONDE ele permite vazamento (barril que some da conta sem registro).

Princípio: um barril é um objeto físico. Em qualquer instante ele está em
exatamente UM estado. Toda mudança de estado é uma transição. Se toda
transição tem registro, o sistema fecha. Se alguma transição não tem
registro, o barril "some" — e a diferença aparece como quebra.
"""

from dataclasses import dataclass, field

# ---------------------------------------------------------------------
# 1) ESTADOS — onde um barril pode estar
# ---------------------------------------------------------------------
ESTADOS = {
    "FORA":            "ainda na cervejaria / já devolvido (fora do sistema)",
    "DISP_CHEIO":      "estoque DISPEL, cheio",
    "DISP_VAZIO":      "estoque DISPEL, vazio (aguardando carga)",
    "ALLS_CHEIO":      "estoque Allstar, cheio",
    "ALLS_VAZIO":      "estoque Allstar, vazio",
    "BAR_FECHADO":     "no bar, cheio de reserva",
    "BAR_PLUGADO":     "no bar, na torneira",
    "BAR_VAZIO":       "no bar, consumido, a recolher",
    "PONTO_ALLS_CHEIO":"ponto abastecido pela Allstar (camarote/stand/haras), cheio",
    "PONTO_ALLS_VAZIO":"ponto abastecido pela Allstar, vazio, a recolher",
}


@dataclass
class Transicao:
    nome: str
    de: str
    para: str
    tabela: str | None   # onde fica registrado; None = NÃO REGISTRADO
    obs: str = ""

    @property
    def rastreavel(self) -> bool:
        return self.tabela is not None


# ---------------------------------------------------------------------
# 2) TRANSIÇÕES — como estão hoje no banco
# ---------------------------------------------------------------------
TRANSICOES: list[Transicao] = [
    # ---- entrada de cheios ----
    Transicao("NF conciliada", "FORA", "DISP_CHEIO",
              "notas_fiscais + warehouse_movements(entrada,+1)"),
    Transicao("Carga Heineken", "FORA", "DISP_CHEIO",
              "heineken_cargas + warehouse_movements(entrada,+1)"),

    # ---- distribuição de cheios ----
    Transicao("Transferência p/ Allstar", "DISP_CHEIO", "ALLS_CHEIO",
              "warehouse_movements(transferencia)"),
    Transicao("Reposição em bar", "DISP_CHEIO", "BAR_FECHADO",
              "refills + refill_items + warehouse_movements(abastecimento_bar,-1)"),
    Transicao("Allstar abastece ponto", "ALLS_CHEIO", "PONTO_ALLS_CHEIO",
              None,
              "Allstar abastece camarote/stand/haras. NÃO existe registro: "
              "esses pontos não são gerenciados no app."),

    # ---- consumo ----
    Transicao("Fechado vai p/ torneira", "BAR_FECHADO", "BAR_PLUGADO",
              "inventories (só aparece na foto seguinte)",
              "Não é evento: só se percebe comparando inventários."),
    Transicao("Plugado esvazia", "BAR_PLUGADO", "BAR_VAZIO",
              "inventories (só aparece na foto seguinte)",
              "Idem — o consumo não gera evento próprio."),
    Transicao("Ponto Allstar esvazia", "PONTO_ALLS_CHEIO", "PONTO_ALLS_VAZIO",
              None,
              "Sem inventário nesses pontos."),

    # ---- recolhimento (operação) ----
    Transicao("Recolher vazio do bar", "BAR_VAZIO", "DISP_VAZIO",
              "empties_removed + empty_movements(recolhimento_bar,+1)"),
    Transicao("Recolher vazio do ponto Allstar", "PONTO_ALLS_VAZIO", "ALLS_VAZIO",
              None,
              "O gestor citou 'os a recolher da all star'. NÃO HÁ REGISTRO."),
    Transicao("Vazio Allstar volta p/ DISPEL", "ALLS_VAZIO", "DISP_VAZIO",
              None,
              "Sem registro de transferência de VAZIOS entre armazéns."),

    # ---- devolução (comodato) ----
    Transicao("Carga leva vasilhames", "DISP_VAZIO", "FORA",
              "heineken_cargas.vasilhames_recolhidos + empty_movements(devolucao_heineken,-1)"),
    Transicao("NF de devolução de vazios", "DISP_VAZIO", "FORA",
              "conciliar_nota_fiscal(_vazios) + controle_comodato_global",
              "⚠️ mexe no comodato mas NÃO baixa empty_movements — dupla porta."),
]


def diagnostico() -> None:
    print("=" * 72)
    print("DIAGNÓSTICO DE VAZAMENTO — onde o barril some da conta")
    print("=" * 72)

    buracos = [t for t in TRANSICOES if not t.rastreavel]
    print(f"\nTransições SEM registro: {len(buracos)} de {len(TRANSICOES)}\n")
    for t in buracos:
        print(f"  ✗ {t.nome}")
        print(f"      {t.de} → {t.para}")
        print(f"      {t.obs}\n")

    # Estados que só podem ser alcançados por transição não rastreada:
    alcancaveis_ok = {t.para for t in TRANSICOES if t.rastreavel}
    orfaos = set()
    for t in TRANSICOES:
        if not t.rastreavel:
            orfaos.add(t.para)
    so_por_buraco = orfaos - alcancaveis_ok
    print("Estados alcançáveis SOMENTE por transição não registrada:")
    for e in sorted(so_por_buraco):
        print(f"  • {e:20s} {ESTADOS[e]}")

    print("\n" + "=" * 72)
    print("EQUAÇÃO DE FECHAMENTO (por marca)")
    print("=" * 72)
    print("""
  ENTRADAS = SAÍDAS + EM MÃOS

  ENTRADAS  = NF_cheios + Carga_cheios                     [recebido da cervejaria]

  SAÍDAS    = Vasilhames_devolvidos                        [voltou para a cervejaria]

  EM MÃOS   = DISP_CHEIO + ALLS_CHEIO                      [cheio no galpão]
            + BAR_PLUGADO + BAR_FECHADO                    [cheio no bar]
            + BAR_VAZIO                                    [vazio a recolher no bar]
            + DISP_VAZIO + ALLS_VAZIO                      [vazio no galpão]
            + PONTO_ALLS_CHEIO + PONTO_ALLS_VAZIO          [nos pontos da Allstar]

  QUEBRA    = ENTRADAS − SAÍDAS − EM MÃOS

  Se QUEBRA ≠ 0, o barril existe fisicamente mas não está em nenhuma conta:
  perdido, quebrado, ou não contado.
""")


if __name__ == "__main__":
    diagnostico()
