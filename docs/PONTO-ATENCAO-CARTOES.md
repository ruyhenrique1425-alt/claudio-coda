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

## ✅ CHOPPERIA — resolvido
A Chopperia foi reexportada limpa (cartões corretos) = **43 H / 44 A**
(18–24/07). Confirmou-se que um dos "Chopperia" antigos (23/23) era, na verdade,
a churrascaria/Liberdade. Correção em `20260725170000_chopperia_definitivo.sql`
(substitui o valor antigo inflado; idempotente).

## Go-forward
- Cartão `ab253e8e` → **Liberdade** (abastecimento por cartão).
- Nome do bar em tudo (lista, reposição, consumo): **Liberdade**.
- Consumo 25/07 fechado: 15 bares, total **465 H / 467 A**.
