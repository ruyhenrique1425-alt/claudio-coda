---
name: dispel-operacao
description: >
  Base de conhecimento da operação de chopp da Dispel (app "Bar Ops Buddy" /
  Dispel Operação) — TanStack Start + Supabase. Use SEMPRE que for trabalhar
  neste app: controle de estoque/comodato de barris, bares, rotas de
  reabastecimento, inventários (plugado/fechado/vazio), reposição = vazios,
  BI de barris, relatórios de consumo, e o relatório de vendas da MEEP
  (maquininhas de cartão). Contém o modelo de negócio, o schema do banco, as
  convenções de build e as pendências. Acione ao editar qualquer coisa em
  src/routes/app.* ligada a barris, estoque, cargas, notas fiscais, rotas,
  padrões ou consumo.
---

# Dispel Operação — operação de chopp

App de operação para abastecimento de chopp em um evento (ex.: "MANGALARGA
MARCHADOR 2026"). Stack: **TanStack Start (file-based routing) + React 19 +
Supabase + shadcn/ui + Tailwind v4 + Vite + Bun**. Projeto conectado ao
**Lovable** (não reescrever histórico git; commits sincronizam de volta).

## Modelo de negócio (a lógica central)

Fluxo do barril (comodato Heineken):

```
Nota Fiscal / Carga  →  Estoque DISPEL  →  Bar  ou  Allstar  →  volta VAZIO pro estoque  →  devolve à Heineken
```

- **~17 bares próprios + parceiros.** Cada bar tem um **padrão** (nº de barris
  Heineken "H" e Amstel "A" que deve manter).
- **Dois estoques (armazéns):** `dispel` e `allstar`. **A Allstar é abastecida
  pela DISPEL** (transferência). Todo barril entra primeiro no estoque via NF
  (PDF/manual) ou carga.
- **Barril só entra no bar se sair do estoque** (há trigger `deduct_dispel_on_refill`
  que deduz do DISPEL na reposição).
- **Comodato:** todo barril **cheio** que entra deve voltar **vazio** para a
  Heineken. Às vezes chegam mais cheios do que saem vazios; **nunca se pode
  devolver mais vazios do que os cheios recebidos** (invariante). Tabela
  `controle_comodato_global` (cheios_recebidos_acumulados,
  vazios_devolvidos_acumulados, vazios_disponiveis) por marca.
- **Inventário** conta barris em 3 estados por marca: **plugado** (na torneira,
  fixo — quase nunca muda), **fechado** (cheio reserva), **vazio** (consumido).
  "Cheios" = plugado + fechado.
- **Reposição = vazios:** mantido no padrão, repor = quantidade de vazios
  retirados (repõe o que foi consumido). No app é só **sugestão** editável para
  agilizar a distribuição na correria; o operador ajusta.
- **Padrão pode mudar** quando o fluxo de vendas não é atendido.

## Rotas e padrões (confirmado pelo gestor)

5 rotas = 5 pontos de distribuição de pallets. Padrão por bar (H/A):

| Bar          | Rota   | H  | A  |
|--------------|--------|----|----|
| Fundo        | Rota 1 | 6  | 6  |
| Meio         | Rota 1 | 6  | 6  |
| Entrada      | Rota 2 | 10 | 10 |
| Nova         | Rota 2 | 6  | 6  |
| Vila 1       | Rota 3 | 20 | 20 |
| Choperia 1   | Rota 3 | 6  | 6  |
| Choperia 2   | Rota 3 | 6  | 6  |
| Vila 2 ma    | Rota 4 | 20 | 20 |
| Vila 2 me    | Rota 4 | 6  | 6  |
| Vila 3 ma    | Rota 4 | 10 | 10 |
| Vila 3 me    | Rota 4 | 6  | 6  |
| Núcleos      | Rota 5 | 10 | 10 |
| Churrascaria | Rota 5 | 6  | 6  |

Migration: `supabase/migrations/20260723120000_rotas_e_padroes.sql` (cria
`rotas`, `bars.rota_id`, grava padrões). Aditiva; nomes não encontrados são só
reportados (RAISE NOTICE). Confirmar nomes reais dos bares antes de aplicar.

## Relatório da MEEP (maquininhas de cartão)

MEEP = software das maquininhas. Esquema: cada bar tem um **cartão fixo**; o
barril reposto é "vendido" a R$ 0,01 pro cartão do bar e cada unidade é bipada
como venda ao ser entregue. O relatório de vendas = consumo do bar.

Formato do export (por **produto**), colunas:
`Categoria | Produto | Quantidade | Unidade | Cashless | Débito | Crédito |
Dinheiro | Voucher | Divisão | Outros | Desconto | Valor` + linha "Total Geral".
- **Quantidade** = nº de unidades vendidas (ou kg). Para chopp = nº de barris/copos.
- Chopp aparece como produto, ex.: `CHOPP HEINEKEN 400ML [BAR]`. Para consumo,
  **filtrar só produtos cujo nome contém "CHOPP"**.
- ⚠️ O PDF é **baseado em imagem** (a tabela é um print) → import automático exige
  CSV/XLSX da MEEP ou OCR. Preferir CSV/XLSX.
- ⚠️ O nome do bar / número do cartão **NÃO** está no PDF (cabeçalho traz só o
  nome do evento). A identidade do bar vem do **nome do arquivo** ou do
  **relatório de "barris levados por bar"**. O mapa **bar ↔ cartão** ainda
  precisa ser fornecido pelo gestor.
- Regra do gestor: **NÃO conectar consumo aos barris** — o consumo por bar é só
  para visualização (quanto cada bar vendeu por dia, só chopps).

## Schema Supabase (tabelas-chave)

- **Enums:** `chopp_brand` = heineken|amstel · `barrel_status` = plugado|fechado|vazio
  · `bar_type` = camarote|stand|haras|bar_venda|bar_parceiro ·
  `warehouse_move_type` = entrada|transferencia|abastecimento_bar|ajuste.
- `bars` (id, name, bar_type, apoio_responsavel, lat, lng, *_qtd, notes,
  **rota_id**). **Não tem coluna `code`** — casar bar por `name`.
- `bar_stock_standard` (bar_id, brand, **barris_padrao**) — o padrão. Unique(bar_id,brand).
- `inventories` + `inventory_items` (brand, status, quantidade).
- `refills` + `refill_items` (brand, quantidade); `empties_removed`
  (bar_id, brand, quantidade, refill_id) — **vazios = consumidos**.
- `warehouses` (code: dispel/allstar) + `warehouse_stock` (barrels) +
  `warehouse_movements` (direction, move_type, target_warehouse_id...).
- `heineken_cargas`, `notas_fiscais` (+ RPC `conciliar_nota_fiscal`; status
  pendente = `pendente_revisao`), `controle_comodato_global`,
  `movimentacoes_barris`, `bar_transfers`.
- `types.ts` é **gerado** pelo Lovable — não editar à mão. Para tabelas/colunas
  novas ainda não tipadas, usar `(supabase as any)` e ler de forma resiliente
  (try/catch), como em `app.bi.tsx` (rotas) e `app.central.tsx`.

## Estrutura do app (rotas principais)

- `app.index` — Dashboard (bares ordenados alfabeticamente, alertas de reposição).
- `app.bi` — **BI de barris**: contagem exata por marca/estado + estoques +
  sugestão de reposição por rota.
- `app.central` — **Central de Estoque** (fusão): abas Visão Geral (estoque,
  comodato, falta p/ padrão, vazios, NFs) + Estoque + Entradas(Cargas) + Notas +
  Importar, carregadas sob demanda (lazy). As telas `app.estoque/cargas/notas/
  importar` seguem existindo como rotas mas saíram do menu (viraram abas). Seus
  componentes são exportados (`EstoquePage`, `CargasHeinekenPage`, `NotasPage`,
  `ImportarPage`).
- `app.bars.$barId` — detalhe do bar (abas inventário/reposição/missões/equipe/
  consumo/config). Reposição sugere plugado fixo e reposição = vazios.
- `app.consumo` — ranking de consumo. `app.consumo-tempo` — **série temporal**
  de barris consumidos/dia por marca.
- `app.map`, `app.inventarios`, `app.manutencao*`, `app.relatorio`,
  `app.backups`, `app.governanca`, `app.perfil`, rotas públicas `r.*`.

## Convenções de build/dev

- **Instalar deps:** o `bun.lock` aponta pro registry privado da Lovable
  (bloqueado no sandbox). Instalar com registry público:
  `rm -f bun.lock && BUN_CONFIG_REGISTRY=https://registry.npmjs.org bun install`
  e **restaurar o `bun.lock` original antes de commitar** (não commitar o lock
  regenerado).
- **Typecheck:** `bunx tsc --noEmit` (deve ficar 100% limpo — manter assim).
- **Build:** `BUN_CONFIG_REGISTRY=https://registry.npmjs.org bun run build`
  (regenera `src/routeTree.gen.ts` — commitar junto ao adicionar rotas).
- **Formatação:** `bunx prettier --write <arquivos>` (config em `.prettierrc`,
  printWidth 100). Rodar antes de commitar.
- **Lint:** ~248 `@typescript-eslint/no-explicit-any` são rows do Supabase —
  refatoração grande e arriscada; fora de escopo por ora.
- **Libs pesadas** (xlsx, jspdf) devem ser **lazy** (`await import(...)`), só ao
  usar (ver `app.importar`/`app.relatorio`).
- **Migrations:** sempre **aditivas/idempotentes** (IF NOT EXISTS, ON CONFLICT),
  seguir RLS com `has_role(auth.uid(),'gestor'/'manutencao')`. Nunca destrutivo
  sem backup + OK explícito do gestor.
- Commits em PT, sem citar modelo/IA no repo. Branch de trabalho:
  `claude/melhorar-app-7oo3xl`.

## Papéis (RBAC)

`gestor`, `manutencao`, `admin`, `operador`, `equipe_bar`. Telas de estoque/BI/
consumo/central: gestor ou manutenção. `equipe_bar` só vê `/app/equipe-bar`.

## Pendências que dependem do gestor

1. **Relatório de "barris levados por bar"** (ainda não recebido) → para o mapa
   **bar ↔ cartão MEEP**.
2. **Export MEEP em CSV/XLSX** (não PDF-imagem) → para importação automática e
   confiável do consumo por bar.
3. **Confirmar nomes reais dos bares** no banco (para a migration de rotas casar).
4. **OK + backup** antes de qualquer passo destrutivo (zerar estoque / reiniciar
   contagem mantendo config, mudando só barris).
