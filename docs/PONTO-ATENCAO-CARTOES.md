# ⚠️ Ponto de atenção — churrascaria → Liberdade e cartões MEEP

## O que aconteceu
- Dois cartões estavam cadastrados na MEEP como **"choperia"**. O cartão
  **`B5abb8897`** era, na verdade, da **churrascaria** — não da choperia.
- O gestor **trocou o cartão** da churrascaria para **`ab253e8e`** (oficial a
  partir de 25/07) e **renomeou o bar para "Liberdade"**.

## Correções aplicadas (via código)
- `20260725150000_cartao_churrascaria.sql` — cartão `ab253e8e` na Liberdade;
  limpa o `B5abb8897` antigo.
- `20260725160000_renomeia_liberdade.sql` — renomeia `Churrascaria liberdade` →
  **`Liberdade`** (padrão/rota seguem por bar_id: Rota 5, 6/6) e **corrige o
  consumo da Liberdade** com a exportação nova (arquivo `..._20.xls`,
  cartão certo): **23 H / 23 A** (19, 21, 22 e 24/07). Remove o registro antigo
  de churrascaria.

## ⚠️ Ainda pendente: CHOPPERIA
Como o cartão da ex-churrascaria estava rotulado "choperia", **um dos arquivos
antigos "Chopperia/Choperia" pode ser, na verdade, a churrascaria**. Não dá para
saber qual só pelos arquivos. Então o total atual de **"Chopperia (1+2)" pode
estar inflado** (contando parte da Liberdade).
- **Como zerar essa dúvida:** reexporte o consumo da **Chopperia** (1º e 2º andar)
  agora, com os cartões já corretos, e reimporte. Como o import é **idempotente**
  (substitui por bar/dia/marca), o número da Chopperia se corrige.

## Go-forward
- Cartão `ab253e8e` → **Liberdade** (abastecimento por cartão).
- Nome do bar em tudo (lista, reposição, consumo): **Liberdade**.
