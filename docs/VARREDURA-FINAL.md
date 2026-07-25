# Varredura final — 2026-07-24

Última passagem, procurando o que **ainda não** tinha sido verificado nas
auditorias anteriores. Foco: efeitos colaterais das mudanças tardias sobre
partes antigas do sistema.

Dois achados, ambos no mesmo lugar — a rede de segurança.

---

## 🔴 ACHADO 1 — O backup não protegia o que o reset destrói

A lista de tabelas do backup (`src/routes/api/public/backup.daily.ts`) é
**fixa no código**. Cobria 24 tabelas; o banco tem ~41.

Cruzando o que o backup salvava com o que a Fase 5 apaga, **cinco tabelas
seriam destruídas sem cópia**:

| Tabela | O que se perderia |
|---|---|
| `notas_fiscais` | as notas de entrada |
| `controle_comodato_global` | **a conta inteira com a Heineken** |
| `movimentacoes_barris` | auditoria espelho |
| `meep_consumo_bar` | o abastecimento importado da MEEP |
| `meep_vendas_bar` | idem |

Havia ainda `rotas` fora do backup — a configuração de rotas dos bares.

O agravante: o gestor autorizou a Fase 5 **na condição de fazer backup antes**.
A condição estava sendo cumprida, mas a proteção tinha buraco exatamente onde a
faca corta.

**Corrigido:** a lista passou de 24 para **38 tabelas**, agrupadas por assunto
e com um aviso no topo de que tabela nova precisa ser acrescentada ali.

**Verificação automática:** cruzando de novo, "destruídas sem backup" = **0**.

⚠️ **Se você já gerou algum backup**, ele foi feito com a lista antiga e **não
protege** o reset. Gere um novo depois de subir esta correção.

---

## 🔴 ACHADO 2 — O reset deixaria saldo órfão

O `docs/FASE5-RESET.sql` foi escrito **antes** das tabelas do fluxo de vazios
existirem. Como a lista dele também é explícita, ele não zerava:

- `empty_movements`
- `warehouse_vasilhames`
- `warehouse_empty_stock`
- `allstar_pontos_declaracao`

Efeito prático: o reset apagaria `empties_removed` (a origem dos vazios), mas o
**saldo de vasilhames continuaria lá**, vindo de recolhimentos que deixaram de
existir. O balanço nasceria quebrado e não fecharia mais — exatamente a "ponta
solta" que não pode acontecer.

**Corrigido:** o script zera as quatro, e a conferência final agora **aborta a
transação** se os vasilhames não zerarem, junto com a checagem que já existia
para o estoque.

---

## ✅ Verificado e sem problema

- **RLS** nas 4 tabelas novas: todas com `ENABLE ROW LEVEL SECURITY` e política.
- **Rotas fora do menu** (`/app/bi`, `/app/balanco`, `/app/estoque`, etc.):
  todas alcançáveis como aba. Nenhuma órfã.
- **Contrato função ↔ tela**: as 15 colunas de `balanco_barris()` batem com o
  tipo esperado em `app.balanco.tsx`.
- **Ordem das migrations**: as 4 funções redefinidas terminam na versão certa.
- **Leituras não tipadas** (`supabase as any`): 24 usos, todos com `try/catch`
  ou checagem de `res.error`.
- **Sintaxe**: 15 arquivos, zero erros.

---

## 🟡 Apenas registrado (não mexi)

**`test_dispel`** — tabela de teste criada pela migration
`20260724032459`, com duas colunas e nenhum uso em todo o código. É entulho
inofensivo. Não removi porque apagar tabela é destrutivo e a decisão é sua;
se quiser, sai com um `DROP TABLE public.test_dispel;`.

**`types.ts` desatualizado** — as tabelas que criei
(`warehouse_vasilhames`, `empty_movements`, `allstar_pontos_declaracao`,
`warehouse_empty_stock`) ainda não estão tipadas. É esperado: o arquivo é
gerado pelo Lovable. Por isso o app as lê via `(supabase as any)` com
`try/catch` — funciona antes e depois da regeneração.

---

## Ordem revisada para a Fase 5

1. Subir o código com o backup corrigido (38 tabelas).
2. **Gerar backup novo** — o anterior não serve.
3. Baixar e abrir o ZIP: conferir que `notas_fiscais` e
   `controle_comodato_global` estão dentro.
4. Aplicar todas as migrations de `docs/APLICACAO.md`.
5. Só então rodar `docs/FASE5-RESET.sql`.
