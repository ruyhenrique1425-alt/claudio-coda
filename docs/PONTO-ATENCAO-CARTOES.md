# ⚠️ Ponto de atenção — cartões MEEP (evento de estoque / abastecimento)

## O erro
Dois cartões foram cadastrados na MEEP como **"choperia"**. Mas o cartão
**`B5abb8897`** era, na verdade, da **CHURRASCARIA** — não da choperia.

## A correção (feita)
Para evitar novos erros, o gestor **trocou o cartão da churrascaria** para
**`ab253e8e`**. A partir de **25/07**, este é o cartão oficial da churrascaria.
- Migration `20260725150000_cartao_churrascaria.sql` grava
  `bars.cartao_meep = 'ab253e8e'` na churrascaria e limpa o `B5abb8897` antigo.

## Impacto no histórico de CONSUMO (25/07)
Os `.xls` de consumo são identificados pelo **nome no cabeçalho**, não pelo nº do
cartão. Como o cartão da churrascaria estava rotulado "choperia", **parte do
consumo da churrascaria pode ter sido contada em "Chopperia (1+2)"** no seed
`20260725120000_seed_consumo_2507.sql`.
- **Não reatribuí automaticamente** porque não dá para saber, só pelo `.xls`,
  qual dos arquivos "Chopperia"/"Choperia" era o cartão da churrascaria.
- **Autocorreção:** com o cartão já trocado (`ab253e8e`), a **próxima exportação
  de consumo separa churrascaria de choperia corretamente** — basta reimportar
  (o app é idempotente por bar/dia/marca; substitui os números antigos).

## Go-forward (abastecimento por cartão)
Ao importar o **abastecimento** (evento de estoque, por cartão), o cartão
`ab253e8e` resolve para a **churrascaria**. O vínculo cartão→bar também pode ser
ajustado na tela **Abastecimento MEEP → "Vincular cartões aos bares"**.
