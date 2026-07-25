# Handoff — Dispel Operação (para o Claude da Micaela)

Objetivo: **absorver todo o contexto e deixar o app 100% funcional** na operação.
Leia nesta ordem e execute com cuidado. Nada é destrutivo, exceto o marcado ⚠️.

## 1. Leia primeiro (contexto completo)
- **`.claude/skills/dispel-operacao/SKILL.md`** — base de conhecimento: modelo de
  negócio, fluxo do barril/comodato, schema Supabase, MEEP (consumo × abastecimento),
  nomes reais dos bares, convenções de build e decisões do gestor. **Leia inteiro.**
- **`LOVABLE_STEPS.md`** — passo a passo verificável para colocar em produção.
- **`docs/AUDITORIA-DADOS.md`**, **`docs/VARREDURA-FINAL.md`** — auditorias já feitas
  (bugs achados e corrigidos: `move_type`, cobertura de backup, Fase 5).

## 2. Ambiente / build
- `bun install` (se falhar por registry: `BUN_CONFIG_REGISTRY=https://registry.npmjs.org bun install`).
- `bunx tsc --noEmit` deve dar **0 erros**; `bun run build` deve concluir. Mantenha assim.
- `src/integrations/supabase/types.ts` é **gerado** — não editar à mão. Tabelas novas
  ainda não tipadas: usar `(supabase as any)` com leitura resiliente.

## 3. Migrations (aplicar na ordem do nome). NF e consumo já vêm VIA CÓDIGO (seeds):
1. `20260723120000` rotas + padrões · `20260723130000` meep_vendas (abastecimento).
2. `20260724120000` meep_consumo · `20260724130000` seed consumo (24/07).
3. `20260724140000` refills.photo_url opcional.
4. ⚠️ `20260724150000` **fix_move_type_invalido — CRÍTICO** (sem ele, entrada de estoque falha).
5. `20260724160000` nomes oficiais rotas/padrões · `20260724170000` funde Choperia · `20260724180000` view abastecimento.
6. `20260725110000` **fix nome "Zel café"** (corrige "Zelda café" da tradução do site).
7. `20260725120000` **seed consumo 25/07** (15 bares, nomes reais, Chopperia 1+2 somada).
8. `20260725130000` **seed NF entradas** (chopp no DISPEL; idempotente; sobe o saldo).
- **Verificar:** `SELECT count(*) FROM meep_consumo_bar` > 0; saldo do DISPEL > 0 após seed NF.

## 4. Alimentação contínua (quando o gestor subir arquivos novos)
- **Consumo (MEEP .xls):** Central → Importar → **"Consumo MEEP (.xls bruto)"** → selecionar
  **vários arquivos de uma vez**. Detecta o bar pelo cabeçalho, exclui não-chopp, e **soma
  por bar/dia/marca** (cumulativo reimportado **não duplica**).
- **Notas Fiscais:** hoje PDF → CSV (modo "Estoque"). **Meta:** importar o **XML da NF-e**
  direto (pedir XMLs ao fornecedor) para automatizar 100%.

## 5. Decisões do gestor (confirmadas)
- Padrões/rotas e nomes reais: ver SKILL.md. `Zel café` = 1 bar parceiro.
- **Nós abastecemos os parceiros e os bares próprios.** A **Allstar** manda para
  haras/camarotes/stands — mas **não controlamos o abastecimento interno deles**, só
  **quanto mandamos** (para controle). ➡️ *A fazer:* rastrear a saída (quanto sai da
  Allstar p/ esses pontos) sem dar padrão/rota a cada camarote.
- **Nem todo vazio é registrado** (aparecem só no estoque) → consumo confiável vem da MEEP.

## 6. Pendências abertas (decisão/dado do gestor)
- Modelar a saída Allstar → haras/camarotes/stands (item 5).
- ⚠️ **Fase 5** (reset): `docs/FASE5-RESET.sql` (fora de migrations de propósito) — só com
  backup conferido + as migrations 150000/160000 aplicadas. O gestor já autorizou a ordem.
- Bares que ainda não vieram em algum lote de consumo: só subir os .xls; o app soma sozinho.
