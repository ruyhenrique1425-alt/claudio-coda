# Guia de execução (Lovable) — Dispel Operação

> Objetivo: colocar o app rodando na operação **sem falhas**. Execute **na ordem**,
> um passo por vez, e **só avance quando o "Como verificar" do passo estiver OK**.
> Se algo falhar, corrija esse passo antes de seguir. Nada aqui é destrutivo,
> exceto o que estiver marcado com ⚠️ (não execute sem confirmação do gestor).

Stack: TanStack Start + React 19 + Supabase + shadcn/ui + Tailwind v4 + Bun.
Contexto de negócio completo em `.claude/skills/dispel-operacao/SKILL.md`.

---

## Passo 0 — Build limpo
1. `bun install`
2. `bunx tsc --noEmit` → **0 erros**
3. `bun run build` → conclui sem erro
- **Como verificar:** os três comandos terminam sem erro. Se `bun install` falhar
  por registry, use `BUN_CONFIG_REGISTRY=https://registry.npmjs.org bun install`.

## Passo 1 — Migrations do banco (na ordem)
Aplique as migrations em `supabase/migrations/` (o Supabase aplica por ordem de
nome). As novas desta entrega:
1. `20260723120000_rotas_e_padroes.sql` — cria `rotas` (5), `bars.rota_id` e grava os **padrões** por bar (agora tenta 2 variantes de nome por bar — ver Passo 2).
2. `20260723130000_meep_vendas.sql` — `bars.cartao_meep` + `meep_vendas_bar` (abastecimento).
3. `20260724120000_meep_consumo.sql` — `meep_consumo_bar` (consumo real).
4. `20260724130000_seed_consumo_meep.sql` — **seed do consumo de cada bar até hoje**.
5. `20260724140000_refills_photo_url_opcional.sql` — torna `refills.photo_url` opcional (necessário para o import em lote de abastecimento funcionar).
6. ⚠️ **`20260724150000_fix_move_type_invalido.sql` — CORREÇÃO CRÍTICA.** As funções
   `apply_heineken_carga` e `conciliar_nota_fiscal` gravavam um `move_type` que não
   existe no enum, então **toda entrada de estoque (carga e NF) falhava**. Detalhes
   em `docs/AUDITORIA-DADOS.md`.
   - **Como verificar:** registre uma carga de teste e confira que aparece em
     `warehouse_movements` com `move_type='entrada'` e que o saldo do DISPEL sobe.
   - **Depois de aplicar:** confira se há cargas/NFs do período que falharam e
     precisam ser relançadas — a migration conserta a função, não recria os
     movimentos perdidos.
7. `20260724160000_nomes_oficiais_rotas_padroes.sql` — nomes OFICIAIS dos 13 pontos,
   rotas e padrões. Substitui o mapeamento por "variantes" que era chute.
   Bar da Pista → Rota 2 (⚠️ **padrão ainda não definido pelo gestor**).
   Zel Café → parceiro, sem rota.
8. ⚠️ `20260724170000_fundir_choperia.sql` — **ALTERA DADOS, rode o BACKUP antes.**
   Funde Choperia 1 + 2 em "Choperia" (um cartão MEEP só). Padrão somado: 12H/12A.
9. `20260724180000_view_meep_abastecimento.sql` — view com nome correto para
   `meep_vendas_bar` (que guarda abastecimento, não venda). Não destrutivo.
- **Como verificar:** as tabelas `rotas`, `meep_vendas_bar`, `meep_consumo_bar`
  existem; `bars` tem `rota_id` e `cartao_meep`; `SELECT count(*) FROM meep_consumo_bar` > 0.

## Passo 2 — ⚠️ Conferir nomes dos bares (padrões/rotas)
As migrations casam bar por **nome exato** (`bars.name`). Se algum nome real
diferir do usado no mapeamento, o padrão/rota daquele bar não é aplicado (é só
reportado, nada quebra).
1. Rode o bloco de mapeamento de `20260723120000_rotas_e_padroes.sql` e veja os
   `RAISE NOTICE 'BAR NÃO ENCONTRADO...'`.
2. Para cada não encontrado, ajuste a coluna `nome_no_app` do mapeamento para o
   `bars.name` real e rode de novo (é idempotente).
- **Como verificar:** `SELECT b.name, r.nome, s.brand, s.barris_padrao FROM bars b
  LEFT JOIN rotas r ON r.id=b.rota_id LEFT JOIN bar_stock_standard s ON s.bar_id=b.id`
  mostra os 13 bares do padrão com rota e barris certos.

