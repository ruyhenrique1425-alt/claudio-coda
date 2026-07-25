# Auditoria de linhagem de dados — Dispel Operação

Varredura de todas as telas para responder: **cada número exibido tem origem
fiel nos dados que fornecemos, ou nasce do código?**

Método: rastrear cada indicador que aparece em mais de uma tela até a tabela de
origem, e comparar as fórmulas entre telas. Nada aqui foi validado contra o
banco de produção (sem acesso) — as conclusões vêm do código, das migrations e
do `types.ts`, que é **gerado do banco real**.

---

## 🔴 CRÍTICO — quebra a entrada de estoque

### 1. `move_type` inválido nas funções do banco

O enum `warehouse_move_type` aceita apenas
`entrada | transferencia | abastecimento_bar | ajuste`
(criado em `20260718011558`, confirmado no `types.ts` gerado do banco, linha 1355).

Mas **duas funções gravam `'recebimento_heineken'`**, que não existe no enum:

| Função | Migration | Quando dispara |
|---|---|---|
| `apply_heineken_carga()` | `20260720004829` | ao registrar uma carga |
| `conciliar_nota_fiscal()` | `20260722015926` | ao conciliar uma NF |

Efeito: as duas falham com `invalid input value for enum warehouse_move_type`.
Como **todo barril que entra no DISPEL passa por carga ou por NF**, o caminho de
entrada de estoque está inoperante. A baixa por reposição usa
`abastecimento_bar` (válido) e funciona — ou seja, **o saldo só desce, nunca
sobe**.

Consequência na leitura dos números: se o estoque em tela parece baixo demais ou
negativo em relação ao que entrou fisicamente, é isto — não é erro de contagem.

➡️ Corrigido em `supabase/migrations/20260724150000_fix_move_type_invalido.sql`
(troca o literal por `'entrada'`; a origem do movimento continua legível em
`notes`). **Depois de aplicar, conferir se falta lançar as entradas que foram
rejeitadas no período** — a migration corrige a função, não recria os
movimentos perdidos.

