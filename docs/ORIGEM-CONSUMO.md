# De onde vem cada número de "consumo"

Resposta à pergunta: *a tela CONSUMIDOS e a tela CONSUMO não batem — qual seguir?*

## As duas fórmulas, lado a lado

### [A] Tela inicial → "BARRIS CONSUMIDOS"

```
consumidos = Σ empties_removed.quantidade
             filtrado por período (Hoje / 7 dias / Tudo)
             filtrado aos bares da operação (bar_venda, bar_parceiro)
             sem teto
```

Uma tabela só: **`empties_removed`** — o registro de vazios recolhidos.

### [B] Tela Consumo → card "Consumidos (vazios)" *(como estava)*

```
consumido = vaziosBar + recolhidos

  recolhidos = Σ empties_removed.quantidade  no período      ← FLUXO
  vaziosBar  = vazios do ÚLTIMO inventário de cada bar       ← FOTO
               com teto no padrão: Math.min(vazios, padrão)
```

Duas tabelas de naturezas diferentes somadas: **`empties_removed`** +
**`inventory_items` (status `vazio`)**.

---

## Por que davam números diferentes

Quatro causas, e elas puxam para lados opostos — por isso a diferença não era
um desvio constante:

**1. B soma uma foto a um fluxo.**
`empties_removed` é um evento com data: um barril recolhido hoje é uma linha
nova. `inventory_items.vazio` é uma contagem do momento. Somar os dois responde
a uma pergunta que ninguém fez.

**2. B contava o mesmo barril duas vezes.**
O operador recolhe 5 vazios → entram em `empties_removed`. Se ninguém refizer o
inventário, o último inventário continua mostrando os mesmos 5 vazios. B soma:
5 recolhidos + 5 na foto = **10**. Consumidos de verdade: 5. Numa operação de
evento, recolher sem refazer inventário na sequência é o caso comum, não a
exceção — então o erro tendia a ser grande.

**3. Descasamento de período.**
Em B, `empties_removed` respeitava o filtro (Hoje / 7 dias), mas o inventário
era **sempre o último**, sem filtro nenhum. Com "Hoje" selecionado, B somava o
recolhimento do dia com o estoque de vazios acumulado de todos os dias.

**4. Teto no padrão.**
B aplicava `Math.min(vazios, padrão)`. Um bar de padrão 6 com 10 vazios na foto
contava 6. Isso **subestima** — e é justamente o bar que mais vendeu que sumia
da conta.

As causas 2 e 3 inflam o número; a 4 encolhe. O resultado era imprevisível.

---

## Qual é o dado mais fidedigno

**`empties_removed` — o número da tela inicial.**

| Critério | `empties_removed` | inventário `vazio` | `meep_consumo_bar` |
|---|---|---|---|
| É um fluxo (soma por período) | **sim** | não (é foto) | sim |
| Tem data e responsável | `performed_at`, `performed_by` | só data do inventário | só a data |
| Registrado onde | no app, na hora | no app, no inventário | fora, importado |
| Alimenta o comodato | **sim, por trigger** | não | não |
| Risco de dupla contagem | nenhum | alto se somado | nenhum |
| Depende de importação manual | não | não | **sim** |

`empties_removed` vence porque é a única fonte que é **um fluxo auditável
registrado no ato**: cada linha tem quem recolheu e quando, é somável por
qualquer período sem dupla contagem, e já é a base contábil do comodato. Se o
número do comodato está certo, o de consumo está pela mesma origem.

### E o consumo da MEEP?

`meep_consumo_bar` é o que os clientes **realmente beberam** — é a melhor fonte
para a pergunta *comercial*. Mas não substitui a de cima: depende de exportar e
importar o relatório à mão, a quantidade sai do nome do produto, e o gestor
pediu para **não ligar consumo a barril**. Mantenha as duas, respondendo a
perguntas diferentes:

- **Operação** (o que repor, o que devolver à Heineken) → `empties_removed`
- **Comercial** (quanto cada bar vendeu) → `meep_consumo_bar`

---

## O que foi alterado

Em `src/routes/app.consumo.tsx`:

1. **"Consumidos" passou a ser só `empties_removed`** — mesma origem e mesma
   fórmula da tela inicial. As duas telas agora batem.
2. **Teto no padrão removido** (`Math.min`) — não subestima mais quem passou do
   padrão.
3. **Vazios do inventário viraram indicador separado: "a recolher"** — a
   informação continua na tela, ela é útil, só não é mais somada ao consumo.
4. **Ranking por bar** passou a ordenar pelo consumo real; a barra não mistura
   mais os dois valores.

## Descontinuar o quê

Não é preciso descontinuar nenhuma tela — as duas passaram a mostrar o mesmo
número, cada uma no seu nível de detalhe:

- **Tela inicial** = o total, com filtro rápido de período. É o painel.
- **Tela Consumo** = o mesmo total aberto por bar e por marca, mais o ranking.
  É o detalhe.

O que foi descontinuado foi a **fórmula composta** (`vazios + recolhidos`), que
era a única coisa realmente divergente.

Se quiser mesmo assim reduzir a uma tela só, a que pode sair é a aba **Ranking**
da tela Consumo — o "Top bares por consumo" da tela inicial já entrega a mesma
leitura. As abas *Por bar (real)* e *Ao longo do tempo* não têm equivalente e
devem ficar.

