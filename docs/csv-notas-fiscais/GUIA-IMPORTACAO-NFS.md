# Importação das 17 Notas Fiscais — Mangalarga

As 17 NFs foram lidas e separadas. Nada foi perdido: cada item de cada nota
está em um dos três arquivos abaixo.

## Arquivos gerados

| Arquivo | Para quê | Como usar |
|---|---|---|
| **`import-estoque-nfs.csv`** | **Importar no app** | Central de Estoque → Importar → modo **"Estoque"** |
| `conferencia-nfs-completa.csv` | Auditoria (todos os itens de todas as NFs) | conferência, não precisa importar |
| `comodato-vasilhames.csv` | Os cascos em comodato | referência para a conta com a Heineken |

---

## O que cada NF continha

As notas são de **dois tipos**, e foi preciso separar:

- **Chopp (líquido)** — "Draft Beer Heineken/Amstel 50L", CFOP 5403/5910.
  **É isto que abastece o estoque DISPEL** e vai no CSV de importação.
- **Vasilhame (comodato)** — "Barril Inox 50l", CFOP 5908. É o casco emprestado
  pela Heineken; entra na conta de comodato, não no estoque de cheios.
- **Garrafa / refrigerante** — algumas notas só têm cerveja em garrafa ou
  tônica. Não são barril, ficaram fora do estoque (mas estão na conferência).

| NF | Emissão | Heineken | Amstel | Vasilhames | Tipo |
|----|---------|:---:|:---:|:---:|------|
| 001036763 | 14/07 | — | — | 96 | comodato |
| 001036765 | 14/07 | — | — | 96 | comodato |
| 001036766 | 14/07 | — | — | 152 | comodato |
| 001036767 | 14/07 | 48 | 48 | — | chopp |
| 001036769 | 14/07 | — | — | — | só garrafa/refri |
| 001040032 | 16/07 | — | — | 40 | comodato |
| 001042364 | 20/07 | 30 | 30 | — | chopp |
| 001042368 | 20/07 | — | — | — | só garrafa/refri |
| 001043515 | 21/07 | — | — | 90 | comodato |
| 001043517 | 21/07 | — | — | 90 | comodato |
| 001043518 | 21/07 | 30 | 20 | — | chopp |
| 001044368 | 21/07 | 30 | 30 | — | chopp |
| 001045254 | 22/07 | 45 | 46 | — | chopp |
| 001045256 | 22/07 | 25 | 25 | — | chopp |
| 001046580 | 23/07 | — | — | 80 | comodato |
| 001046581 | 23/07 | 26 | 20 | — | chopp |
| 001047997 | 24/07 | — | — | 80 | comodato |

**Totais:** 234 Heineken + 219 Amstel = **453 barris de chopp** entram no
estoque · **724 vasilhames** em comodato.

---

## Passo a passo

1. **Antes:** confirme que a migration `20260724150000_fix_move_type_invalido.sql`
   já foi aplicada. Sem ela, a importação de estoque falha (era o bug do
   `move_type`). Ver `docs/APLICACAO.md`.
2. No app: **Central de Estoque → Importar → modo "Estoque"**.
3. Suba **`import-estoque-nfs.csv`**. Pré-visualize: 15 linhas, todas
   `dispel / entrada (+1)`.
4. Confirme. O saldo do DISPEL deve subir **+453** (234 H, 219 A).
5. Confira no **Balanço** (Central → Balanço): o "Recebido" deve refletir esses
   453 barris.

---

## Duas coisas para decidir

**1. Vasilhames em comodato (724).** Não entram como estoque de cheios — são a
conta com a Heineken (`cheios_recebidos_acumulados`). Hoje o app alimenta o
comodato pela conciliação de NF. Se você quiser registrar esses 724 como
vasilhames recebidos, dá para incluir num segundo passo — me avise que eu gero
o CSV no formato certo. Deixei-os separados em `comodato-vasilhames.csv` para
não misturar com o estoque de chopp.

**2. Por que 724 vasilhames ≠ 453 de chopp.** É esperado: o comodato manda o
casco, que serve para várias rodadas de enchimento. Um não tem que bater com o
outro na mesma remessa. O que conta como **cheio recebido** no balanço é o
chopp (453); o vasilhame é o lastro físico do comodato.

---

## Nada se perdeu

Se quiser auditar, `conferencia-nfs-completa.csv` tem **as 17 NFs com todos os
itens** — chopp, vasilhame, garrafa e refrigerante — com CFOP, chave de acesso
e valor total de cada nota. As 38 linhas cobrem 100% do conteúdo dos PDFs.