Observação: o mesmo erro existia em `app.importar.tsx` (modo "Entradas/saídas de
estoque") e já havia sido corrigido numa rodada anterior. A origem provável é
cópia entre o código e as funções do banco.

---

## 🟠 Divergências entre telas (mesmo indicador, número diferente)

### 2. "Consumo" tem 4 definições diferentes convivendo

| # | Origem | Natureza | Telas |
|---|---|---|---|
| 1 | `empties_removed` | **fluxo** (soma por período) | Consumo (Ranking e Tempo), Início, Relatório, detalhe do bar |
| 2 | `inventory_items.status='vazio'` | **foto** (não soma no tempo) | Central, Consumo (Ranking, parte de baixo), Início |
| 3 | `meep_consumo_bar` | venda real MEEP | Consumo (Por bar), Início, Barris |
| 4 | `meep_vendas_bar` | **barris entregues**, não consumo | Abastecimento MEEP |

As definições 1 e 2 são legítimas e complementares, mas **só a 1 pode ser somada
por período** — "vazio" do inventário é um retrato do momento; somar vários dias
duplica. Isso já foi corrigido na tela inicial.

A definição 4 tem nome enganoso (`meep_vendas_bar` guarda *abastecimento*). O
nome ficou por compatibilidade da migration e está documentado, mas é uma
armadilha para quem consultar o banco direto.

**Recomendação:** rotular na interface qual definição está em uso sempre que o
número aparecer (a tela inicial já faz isso com o seletor de fonte).

### 3. Bares fora de `bar_venda`/`bar_parceiro` somem ou viram "Bar removido"

Quase todas as telas filtram bares por
`bar_type IN ('bar_venda','bar_parceiro')`. O enum tem **cinco** valores:
`camarote | stand | haras | bar_venda | bar_parceiro`.

Consequência: se algum ponto do tipo `camarote`, `stand` ou `haras` tiver
barris ou vazios lançados, ele **não aparece** nas contagens de barris — mas
**entra** nos totais de consumo, porque `empties_removed` é consultada sem
filtro de bar. Na tela Consumo esse ponto aparece com o rótulo
**"Bar removido"**, que é enganoso: o bar não foi removido, apenas é de um tipo
fora do filtro.

Isto **não é um número inventado**, mas é um número cuja composição não é óbvia
em tela. Vale confirmar com o gestor se existem pontos desses tipos em operação.

➡️ Ajustado: a tela inicial passou a **incluir** esses lançamentos no total
(agrupados como "Outro ponto") para bater com a tela Consumo. Antes eu os
descartava — o total da inicial ficaria menor que o do Consumo. Erro meu,
introduzido na rodada anterior e corrigido nesta.

---

## 🟡 Números que nascem do código, não dos dados

Nenhum destes é "inventado" no sentido de dado falso — são **regras de negócio
codificadas**. O ponto é que **não têm origem no banco**, então ninguém consegue
mudá-los pela interface, e eles não estão registrados como decisão do gestor.

| Valor | Onde | O que decide | Confirmado pelo gestor? |
|---|---|---|---|
| `IDEAL_TEMP = -1` °C | `app.index.tsx:37` **e** `app.bars.$barId.tsx:1425` (duplicado) | selo "PADRÃO DISPEL · SUPER GELADO" e o ranking de mais gelados | **não consta** |
| `fillPct < 20` → crítico<br>`< 30` → alto<br>`<= 50` → médio | `computeSeverity`, `app.index.tsx:75-77` | cor e prioridade dos alertas de reposição | **não consta** |
| `saudePct >= 70` verde / `>= 40` laranja | `app.index.tsx:527` | cor da "Saúde da Operação" | **não consta** |
| `atendimento < 0.5` = bar crítico | `app.operacao.tsx` | contagem de "bares críticos" por rota | **não consta** (definido por mim) |
| cobertura `< 1` dia crítico / `< 2` atenção | `app.operacao.tsx` | alertas de cobertura | **não consta** (definido por mim) |
| slots de temperatura 11h / 17h / 22h | `TEMP_SLOTS`, enum `temp_slot` | missões pendentes do dia | está no enum do banco ✔ |
| Mapa nome MEEP → bar | `MEEP_BAR_MAP`, `app.importar.tsx` | vínculo do .xls bruto ao bar | **sim**, consta no SKILL.md ✔ |
| Padrões por bar (6/10/20 H e A) | migration `20260723120000` | reposição | **sim**, consta no SKILL.md ✔ |

**Risco principal:** `IDEAL_TEMP` está duplicado em dois arquivos. Se um dia
mudar em um e não no outro, a tela inicial e o detalhe do bar passam a discordar
sobre qual chopp está "no padrão".

**Sugestão:** mover esses limiares para uma tabela de parâmetros
(`configuracoes_operacao`) ou, no mínimo, para um único módulo compartilhado.
Não fiz agora por ser mudança de comportamento que precisa do aval do gestor
sobre os valores.

---

## ✅ O que está íntegro

- **`cheios` = plugado + fechado** — idêntico em todas as telas que calculam.
- **`warehouse_stock`** é mantido **exclusivamente** pelo trigger
  `trg_apply_warehouse_movement` a partir de `warehouse_movements`. Nenhuma tela
  escreve saldo direto (verificado: zero `update/insert/upsert` em
  `warehouse_stock` no código). O saldo é sempre derivado do fluxo.
  ⚠️ Ressalva: existe a policy `"Gestor manutencao update stock"` permitindo
  UPDATE direto no banco. Ninguém usa hoje, mas um ajuste manual via SQL
  dessincronizaria saldo e movimentos sem deixar rastro no fluxo.
- **`bar_stock_standard`** é a única origem dos padrões — nenhuma tela usa
  número fixo de padrão.
- **Comodato** é alimentado por triggers (`apply_empties_to_comodato`) e pela
  RPC de conciliação; há backfill histórico a partir de `empties_removed`.
  Há trigger de proteção contra saldo negativo em `warehouse_stock`.
- **Sem dados fictícios**: nenhuma ocorrência de mock, placeholder, dado
  semeado artificialmente ou valor de exemplo em tela.
- O seed de consumo (`20260724130000`) vem da consolidação real dos 18 `.xls`
  da MEEP, com CSV de referência versionado em `docs/`.

---

## Pendências desta auditoria

1. **Aplicar** `20260724150000_fix_move_type_invalido.sql` e depois conferir se
   há cargas/NFs que falharam e precisam ser relançadas.
2. **Confirmar com o gestor** os limiares da tabela amarela — principalmente a
   temperatura ideal (−1 °C) e os cortes de severidade.
3. **Confirmar** se existem pontos `camarote`/`stand`/`haras` em operação. Se
   sim, decidir se entram nas contagens de barris.
4. Considerar renomear `meep_vendas_bar` → `meep_abastecimento_bar` (não
   destrutivo via view de compatibilidade), para o nome parar de mentir.