## Uma ressalva honesta

`empties_removed` conta o que foi **recolhido**. Um barril consumido às 22h e
recolhido só no dia seguinte aparece no dia do recolhimento, não no do consumo.
Para o dia corrente, o número tende a ficar um pouco **abaixo** do consumo real
— e a diferença é justamente o "a recolher" que agora aparece ao lado.

Era esse buraco que a fórmula antiga tentava tapar. A intenção estava certa; o
problema é que somar as duas colunas conta barril repetido. Se quiser um número
único de "consumido incluindo o que ainda está no bar", ele só é válido no
período **"Tudo"** e ainda assim erra sempre que houver recolhimento posterior
ao último inventário. Vale mais manter as duas colunas à vista.

---

# Adendo: "recolhido dá baixa em a recolher?"

**Não dava. Agora dá.**

## O que foi verificado

Duas provas no código:

1. **No banco.** O único trigger sobre `empties_removed` é
   `trg_empties_to_comodato`, que atualiza `controle_comodato_global`. Ele não
   encosta em `inventory_items`.
2. **No app.** Os dois fluxos que gravam recolhimento — a reposição
   (`app.bars.$barId.tsx`, ~linha 1031) e o recolhimento avulso (~linha 1302) —
   inserem em `empties_removed` e **não criam inventário novo**.

Ou seja: o número de vazios só mudava quando alguém refazia o inventário. Entre
um inventário e o próximo, a tela continuava mandando recolher barril que já
estava no caminhão.

Era o mesmo defeito que inflava o "Consumidos", visto de outro ângulo.

## A correção

`src/lib/operacao.ts` ganhou:

```
a_recolher = max(0, vazios_no_inventário − recolhidos_após_o_inventário)
```

O desconto usa `empties_removed.performed_at` comparado com a data do último
inventário do bar. Não precisou de migration, de coluna nova nem de mudança no
que o operador faz — o dado já existia, só não estava sendo cruzado.

Aplicado em **cinco** telas, para nenhuma discordar da outra:

| Tela | Número corrigido |
|---|---|
| Início | coluna "Vazio" da tabela por estado |
| Barris → Cobertura & Rotas | KPI "Vazios a recolher" e o "Recolher" de cada rota |
| Barris → Contagem (BI) | coluna "Vazio" |
| Central de Estoque | "Vazios nos bares" |
| Consumo | "a recolher" no card e no ranking |

## O que muda na prática

Depois de recolher, o número **cai na hora** — sem esperar novo inventário.

Se o bar acumulou vazios depois da foto e o operador recolheu mais do que a foto
mostrava, a conta trava em zero (o `max(0, …)`) em vez de ficar negativa. Nesse
caso o número certo só volta com o próximo inventário — mas errar para zero é
melhor que mandar recolher o que não existe.

## O que continua valendo

O inventário segue sendo a única fonte de **plugado** e **fechado**. Esses dois
não têm tabela de fluxo equivalente, então continuam sendo a foto do último
inventário, sem correção possível. Inventário em dia continua importando.

---

# Adendo 2: "dá para ter uma tela de consumidos sem conta duplicada?"

**Dá — com uma condição.**

## A soma é segura

```
consumidos_no_evento = Σ empties_removed  +  a_recolher_atual
```

Onde `a_recolher_atual = max(0, vazios_no_inventário − recolhidos_após_o_inventário)`.

Não há dupla contagem, e isso não é opinião: `docs/verificar_dupla_contagem.py`
varre exaustivamente todas as linhas do tempo curtas de um bar (consumos e
recolhimentos em qualquer ordem, com o inventário tirado em qualquer ponto) e
não encontra **nenhum** caso de barril contado duas vezes.

A razão é simples. Para um barril entrar nas duas parcelas, ele teria que estar
na foto do inventário **e** ter sido recolhido sem ser descontado. Mas:

- recolhido **depois** da foto → é descontado pelo `− recolhidos_após`;
- recolhido **antes** da foto → não estava no bar quando a foto foi tirada,
  logo não está na foto.

Não sobra caminho.

## A condição: só no período "Tudo"

`Σ empties_removed` filtrado por janela é um **fluxo daquela janela**.
`a_recolher` é uma **foto de agora**. Somar os dois com filtro ativo mistura
grandezas de períodos diferentes — foi exatamente o defeito original.

Por isso:

| Período | O número mostrado |
|---|---|
| **Tudo** | `recolhidos + ainda no bar` = consumo do evento |
| Hoje / 7 dias | só `recolhidos` no período; o "a recolher" aparece ao lado, separado |

A interface troca o rótulo junto com o modo: em "Tudo" lê **"Consumidos no
evento"**, com a decomposição visível (`X recolhidos + Y no bar`); nos demais
lê **"Recolhidos no período"**.

## O que fica de fora (e não tem conserto)

Consumo que aconteceu **depois** do último inventário e ainda **não** foi
recolhido não está em lugar nenhum — nem na foto, nem no fluxo. O teste
exaustivo confirma: o único erro possível da fórmula é **subcontagem**, nunca
sobra.

Isso não é falha de cálculo, é ausência de dado. A única forma de encurtar a
diferença é inventário em dia.
