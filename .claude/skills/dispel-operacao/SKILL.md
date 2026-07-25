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

**Dois eventos distintos na MEEP (importante):**
- **Evento de vendas (real):** consumo dos clientes, cartões de consumo
  tradicionais. É o **consumo** de verdade — vem em relatório à parte.
- **Evento de estoque (à parte):** usa cartões próprios por bar (ex.: `ARQ_01`,
  `AMSTEL`) para registrar os barris **entregues/repostos** a cada bar. Alimenta
  a **reposição/abastecimento**, NÃO o consumo. É este que a tela
  `app.abastecimento-meep` e o import "Abastecimento MEEP" tratam; o vínculo
  bar↔cartão (`bars.cartao_meep`) é o desse evento de estoque.

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

## CONSUMO MEEP (evento de vendas) — .xls por bar

Relatório de **consumo real** (evento de vendas), 1 arquivo `.xls` por bar
(sheet "Consumos"). Legível com `xlrd`. Peculiaridades:
- **Nome do bar** vem numa célula do cabeçalho (col 1, ~linha 7) — terminologia
  MEEP, diferente do padrão.
- Tabela começa na linha do header "Produto" (~linha 14). **A quantidade está
  embutida no nome do produto**: `"21.00000x CHOPP AMSTEL 50L"` → 21 barris.
  Há **estornos** (linhas negativas). Chopp = produtos com "CHOPP"; marca por
  "HEINEKEN"/"AMSTEL". Data por transação em serial Excel (col "Data de
  Realização", base 1899-12-30).
- **Duplicação:** o mesmo bar é exportado em vários arquivos (o número no nome
  do arquivo é só sequência). **Deduplicar** (um arquivo por bar).

Mapa **nome MEEP → bar real** (confirmado pelo gestor):
`Villa 2 Bar 1`=Vila 2 maior · `Villa 2 Bar 2`=Vila 2 menor ·
`Villa 3 Bar 1`=Vila 3 maior · `Villa 3 Bar 2`=Vila 3 menor ·
`Arquibancada 1`=Nova(arq) · `Arquibancada 2`=Entrada(arq) ·
`Arquibancada 3`=Meio(arq) · `Arquibancada 4`=Fundo(arq) ·
`Vila 1/VILLA 1`=Vila 1 · `Alameda dos núcleos`=Núcleos ·
`Chopperia`=Choperia 1+2 (unir) · `Churrascaria`=Churrascaria ·
`Zel cafe` e `Bar da pista`=parceiros.

No app: tabela `meep_consumo_bar` (bar_nome/data/marca/barris, unique idempotente),
tela `app.consumo-bar` (Consumo por Bar real), import via Central → Importar
modo "Consumo MEEP" (CSV: bar,data,marca,barris). Migration
`20260724120000_meep_consumo.sql`. O parse dos `.xls` brutos (qty no nome,
dedup, nomes) é feito fora e importado como CSV limpo.

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

## Menu lateral (agrupado por intenção)

Definido em `NAV_SECTIONS` (`src/components/AppShell.tsx`). Telas que
compartilhavam a mesma informação viraram **abas** de um destino único; as
rotas antigas continuam existindo (links e URLs salvas seguem funcionando),
apenas saíram do menu.

| Grupo    | Itens                                                        |
|----------|--------------------------------------------------------------|
| Operação | Início · **Barris** · Inventários · Mapa · Manutenção · Equipe de Bar |
| Estoque  | Central de Estoque · Abastecimento MEEP                       |
| Análise  | **Consumo** · Relatório                                       |
| Sistema  | Backups · Governança · Meu perfil                             |

Consolidações (padrão de abas lazy, o mesmo já usado em `app.central`):
- **Barris** (`app.operacao`) = aba *Cobertura & Rotas* + aba *Contagem (BI)*.
  As duas telas repetiam a tabela de reposição por rota. `app.bi` exporta
  `BIPage` e vira aba; `/app/bi` continua acessível.
- **Consumo** (`app.consumo`) = aba *Ranking* (a tela que já existia) + aba
  *Por bar (real)* (`app.consumo-bar`) + aba *Ao longo do tempo*
  (`app.consumo-tempo`). Ambas exportam seus componentes.
- **Central de Estoque** (`app.central`) — consolidação que já existia:
  Visão Geral + Estoque + Entradas + Notas + Importar.

De 16 itens soltos para 13 em 4 grupos. `Abastecimento MEEP` ficou em
**Estoque** (e não em Análise) de propósito: é barril *entregue*, não consumo —
a distinção que o gestor pediu para não misturar.

## Estrutura do app (rotas principais)

- `app.index` — **Dashboard / CENTRAL DE OPERAÇÃO** (tela inicial). Resumo
  executivo, alertas de reposição, missões pendentes e:
  - **BARRIS CONSUMIDOS** com filtro de período (Hoje/7 dias/Tudo) e seletor de
    fonte: **vazios recolhidos** (`empties_removed`, fluxo operacional) ou
    **MEEP** (`meep_consumo_bar`, venda real). ⚠️ Usa tabelas de FLUXO, não o
    `vazio` do inventário — este é uma *foto* e somar vários dias duplicaria.
    O teto antigo (`Math.min(vazios, padrão)`) foi removido: subestimava o
    consumo de quem passava do padrão.
  - **TOP BARES POR CONSUMO** (ranking geral com barra proporcional).
  - **BARRIS NOS BARES POR ESTADO** — plugado/fechado/vazio × marca (foto do
    último inventário).
  - **ESTOQUE NOS ARMAZÉNS** — DISPEL e Allstar por marca.
  - **CHOPPS MAIS GELADOS** — top 5 por menor temperatura do dia
    (`bar_temperature_checks`, slots 11h/17h/22h; meta ≤ -1 °C).
- `app.operacao` — **Cobertura e Rotas** (planejamento, refetch 60s):
  KPIs de decisão (carregar agora, vazios a recolher, estoque, **cobertura em
  dias**), painel de alertas por severidade (ruptura de estoque vs. reposição,
  invariante do comodato, bares zerados/sem inventário/sem padrão), **pallet por
  rota** ordenado pela rota que mais precisa de barril, ranking "quem está para
  secar" (% do padrão atendido, pior primeiro) e ritmo de consumo diário.
  ⚠️ Respeita a regra do gestor: **consumo não entra no cálculo de reposição** —
  reposição vem do inventário (padrão − cheios); consumo só alimenta ritmo e
  cobertura, sempre rotulados como estimativa.
  (Nome escolhido para não colidir com o dashboard, que já se chamava "Central
  de Operação".)
- `app.bi` — **BI de barris**: contagem exata por marca/estado + estoques +
  sugestão de reposição por rota.
- `app.central` — **Central de Estoque** (fusão): **4 abas** — Visão Geral
  (estoque, comodato, falta p/ padrão, vazios, NFs) + Estoque + **Entradas** +
  Balanço. Carregadas sob demanda (lazy).
  ⚠️ **Entradas unifica os 3 caminhos de dar entrada de barril** (antes eram 3
  abas separadas — Entradas/Notas/Importar — que confundiam por servir ao mesmo
  fim). Agora são **sub-abas** dentro de Entradas:
  - **Manual / Carga** (`CargasHeinekenPage`) — entrada rápida com foto.
  - **Nota Fiscal** (`NotasPage`) — cadastra NF (PDF/foto) e concilia.
  - **Importar CSV** (`ImportarPage`) — entrada em massa por planilha.
  As rotas `app.estoque/cargas/notas/importar` seguem existindo (links antigos
  funcionam); os componentes são exportados (`EstoquePage`, `CargasHeinekenPage`,
  `NotasPage`, `ImportarPage`).
- `app.bars.$barId` — detalhe do bar (abas inventário/reposição/missões/equipe/
  consumo/config). Reposição sugere plugado fixo e reposição = vazios.
- `app.consumo` — ranking de consumo. `app.consumo-tempo` — **série temporal**
  de barris consumidos/dia por marca.
- `app.abastecimento-meep` — **Abastecimento por bar (chopps)** = barris
  ENTREGUES a cada bar via evento de estoque da MEEP (tabela `meep_vendas_bar`),
  com painel "Vincular cartões aos bares" (edita `bars.cartao_meep`). Import via
  Central → Importar, modo "Abastecimento MEEP" (resolve bar por `cartao_meep`
  ou nome, filtra só "CHOPP", upsert idempotente em (cartao,data,produto)).
  Migration `20260723130000_meep_vendas.sql`. **Não é consumo** — consumo real
  vem do evento de vendas (à parte), ainda pendente.
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

## Entrega / execução

- Passo a passo para colocar em produção: **`LOVABLE_STEPS.md`** (raiz) — aplicar
  migrations, conferir nomes, vincular cartões, importar, verificar cada tela.
- Consumo de cada bar **até hoje** já vem via seed
  `20260724130000_seed_consumo_meep.sql` (gerado da consolidação dos 18 `.xls`).
  CSV de referência em `docs/consumo-meep-consolidado.csv` (bar,data,marca,barris).

## Pendências que dependem do gestor

1. **Confirmar nomes reais dos bares** no banco (`bars.name`). A migration
   `20260723120000_rotas_e_padroes.sql` foi ajustada para tentar **duas
   variantes de nome** por bar (ex.: 'Fundo' e 'Fundo (arquibancada)'), pois
   foi encontrada inconsistência entre ela e `20260724130000_seed_consumo_meep.sql`
   (esta usa nomes vindos dos relatórios reais da MEEP: "Fundo (arquibancada)",
   "Choperia (1+2)", "Vila 2 maior/menor" etc.). Isso reduz o risco de falha,
   mas **ainda precisa confirmação**: se `bars.name` usa uma terceira variação,
   ou se "Choperia" é 1 ponto físico só (não 2), ajustar o mapeamento na
   migration. Rodar o `SELECT` do Passo 2 do `LOVABLE_STEPS.md` para conferir.
2. **Vínculo cartão→bar** do evento de estoque — painel "Vincular cartões" em
   `app.abastecimento-meep` já funciona corretamente (confirmado no código);
   falta só o gestor preencher os cartões de fato.
3. **Zel Café / Bar da Pista** (parceiros): entram em rota/padrão? (decisão de
   negócio, não implementada ainda)
4. **OK + backup** antes de qualquer passo destrutivo (Fase 5: zerar estoque /
   reiniciar contagem mantendo config, mudando só barris).
5. ~~App ler o `.xls` bruto da MEEP direto~~ **Feito.** Novo modo "Consumo MEEP
   (.xls bruto por bar)" em `app.importar` lê o arquivo cru da MEEP direto
   (extrai qtd embutida no nome do produto, filtra CHOPP, detecta marca, data
   serial do Excel, soma estornos), sem precisar do CSV limpo intermediário.
   O usuário só seleciona o bar (dropdown com o mapa MEEP→bar já preenchido).

## Bugs corrigidos em `app.importar.tsx` (auditoria contra o schema real)

Achados comparando o código com as migrations (não suposição — `bars` não tem
coluna `code`, confirmado em `20260717202752_...sql`):
- Modos **"Padrões de estoque"**, **"Cadastro de bares"** e **"Abastecimento em
  lote"** buscavam `bars.code` (coluna inexistente) → falhavam sempre. Agora
  casam por `bars.name`.
- Modo **"Cadastro de bares"** também gravava em colunas erradas (`code`,
  `type`, `lat`, `lng` em vez de `bar_type`, `latitude`, `longitude`) e fazia
  upsert por `code`, que nunca existiu. Reescrito para buscar por nome
  (case-insensitive) e inserir/atualizar com as colunas reais.
- Modo **"Entradas/saídas de estoque"**: usava `move_type = "recebimento_heineken"`,
  valor que não existe no enum `warehouse_move_type` (só `entrada|transferencia|
  abastecimento_bar|ajuste`) → toda entrada falhava. Corrigido para `"entrada"`.
- Modo **"Abastecimento MEEP"**: buscava `id,name` mas o código lia
  `cartao_meep` de cada bar (nunca vinha na query) → vínculo por cartão nunca
  resolvia o bar. Corrigido para selecionar `cartao_meep` também.
- `refills.photo_url` era `NOT NULL` sem default, o que quebrava qualquer
  importação em lote de abastecimento (o CSV não tem foto). Nova migration
  `20260724140000_refills_photo_url_opcional.sql` relaxa essa constraint
  (aditivo, não destrutivo — reposições feitas pelo app continuam com foto no
  fluxo normal).

## Notas Fiscais (entradas de estoque) — consolidadas no repo

As 17 NFs da Heineken (Mangalarga) foram lidas e separadas em
`docs/csv-notas-fiscais/` (guia: `GUIA-IMPORTACAO-NFS.md`):
- `import-estoque-nfs.csv` — chopp líquido ("Draft Beer 50L", CFOP 5403) no
  formato do modo **"Estoque"** do importador (warehouse_code,brand,quantidade,
  direction,observacoes). É o que **sobe o saldo do DISPEL**.
- `comodato-vasilhames.csv` — cascos (CFOP 5908), referência da conta de comodato.
- `conferencia-nfs-completa.csv` — auditoria item a item de todas as NFs.
⚠️ Importar só **depois** do fix `20260724150000_fix_move_type_invalido.sql`
(senão a entrada falha no enum). Passo 4b do `LOVABLE_STEPS.md`. PDFs originais
em `docs/` não versionados — vêm no pacote de entrega.

## Consolidação de consumo 25/07 + nomes REAIS (do backup de produção)

Backup de produção deu os `bars.name` reais. Mapa MEEP (cabeçalho .xls) → real,
usado em `MEEP_BAR_MAP` de `app.importar.tsx`:
`Villa 2 Bar 1`→Villa 2 autoatendimento · `Villa 2 Bar 2`→Villa 2 menor ·
`Villa 3 Bar 1`→Vila 3 maior · `Villa 3 Bar 2`→Villa 3 menor ·
`Arquibancada 1/2/3/4`→Nova/Entrada/Meio/Fundo arquibancada ·
`Vila 1/Villa 1`→Villa 1 autoatendimento · `Alameda dos núcleos`→Nucleos ·
`Chopperia`+`Choperia`→Chopperia (1+2) [SÃO 2 arquivos/andares, SOMAR não dedup] ·
`Churrascaria`→Churrascaria liberdade · `Zel cafe`→Zelda café (1 parceiro só) ·
`Bar da pista`→Pista de areia. (`Hippos bar`, `Pista tambor` = pontos extra.)

Correções do gestor: Zel cafe é 1 bar parceiro; **nós** abastecemos os parceiros
(não a Allstar); **nem todo vazio é registrado** (aparecem só no estoque) — por
isso consumo confiável vem da MEEP, não de empties_removed.

Import melhorado (`app.importar` modo "Consumo MEEP (.xls bruto)"): aceita
**vários .xls de uma vez**, detecta o bar pelo cabeçalho, e **soma por
bar/dia/marca antes do upsert** (dois arquivos p/ o mesmo bar somam; relatório
cumulativo reimportado não duplica). CSV de referência: `docs/consumo-25-07-consolidado.csv`.
