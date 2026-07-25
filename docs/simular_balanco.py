"""
Simulação do parque de barris — prova que a equação fecha, e mede o buraco.

Roda dois cenários idênticos:
  A) COMO ESTÁ HOJE  — o ramo Allstar não tem registro
  B) COM OS BURACOS TAPADOS

Se a equação estiver certa, o cenário B fecha em zero e o A acusa exatamente
o que passou pela Allstar.
"""

from dataclasses import dataclass, field


@dataclass
class Parque:
    """Contagem de barris por local/estado, de UMA marca."""
    disp_cheio: int = 0
    disp_vazio: int = 0
    alls_cheio: int = 0
    alls_vazio: int = 0
    bar_plugado: int = 0
    bar_fechado: int = 0
    bar_vazio: int = 0
    ponto_alls_cheio: int = 0
    ponto_alls_vazio: int = 0

    # acumuladores de fluxo
    recebido: int = 0    # entrou da cervejaria
    devolvido: int = 0   # voltou para a cervejaria

    # o que o app CONSEGUE ver (registrado)
    registrado_alls_cheio: int = 0
    registrado_alls_vazio: int = 0

    log: list[str] = field(default_factory=list)

    # ---------------- eventos ----------------
    def receber_nf(self, n: int):
        self.recebido += n
        self.disp_cheio += n
        self.log.append(f"NF: +{n} cheios no DISPEL")

    def transferir_allstar(self, n: int):
        n = min(n, self.disp_cheio)
        self.disp_cheio -= n
        self.alls_cheio += n
        self.registrado_alls_cheio += n     # transferência É registrada
        self.log.append(f"Transferência DISPEL→Allstar: {n} cheios")

    def abastecer_bar(self, n: int):
        n = min(n, self.disp_cheio)
        self.disp_cheio -= n
        self.bar_fechado += n
        self.log.append(f"Reposição em bar: {n} cheios")

    def abastecer_ponto_allstar(self, n: int, registra: bool):
        """Allstar entrega em camarote/stand/haras."""
        n = min(n, self.alls_cheio)
        self.alls_cheio -= n
        self.ponto_alls_cheio += n
        if registra:
            self.registrado_alls_cheio -= n
        self.log.append(f"Allstar abastece ponto: {n} cheios (registrado={registra})")

    def consumir_bar(self, n: int):
        n = min(n, self.bar_fechado + self.bar_plugado)
        tira_f = min(n, self.bar_fechado)
        self.bar_fechado -= tira_f
        self.bar_plugado -= (n - tira_f)
        self.bar_vazio += n
        self.log.append(f"Consumo em bar: {n} viram vazios")

    def consumir_ponto_allstar(self, n: int):
        n = min(n, self.ponto_alls_cheio)
        self.ponto_alls_cheio -= n
        self.ponto_alls_vazio += n
        self.log.append(f"Consumo em ponto Allstar: {n} viram vazios")

    def recolher_bar(self, n: int):
        n = min(n, self.bar_vazio)
        self.bar_vazio -= n
        self.disp_vazio += n
        self.log.append(f"Recolhimento de bar: {n} vazios → DISPEL")

    def recolher_ponto_allstar(self, n: int, registra: bool):
        n = min(n, self.ponto_alls_vazio)
        self.ponto_alls_vazio -= n
        self.alls_vazio += n
        if registra:
            self.registrado_alls_vazio += n
        self.log.append(f"Recolhimento ponto Allstar: {n} vazios (registrado={registra})")

    def transferir_vazios_allstar_dispel(self, n: int, registra: bool):
        n = min(n, self.alls_vazio)
        self.alls_vazio -= n
        self.disp_vazio += n
        if registra:
            self.registrado_alls_vazio -= n
        self.log.append(f"Vazios Allstar→DISPEL: {n} (registrado={registra})")

    def devolver_heineken(self, n: int):
        n = min(n, self.disp_vazio)
        self.disp_vazio -= n
        self.devolvido += n
        self.log.append(f"Carga leva: {n} vasilhames devolvidos")

    # ---------------- contas ----------------
    def em_maos_real(self) -> int:
        """Todo barril fisicamente com a DISPEL."""
        return (self.disp_cheio + self.disp_vazio
                + self.alls_cheio + self.alls_vazio
                + self.bar_plugado + self.bar_fechado + self.bar_vazio
                + self.ponto_alls_cheio + self.ponto_alls_vazio)

    def em_maos_visivel(self, ve_allstar: bool) -> int:
        """O que o app consegue somar."""
        base = (self.disp_cheio + self.disp_vazio
                + self.bar_plugado + self.bar_fechado + self.bar_vazio)
        if ve_allstar:
            base += (self.alls_cheio + self.alls_vazio
                     + self.ponto_alls_cheio + self.ponto_alls_vazio)
        else:
            # hoje o app só enxerga o saldo de CHEIOS da Allstar (warehouse_stock),
            # e nada do que foi para os pontos nem dos vazios de lá
            base += self.alls_cheio
        return base

    def quebra(self, ve_allstar: bool) -> int:
        return self.recebido - self.devolvido - self.em_maos_visivel(ve_allstar)


