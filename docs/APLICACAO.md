# Aplicação — ordem e verificação

Guia único das migrations criadas em 2026-07-24. **A ordem importa**: quatro
funções são redefinidas mais de uma vez, e a última a rodar é a que vale.

Aplicar de cima para baixo. Cada bloco tem como conferir se funcionou.

---

## 🔴 BLOCO 1 — Urgente: destrava a entrada de estoque

### `20260724150000_fix_move_type_invalido.sql`

As funções `apply_heineken_carga` e `conciliar_nota_fiscal` gravavam
`move_type = 'recebimento_heineken'`, valor que **não existe** no enum
`warehouse_move_type`. As duas falhavam. Como todo barril entra por carga ou
por NF, **a entrada de estoque estava inoperante** — o saldo só descia.

⚠️ A migration do Lovable `20260724045526` **ainda contém o valor quebrado**
(2 ocorrências). Ela roda antes desta, então a correção prevalece. Mas se o
Lovable gerar uma migration nova depois desta que redefina a função, o bug
volta — vale conferir depois de qualquer sincronização.

**Conferir:** registre uma carga de teste → deve aparecer em
`warehouse_movements` com `move_type='entrada'` e o saldo do DISPEL **subir**.

**Depois de aplicar:** conferir se há cargas/NFs do período que falharam e
precisam ser relançadas. A migration conserta a função, **não recria** os
movimentos perdidos.

---

## 🟠 BLOCO 2 — Identidade dos bares

Aplicar **nesta ordem** (a segunda soma os padrões da primeira).

### `20260724160000_nomes_oficiais_rotas_padroes.sql`
Nomes oficiais dos 13 pontos, rotas e padrões. Bar da Pista → Rota 2
(**padrão ainda não definido pelo gestor**, fica em aberto de propósito).
Zel Café → parceiro, sem rota.

**Conferir:** o log deve vir **sem** linhas `BAR NÃO ENCONTRADO`. Se aparecer
alguma, o nome no banco difere do oficial — ajustar antes de seguir.

### ⚠️ `20260724170000_fundir_choperia.sql` — ALTERA DADOS
Funde Choperia 1 + 2 em "Choperia" (um cartão MEEP só). Repontua 19 tabelas
filhas. **Faça o backup antes.** Padrão resultante: **12H/12A** (soma de 6+6) —
se o número certo for outro, edite antes de aplicar.

**Conferir:** existe uma linha "Choperia" em `bars`, nenhuma "Choperia 1/2", e
`bar_stock_standard` da Choperia mostra 12/12.

---

## 🟡 BLOCO 3 — Fluxo do barril vazio

Ordem obrigatória: a segunda substitui funções da primeira.

### `20260724190000_fluxo_barril_vazio.sql`
Cria `warehouse_empty_stock` e `empty_movements`. Recolher no bar passa a dar
**entrada de vazio no estoque**; a carga passa a dar **baixa**. Inclui backfill
do histórico de recolhimentos.

### `20260724210000_vasilhames_sem_marca.sql`
Vazio no DISPEL vira **vasilhame sem marca** (`warehouse_vasilhames`).
Substitui `apply_empty_movement` e `apply_carga_vasilhames` — esta última
deixa de fazer rateio proporcional por marca, que inventava informação.
Migra automaticamente o saldo que já estivesse separado por marca.

**Conferir:** `SELECT * FROM warehouse_vasilhames` traz a linha do DISPEL com
saldo > 0 (se houver recolhimentos no histórico). Registre um recolhimento e
veja o saldo subir; registre uma carga com `vasilhames_recolhidos` e veja
descer.

---

## 🟢 BLOCO 4 — Balanço e MEEP

### `20260724200000_balanco_barris.sql`
Cria `allstar_pontos_declaracao` e a primeira versão de `balanco_barris()`.

### `20260724220000_balanco_v2_vasilhames.sql`
Substitui `balanco_barris()` pela versão com vasilhames agrupados. Faz
`DROP FUNCTION` antes, porque a assinatura mudou.

⚠️ **Não pare no 200000.** Aplicado sozinho, o balanço lê os vazios do DISPEL
por marca — que depois do 210000 estão vazios. O número sai errado.

### `20260724230000_meep_e_abastecimento.sql`
View `meep_entregue_bar` com o nome correto, e `conferir_abastecimento_meep()`,
que cruza o que a maquininha bipou contra o que o app registrou em
`refill_items`.

### `20260724180000_view_meep_abastecimento.sql` e `20260724140000_refills_photo_url_opcional.sql`
Independentes, podem entrar em qualquer ponto. A 140000 é necessária para o
import em lote de abastecimento funcionar.

**Conferir o balanço:** Central de Estoque → aba **BALANÇO**. A linha
**TOTAL** é a que precisa fechar. As linhas por marca **não fecham em zero de
propósito** — ali o que importa é não haver número negativo.

---

## Ordem final consolidada

```
20260724140000  refills.photo_url opcional
20260724150000  🔴 fix move_type            ← sem isto, nada entra no estoque
20260724160000  nomes oficiais / rotas / padrões
20260724170000  ⚠️ fundir Choperia          ← backup antes
20260724180000  view meep_abastecimento
20260724190000  fluxo do barril vazio
20260724200000  balanço v1 + declaração Allstar
20260724210000  vasilhames sem marca
20260724220000  balanço v2                  ← não pare antes daqui
20260724230000  MEEP = abastecimento + conferência
```

Funções redefinidas na cadeia (a última vence, e está correta nesta ordem):
`apply_heineken_carga`, `apply_empty_movement`, `apply_carga_vasilhames`,
`balanco_barris`.

---

## Depois das migrations, no app

Estas correções são de **código**, não de banco — precisam do deploy:

- **Detalhe do bar**: o total de "barris consumidos" tinha `.limit(50)` e
  truncava em silêncio nos bares mais movimentados.
- **Relatório PDF**: somava pontos fora da operação, divergindo do app.
- **Rótulos da MEEP**: a tela dizia "consumo real" para um dado que é
  **abastecimento**. Agora lê "entregue".
- Consumo com filtro de período, "a recolher" descontando o que já saiu,
  severidade por contagem absoluta, alerta de chopp acima de +1 °C.

Rodar antes de subir: `bun install` → `bunx tsc --noEmit` →
`bunx prettier --write src` → `bun run build`.
O build regenera `routeTree.gen.ts`; editei à mão para registrar as rotas
`/app/operacao` e `/app/balanco` — **se a saída do build divergir, vale a do
build**.

---

## Fora desta fila

- 🔴 **Antes de qualquer Fase 5: gere um backup NOVO.** A lista de tabelas do
  backup estava incompleta até 2026-07-24 — não incluía `notas_fiscais` nem
  `controle_comodato_global`, que o reset apaga. Qualquer backup anterior à
  correção em `src/routes/api/public/backup.daily.ts` **não protege**.
  Detalhes em `docs/VARREDURA-FINAL.md`.
- **`docs/FASE5-RESET.sql`** — reset de estoque. Não é migration, não roda
  sozinho, tem trava. Só depois do backup NOVO conferido e das migrations acima.
- **Declaração da Allstar** — sem ela o balanço acusa quebra que não existe.
- **Padrão do Bar da Pista** — não informado.
- **Notas fiscais** — sem elas o "recebido" fica baixo e a quebra parece enorme.