## Passo 3 — Vincular cartões MEEP aos bares (abastecimento)
1. No app, abra **ABASTECIMENTO MEEP** → painel **"Vincular cartões aos bares"**.
2. Preencha o cartão de estoque de cada bar (ex.: `ARQ_01`) e **Salvar vínculos**.
- **Como verificar:** ao importar um abastecimento, o bar aparece pelo **nome**
  (não pelo código do cartão).

## Passo 4 — Importar consumo (se quiser além do seed)
O consumo até hoje já vem no seed (Passo 1.4). Para novos relatórios:
1. **Central → Importar → "Consumo MEEP"** → suba o CSV `bar,data,marca,barris`
   (modelo em `docs/consumo-meep-consolidado.csv`).
- **Como verificar:** **CONSUMO POR BAR** mostra os bares com Heineken/Amstel/Total
  e a aba "por dia".

## Passo 5 — Verificação funcional de cada tela (checklist)
Abra e confirme que cada uma carrega **sem erro** e mostra dados coerentes:
- [ ] **DASHBOARD (tela inicial)** — resumo executivo, alertas de reposição e:
      **Barris consumidos** (troque período Hoje/7d/Tudo e a fonte Vazios/MEEP —
      os números devem mudar), **Top bares por consumo**, **Barris por estado**
      (plugado/fechado/vazio × marca), **Estoque DISPEL e Allstar**, e
      **Chopps mais gelados**.
- [ ] **MENU** — 4 grupos (Operação · Estoque · Análise · Sistema). Confira que
      cada item abre e que o item ativo fica destacado.
- [ ] **BARRIS** — abas *Cobertura & Rotas* e *Contagem (BI)*. KPIs (carregar agora, vazios, estoque, cobertura),
      alertas, pallet por rota, "quem está para secar" e ritmo de consumo.
      Confira que "Carregar agora" bate com a soma do BI e que os alertas fazem
      sentido (ex.: bares sem inventário aparecem como Atenção, não somem).
- [ ] **CENTRAL DE ESTOQUE** — abas Visão Geral (estoque + comodato), Estoque,
      Entradas, Notas, Importar. Comodato: recebidos ≥ devolvidos.
- [ ] **MAPA** — busca filtra lista e marcadores.
- [ ] **CONSUMO** — 3 abas: *Ranking*, *Por bar (real)* (consumo do seed por bar
      e por dia) e *Ao longo do tempo*. As abas carregam sob demanda.
- [ ] **ABASTECIMENTO MEEP** — barris entregues por bar (após importar).
- [ ] Abrir um bar → **Reposição** sugere plugado fixo e reposição = vazios.
- [ ] **RELATÓRIO** gera PDF; **IMPORTAR** lê CSV/xlsx.

## Passo 6 — Ajustes finos (opcional, um de cada vez)
- Definir se **Zel Café** e **Bar da Pista** (parceiros) entram em alguma rota/padrão.
- Cruzar **consumo × padrão** para sugerir ajuste de padrão por bar.

## Passo 7 — ⚠️ Reset + reabastecer (Fase 5)
Gestor autorizou (2026-07-24), **na ordem**: backup primeiro, reset depois.
Script: **`docs/FASE5-RESET.sql`** — fica fora de `migrations/` de propósito,
para não rodar sozinho. Tem trava: aborta se a variável de autorização não for
definida na mesma execução.
1. Backup na tela BACKUPS → **baixar e abrir** para conferir que não está vazio.
2. Aplicar antes as migrations 20260724150000 e 20260724160000.
3. Rodar `docs/FASE5-RESET.sql` conforme as instruções no topo do arquivo.
4. Lançar as entradas reais e conferir que **o saldo do DISPEL SOBE**
   (se não subir, a correção do `move_type` não foi aplicada).
5. Primeiro inventário de cada bar.

---

## Regras para o Lovable ao continuar o desenvolvimento
- **Não quebrar o que já funciona.** Mudanças aditivas; migrations idempotentes
  (`IF NOT EXISTS`, `ON CONFLICT`) e com RLS `has_role(auth.uid(),'gestor'/'manutencao')`.
- `src/integrations/supabase/types.ts` é **gerado** — não editar à mão; para
  tabelas novas ainda não tipadas use `(supabase as any)` com leitura resiliente.
- Rodar `bunx tsc --noEmit` e `bun run build` após cada passo. Formatar com
  `bunx prettier --write`.
- Libs pesadas (xlsx, jspdf) via `await import(...)` (lazy).
- Consulte `.claude/skills/dispel-operacao/SKILL.md` antes de mexer em barris,
  estoque, rotas, padrões, consumo ou MEEP.
