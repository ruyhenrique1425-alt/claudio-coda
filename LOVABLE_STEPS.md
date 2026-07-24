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
1. `20260723120000_rotas_e_padroes.sql` — cria `rotas` (5), `bars.rota_id` e grava os **padrões** por bar.
2. `20260723130000_meep_vendas.sql` — `bars.cartao_meep` + `meep_vendas_bar` (abastecimento).
3. `20260724120000_meep_consumo.sql` — `meep_consumo_bar` (consumo real).
4. `20260724130000_seed_consumo_meep.sql` — **seed do consumo de cada bar até hoje**.
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
- [ ] **DASHBOARD** — bares em ordem alfabética, alertas de reposição.
- [ ] **BI BARRIS** — contagem por marca/estado, estoques DISPEL/Allstar, e
      "por rota" com **Carregar** (p/ padrão) e **Vazios**.
- [ ] **CENTRAL DE ESTOQUE** — abas Visão Geral (estoque + comodato), Estoque,
      Entradas, Notas, Importar. Comodato: recebidos ≥ devolvidos.
- [ ] **MAPA** — busca filtra lista e marcadores.
- [ ] **CONSUMO POR BAR** — consumo real (seed) por bar e por dia.
- [ ] **ABASTECIMENTO MEEP** — barris entregues por bar (após importar).
- [ ] **CONSUMO × TEMPO** — série diária (vazios recolhidos).
- [ ] Abrir um bar → **Reposição** sugere plugado fixo e reposição = vazios.
- [ ] **RELATÓRIO** gera PDF; **IMPORTAR** lê CSV/xlsx.

## Passo 6 — Ajustes finos (opcional, um de cada vez)
- Definir se **Zel Café** e **Bar da Pista** (parceiros) entram em alguma rota/padrão.
- Cruzar **consumo × padrão** para sugerir ajuste de padrão por bar.

## Passo 7 — ⚠️ Reset + reabastecer (Fase 5, só com backup + OK do gestor)
Não executar sem: (a) **backup** feito na tela BACKUPS; (b) OK explícito.
Sequência pretendida: backup → zerar estoques → reiniciar contagem mantendo
config/padrão (mudando só barris) → recarregar pela MEEP.

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
