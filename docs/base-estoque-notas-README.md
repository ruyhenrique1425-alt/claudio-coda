# Base de Estoque (Notas Fiscais) — arquivo mestre

Este é o **arquivo base** que alimenta o estoque do app a partir das notas fiscais.
Cada linha = uma entrada (ou saída) de estoque de um armazém.

Importe em **App → IMPORTAR → "Entradas/saídas de estoque"** e selecione este CSV.

## Colunas (ordem e nomes exatos — não renomear)

| Coluna           | Obrigatório | Valores aceitos                          | Observação |
|------------------|-------------|------------------------------------------|------------|
| `warehouse_code` | Sim         | código de um armazém existente (ex.: `dispel`, `allstar`) | Precisa já estar cadastrado na tabela `warehouses`. |
| `brand`          | Sim         | `heineken` ou `amstel` (minúsculo)       | Qualquer outro valor é rejeitado. |
| `quantidade`     | Sim         | número inteiro maior que 0               | Em barris. |
| `direction`      | Sim         | `1` = entrada (NF) · `-1` = saída/ajuste | Padrão `1` se vazio. |
| `observacoes`    | Não         | texto livre                              | Recomendado: número da NF (ex.: `Entrada NF 001043514`). |

## Regras para o arquivo ficar "à prova de erro"

- Formato: **CSV separado por vírgula**, **UTF-8 com BOM** (abre certo no Excel e no importador).
- Cabeçalho na **primeira linha**, exatamente como acima.
- `brand` sempre em **minúsculas**.
- Se `observacoes` tiver vírgula, coloque o texto entre aspas: `"Entrada NF 123, lote A"`.
- Uma linha por marca. Se a NF trouxe Heineken **e** Amstel, gere **duas linhas** (mesma `observacoes`/NF).
- Não misture outros produtos: só `heineken`/`amstel` entram nesta base de estoque.

## Como as notas viram linhas

Ao ler uma nota fiscal de entrada de barris:
1. `warehouse_code` = armazém que recebeu (`dispel` na maioria dos casos).
2. `brand` = marca do barril.
3. `quantidade` = quantos barris daquela marca.
4. `direction` = `1` (entrada).
5. `observacoes` = número da NF.

As três linhas do arquivo são **exemplos** — substitua pelos dados reais das suas notas.