def cenario(registra_allstar: bool) -> Parque:
    p = Parque()
    p.receber_nf(200)
    p.transferir_allstar(60)
    p.abastecer_bar(100)
    p.abastecer_ponto_allstar(40, registra=registra_allstar)
    p.consumir_bar(80)
    p.consumir_ponto_allstar(30)
    p.recolher_bar(70)
    p.recolher_ponto_allstar(25, registra=registra_allstar)
    p.transferir_vazios_allstar_dispel(20, registra=registra_allstar)
    p.devolver_heineken(85)
    return p


def main() -> None:
    print("=" * 74)
    print("SIMULAÇÃO — 200 barris entram, evento roda, quanto fecha?")
    print("=" * 74)

    for rotulo, registra in [("A) COMO ESTÁ HOJE", False), ("B) BURACOS TAPADOS", True)]:
        p = cenario(registra)
        print(f"\n{rotulo}")
        print("-" * 74)
        for l in p.log:
            print(f"   {l}")
        print()
        print(f"   Recebido (NF) .................. {p.recebido:>5}")
        print(f"   Devolvido à Heineken ........... {p.devolvido:>5}")
        print(f"   Em mãos (físico real) .......... {p.em_maos_real():>5}")
        print(f"   Em mãos (que o app soma) ....... {p.em_maos_visivel(registra):>5}")
        q = p.quebra(registra)
        print(f"   QUEBRA APARENTE ................ {q:>5}  {'✅ fecha' if q == 0 else '❌ NÃO FECHA'}")

        # confere a identidade física (tem que fechar sempre)
        fisico = p.recebido - p.devolvido - p.em_maos_real()
        assert fisico == 0, f"modelo inconsistente: {fisico}"
        if q != 0:
            print(f"   → os {q} barris sumidos estão em:")
            print(f"       ponto Allstar cheio ...... {p.ponto_alls_cheio}")
            print(f"       ponto Allstar vazio ...... {p.ponto_alls_vazio}")
            print(f"       Allstar vazio (galpão) ... {p.alls_vazio}")
            soma = p.ponto_alls_cheio + p.ponto_alls_vazio + p.alls_vazio
            print(f"       soma ..................... {soma}  {'✅ explica tudo' if soma == q else '❌'}")

    print("\n" + "=" * 74)
    print("CONCLUSÃO")
    print("=" * 74)
    print("""
A identidade física fecha SEMPRE (recebido − devolvido − em mãos = 0):
o modelo está correto.

A quebra que aparece hoje NÃO é barril perdido — é barril que existe mas o
app não consegue somar, porque o ramo da Allstar não tem registro:

  • o que a Allstar entregou nos pontos (camarote/stand/haras)
  • o vazio parado nesses pontos, a recolher
  • o vazio já recolhido, parado no galpão da Allstar

Enquanto esses três não forem registrados, a conta do evento nunca fecha —
e pior: a quebra APARENTE cresce ao longo do evento, dando a impressão de
perda física onde não há.
""")


if __name__ == "__main__":
    main()
