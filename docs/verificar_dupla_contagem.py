"""
Um barril pode ser contado DUAS VEZES em (recolhidos + a_recolher)?

a_recolher = max(0, vazios_no_ultimo_inventario - recolhidos_APOS_o_inventario)
recolhidos = soma de empties_removed

Testa exaustivamente linhas do tempo de um bar/marca.
"""
from itertools import product

def simula(eventos, t_inv_idx):
    """
    eventos: lista de ('consumo', n) ou ('recolhe', n) em ordem
    t_inv_idx: em que ponto da linha do tempo o inventário foi tirado
    """
    vazio_no_bar = 0
    recolhido_total = 0
    consumido_real = 0
    vazio_na_foto = None
    recolhido_apos_foto = 0

    for i, (tipo, n) in enumerate(eventos):
        if i == t_inv_idx:
            vazio_na_foto = vazio_no_bar          # tira a foto
        if tipo == "consumo":
            vazio_no_bar += n
            consumido_real += n
        else:
            n = min(n, vazio_no_bar)
            vazio_no_bar -= n
            recolhido_total += n
            if vazio_na_foto is not None:
                recolhido_apos_foto += n
    if vazio_na_foto is None:
        vazio_na_foto = vazio_no_bar

    a_recolher = max(0, vazio_na_foto - recolhido_apos_foto)
    contabilizado = recolhido_total + a_recolher
    return consumido_real, contabilizado, vazio_no_bar

# varredura exaustiva de linhas do tempo curtas
piores = []
for n_ev in range(1, 5):
    for combo in product([("consumo",3),("consumo",5),("recolhe",2),("recolhe",4)], repeat=n_ev):
        for t_inv in range(n_ev + 1):
            real, cont, sobra = simula(list(combo), t_inv)
            if cont > real:                       # DUPLA CONTAGEM
                piores.append(("DUPLICOU", combo, t_inv, real, cont))
            elif cont < real:
                piores.append(("SUBCONTOU", combo, t_inv, real, cont))

dup = [p for p in piores if p[0] == "DUPLICOU"]
sub = [p for p in piores if p[0] == "SUBCONTOU"]

print(f"casos testados com dupla contagem : {len(dup)}")
print(f"casos testados com subcontagem    : {len(sub)}")

if dup:
    print("\n❌ DUPLA CONTAGEM encontrada:")
    for p in dup[:3]:
        print("  ", p)
else:
    print("\n✅ NENHUMA dupla contagem em nenhuma linha do tempo.")

if sub:
    print("\n⚠️  Subcontagem (esperada) — exemplos:")
    for p in sub[:3]:
        _, combo, t_inv, real, cont = p
        print(f"   eventos={combo} inventário no ponto {t_inv}")
        print(f"   consumido real={real}  contabilizado={cont}  faltou={real-cont}")
    print("""
   Causa: consumo que aconteceu DEPOIS do último inventário e ainda não foi
   recolhido não existe em lugar nenhum — nem na foto, nem no fluxo.
   É informação que o sistema não tem, não erro de fórmula.""")
