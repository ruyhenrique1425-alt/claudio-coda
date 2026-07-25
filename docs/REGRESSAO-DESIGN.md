# Verificação do redesign — o que mudou e o que foi restaurado

O pacote de design alterou **2 telas** e criou **2 arquivos**, sem tocar em
mais nada. Escopo pequeno e controlado.

## Alterado
- `src/routes/app.index.tsx` — dashboard redesenhado
- `src/routes/app.consumo.tsx` — ajustes visuais

## Criado
- `src/lib/bars-dashboard.tsx` — a lógica do dashboard foi **extraída** para um
  hook compartilhado (`useBarsRows`). Boa mudança: `app.index` e o novo
  `app.bares` agora usam a mesma fonte.
- `src/routes/app.bares.tsx` — tela "todos os bares", alcançável pelos links do
  dashboard, registrada no routeTree, protegida pelo AppShell.

## Regressões encontradas e corrigidas

Ao extrair a lógica para `bars-dashboard.tsx`, três correções antigas se
perderam **só no dashboard** (as outras telas mantiveram). Restauradas:

1. **Teto no padrão** (`Math.min(vazios, padrão)`) tinha voltado — subestimava
   o consumo de quem passou do padrão. Removido.
2. **Desconto de vazios já recolhidos** sumira — o dashboard voltaria a pedir
   para recolher barril que já saiu. Restaurado (busca `empties_removed` e
   aplica `vaziosARecolher`).
3. **Rótulos da MEEP** ainda diziam "consumo"/"Bipados MEEP". Corrigidos para
   "entregue", coerente com a descoberta de que a MEEP é abastecimento.

Como a correção foi no hook compartilhado, `app.bares` (a tela nova) já nasce
com o comportamento certo.

## Verificado sem problema
- Migrations 190000–230000 foram **consolidadas pelo Lovable** em
  `20260724160540`, com as versões FINAIS das funções (pool, não rateio; balanço
  v2). Ordem interna correta.
- Backup com 38 tabelas e Fase 5 zerando vasilhames — presentes.
- 16 arquivos sem erro de sintaxe.
- Nenhuma outra tela alterada; nenhuma migration perdida.
