# Posso confiar nas telas de consumo?

Auditoria das **7 telas** que mostram algum número de consumo, com veredito e
pré-condição de cada uma.

Método: rastreio da origem de cada número até a tabela, comparação das fórmulas
entre telas, e busca por truncamento silencioso (limites de linha).

---

## Resumo

| Tela | Confiável? | Depende de |
|---|---|---|
| Início → Barris consumidos | ✅ sim | migrations aplicadas |
| Consumo → Ranking | ✅ sim | migrations aplicadas |
| Consumo → Ao longo do tempo | ✅ sim | migrations aplicadas |
| Consumo → Por bar (real / MEEP) | ⚠️ com ressalva | import da MEEP em dia |
| Cobertura & Rotas → vazios | ✅ sim | migrations aplicadas |
| Detalhe do bar → barris consumidos | ❌ **era furado** — corrigido agora | deploy |
| Relatório PDF → ranking de consumo | ⚠️ **divergia** — corrigido agora | deploy |

---

## Os dois problemas encontrados nesta auditoria

### 1. Detalhe do bar: número truncado em silêncio

`app.bars.$barId.tsx` buscava os recolhimentos com **`.limit(50)`** e somava
exatamente essa lista no total de "barris consumidos".

Consequência: passando de 50 recolhimentos naquele bar, o número **parava de
crescer** — sem aviso, sem erro. Quanto mais movimentado o bar, mais errado
ficava o número. Justamente os maiores.

**Corrigido:** limite removido dessa consulta.

### 2. Relatório PDF: somava pontos fora da operação

`app.relatorio.tsx` calculava a lista de bares da operação (`vendaBars`) mas
**não a usava** no consumo — somava todos os `empties_removed`, inclusive de
camarote/stand/haras.

Consequência: o total do PDF era **maior** que o do app, sem explicação
aparente.

**Corrigido:** o mesmo filtro das demais telas.

---

## Telas em que se pode confiar (e por quê)

**Início → Barris consumidos**, **Consumo → Ranking**, **Consumo → Ao longo do
tempo** e os vazios de **Cobertura & Rotas** leem todas a mesma origem:
`empties_removed`, o registro de vazio recolhido — um fluxo com data, autor e
vínculo com a reposição.

As quatro passaram pelas mesmas correções:

- teto no padrão removido (subestimava quem passava do padrão);
- mesmo filtro de bares da operação (os totais batem entre si);
- "a recolher" desconta o que saiu depois do inventário (não pede recolher duas
  vezes);
- soma `recolhidos + ainda no bar` só no período **Tudo** — a ausência de dupla
  contagem foi verificada exaustivamente em `docs/verificar_dupla_contagem.py`.

---

## A ressalva do MEEP

**Consumo → Por bar (real)** é a única tela que não vem da operação: vem de
`meep_consumo_bar`, alimentada por importação manual de arquivo.

Ela é confiável para o que se propõe — o que os clientes efetivamente
consumiram —, mas fica **parada no tempo** entre uma importação e outra. Não
existe alerta de "MEEP desatualizada": um número velho parece atual.

Regra prática: use-a para leitura comercial (quanto cada bar vendeu), nunca
para decidir reposição.

---

## O que ainda pode fazer um número certo parecer errado

Nenhum destes é defeito de cálculo — são dados que faltam:

1. **Migrations não aplicadas.** As correções vivem em migrations. Sem aplicar,
   o app roda com a lógica antiga.
2. **Inventário atrasado.** O "ainda no bar" sai da última foto. Bar sem
   inventário recente subestima o consumo.
3. **Consumo depois do último inventário e ainda não recolhido.** Não existe em
   registro nenhum. O erro é sempre **para menos** — o número mostrado é um
   piso, nunca uma sobra.
4. **Notas fiscais não lançadas.** Não afetam o consumo, mas derrubam o
   "recebido" no Balanço e inflam a quebra aparente.

---

## Resposta curta

Depois de aplicar as migrations e subir estas duas correções: **sim**, pode
confiar nas telas de consumo — todas leem a mesma origem e batem entre si.

Antes disso: as telas de **detalhe do bar** e do **relatório PDF** estavam
erradas, cada uma do seu jeito, e nenhuma das duas avisava.
