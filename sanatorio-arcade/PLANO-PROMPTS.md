# Plano de prompts — Sanatório

11 melhorias, 5 créditos por dia. O plano abaixo cabe em 3 dias de trabalho
com 4 créditos gastos e 1 de folga por dia, porque bug custa crédito e sempre
aparece um.

Cada crédito é uma mensagem no Lovable. A conta só fecha se cada mensagem
entregar um módulo inteiro e não estragar o que já funciona.

---

## Três decisões antes de gastar crédito

### 1. Ranking premiado + pontos transferíveis não combinam

Você quer premiar quem tiver mais pontos às 3:33 do dia 30/10, e ao mesmo
tempo quer que os pontos sejam apostados, doados e gastos em itens de avatar.
Do jeito que está, três amigos zeram a conta e despejam tudo num só, que ganha
o prêmio sem ter jogado nada.

Separe em dois números sobre a mesma carteira:

- `ganhos_total` — só sobe, nunca desce. É o que vale para o ranking e o prêmio.
- `saldo` — sobe e desce. É o que dá para apostar, doar e gastar na loja.

Doação transfere saldo e não mexe em `ganhos_total` do quem recebe. Aposta
ganha em cima do outro conta como ganho. Assim a doação continua sendo um gesto
bonito e para de ser uma brecha.

### 2. Pontos sem servidor viram pontos falsos

Hoje a identidade do paciente vive no `localStorage`. Qualquer convidado com
o celular no modo desenvolvedor edita o próprio saldo. Enquanto os pontos eram
enfeite, tudo bem. Com prêmio real na mesa, não é mais.

O conserto não é caro: toda mudança de saldo passa por uma função no Postgres
(`RPC`), nunca por `update` direto do cliente. Uma tabela `transacoes` guarda
quem mandou, quem recebeu, quanto e por quê. O saldo vira a soma das transações,
então dá para auditar às 3:34 se alguém reclamar do resultado.

### 3. O embargo das fotos só existe se o servidor recusar

A galeria hoje usa URL assinada gerada no servidor (`listarFotos` em
`src/lib/sanatorio.functions.ts`). Se você só borrar a imagem no CSS, qualquer
um abre o inspetor e vê tudo. Peça o embargo onde ele vale: **a função do
servidor não assina URL nenhuma antes de 30/10 às 12h**. Antes disso ela
devolve só o nome, o avatar e a atividade. Aí o borrão no front é enfeite, não
é a fechadura.

---

## Como escrever prompt que não desperdiça crédito

1. **Um módulo por mensagem.** Misturar "ranking" e "loja de avatar" na mesma
   mensagem é pedir para a IA entregar os dois pela metade.
2. **Cite os arquivos que já existem.** `src/routes/arcade.tsx`,
   `src/components/arcade/GeniusManicomio.tsx`, `src/lib/sanatorio.functions.ts`.
   Sem isso o Lovable recria componente do zero e quebra o que funcionava.
3. **Feche o escopo no fim do prompt.** "Não altere as rotas /camera, /mural
   e /panico." Uma linha dessas evita a mensagem de conserto do dia seguinte.
4. **Escreva o "pronto quando".** Critério de aceite dentro do próprio prompt
   sai de graça e corta retrabalho. "Pronto quando eu conseguir doar 5 pontos
   e o saldo do outro subir sem recarregar a página."
5. **Peça a migration junto.** Toda mudança de banco: "gere o arquivo em
   `supabase/migrations/` e descreva a política de RLS que você criou."
6. **Bug se descreve pelo sintoma, não pelo palpite.** "Cliquei em Doar, apareceu
   'enviado', o saldo do outro não mudou" rende mais que "acho que o realtime
   está errado".

---

# Dia 1 — a casca (4 créditos, nada de banco)

Tudo aqui é front-end. Risco baixo, efeito visual imediato, e você já pode
mostrar para o Recruta e o Canela testarem.

## Crédito 1 — Logo, ícones da barra e toque

```
Atue como desenvolvedor front-end sênior. Três ajustes de interface no app,
sem tocar em lógica nem em banco de dados.

1. LOGO (src/components/Logo.tsx)
Refaça a logo para "República Sanatório". O símbolo deve ficar alinhado na
vertical com o texto, integrado à base do nome, sem pontos soltos nem
elementos flutuantes. Duas linhas: "REPÚBLICA" menor em cima, "SANATÓRIO"
maior embaixo, na fonte Press Start 2P. Cor: verde neon com brilho, e o
símbolo em amarelo.

2. BARRA INFERIOR (src/components/AppShell.tsx)
Aumente os ícones da bottom bar de 20px para 26px e a área de toque de cada
item para no mínimo 56px de altura. Aumente o rótulo de texto em 1 ponto.
A barra inteira pode crescer; ajuste o padding inferior das rotas para o
conteúdo não ficar escondido atrás dela.

3. Respeite a safe area do iPhone (env(safe-area-inset-bottom)) na barra.

Pronto quando: a logo aparece alinhada no header de todas as rotas e eu
consigo acertar os ícones da barra com o polegar, em pé, segurando um copo.

Não altere as rotas /arcade, /camera, /mural, /match e /panico.
```

## Crédito 2 — PWA sem barra de navegador

```
Atue como desenvolvedor front-end sênior. Transforme o app em PWA instalável.

1. Adicione vite-plugin-pwa ao vite.config.ts (registerType: 'autoUpdate').
2. Manifest: name "República Sanatório", short_name "Sanatório",
   display "standalone", theme_color "#000000", background_color "#000000",
   start_url "/", orientation "portrait".
3. Gere os ícones 192x192, 512x512 e o maskable 512x512 a partir do símbolo
   da logo, em public/.
4. Adicione as meta tags do iOS no head da rota raiz (src/routes/__root.tsx):
   apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style black,
   e o apple-touch-icon.
5. Crie um banner discreto no rodapé que aparece só no primeiro acesso,
   escrito "INSTALE O PRONTUÁRIO NA TELA INICIAL", usando o evento
   beforeinstallprompt no Android. No iOS, onde esse evento não existe,
   mostre a instrução: "Compartilhar > Adicionar à Tela de Início".
   Guarde no localStorage que o banner já foi dispensado.

Pronto quando: eu adicionar o app à tela inicial do iPhone e do Android e ele
abrir em tela cheia, sem barra de endereço.

Não altere nenhuma rota nem componente de jogo.
```

## Crédito 3 — Arcade: renomes e dificuldade progressiva

```
Atue como desenvolvedor de jogos. Ajustes nos minigames existentes.

1. TESTE DE SOBRIEDADE (src/components/arcade/GeniusManicomio.tsx)
Renomeie o jogo de "Genius do Manicômio" para "Teste de Sobriedade" em toda a
interface, incluindo o card em src/routes/arcade.tsx.
Dificuldade progressiva: a sequência começa com 700ms por cor e 350ms de
intervalo. A cada rodada vencida, multiplique os dois tempos por 0.88, com
piso de 140ms por cor. A partir da rodada 8, além de acelerar, faça a tela
tremer de leve e some com a cor um instante antes do previsto.
No game over, mostre o "laudo" conforme a rodada alcançada:
  1-3  "Diagnóstico: já passou do ponto. Vá beber água."
  4-7  "Diagnóstico: sóbrio o suficiente para dirigir uma bicicleta."
  8-11 "Diagnóstico: reflexos suspeitos. Você bebeu mesmo?"
  12+  "Diagnóstico: você é o motorista da rodada. Parabéns e sinto muito."

2. RENOMEAR (src/components/arcade/DiagnosticoCruzado.tsx)
"Diagnóstico Cruzado" passa a se chamar "Terapia de Choque". Atualize o
título, o resumo no card do arcade e o texto do modal.

3. Mantenha tudo em estado local. Nenhuma chamada ao Supabase.

Pronto quando: eu jogar o Teste de Sobriedade e sentir a aceleração já na
quarta rodada, e for impossível passar da rodada 14.

Não altere a Roleta Etílica, o Detector de Mentiras nem as outras rotas.
```

## Crédito 4 — Alta médica com janela de horário

```
Atue como desenvolvedor full-stack sênior. Implemente a Alta do Hospício na
rota inicial (src/routes/index.tsx), na tela do paciente já internado.

1. JANELA
O botão "SOLICITAR ALTA MÉDICA" só fica ativo entre 22h00 e 07h00. Fora
dessa faixa, mostre o botão desabilitado com o texto "ALTA LIBERADA A PARTIR
DAS 22H" e um contador regressivo até as 22h. Use o horário do dispositivo.

2. FLUXO (modal em tela cheia, três passos)
Passo 1: um canvas branco de prancheta médica. Em vez de assinatura com o
dedo, peça o CARIMBO DO POLEGAR: a pessoa pressiona e segura o dedo na tela
por 2 segundos. Desenhe uma digital em pixel art crescendo no ponto do toque,
com uma barra de progresso. Se soltar antes, recomeça.
Passo 2: flash rápido de verde e roxo (framer-motion), e o texto em fonte
8-bits: "HAHAHA! VOCÊ ACHA MESMO QUE ESTÁ CURADO? LEVE ESSA CAMISA DE FORÇA
COM VOCÊ."
Passo 3: um cupom em formato de ticket de fliperama, com borda serrilhada e
piscando: "ALTA333 — R$ 3,33 DE DESCONTO NA BLUSA DA SANATÓRIO".
Abaixo, em letra menor: "Mostre o print desta tela para resgatar."
Um botão "SALVAR PRINT" que só instrui a pessoa a tirar o print, já que o
navegador não deixa o app fazer isso sozinho.

3. REGISTRO
Salve no localStorage que a alta foi dada, com o horário. Na próxima vez que
abrir o app, a tela inicial mostra o carimbo "ALTA CONCEDIDA" e o cupom
continua acessível.

Pronto quando: às 23h eu conseguir carimbar o dedo e chegar no cupom, e às
15h o botão aparecer bloqueado com o contador.

Não altere as outras rotas.
```

---

# Dia 2 — a fundação (3 créditos + 2 de folga)

Dia de banco de dados. Guarde dois créditos: é aqui que a IA costuma errar RLS.

## Crédito 1 — Carteira de pontos e identidade

Este é o crédito mais importante do plano. Tudo do dia 3 depende dele.

```
Atue como desenvolvedor full-stack sênior, especialista em Postgres e Supabase.
Vamos criar a economia de pontos do app. Gere as migrations em
supabase/migrations/ e descreva as políticas de RLS que criar.

1. IDENTIDADE
A tabela pacientes já existe e o id é salvo no localStorage como paciente_id.
Adicione a coluna token uuid (default gen_random_uuid(), not null), devolvida
apenas no INSERT da internação e guardada no localStorage do paciente. Esse
token é a senha dele: toda operação que mexe em pontos exige o par
(paciente_id, token).

2. CARTEIRA
Crie a tabela transacoes:
  id uuid pk, de_paciente uuid null, para_paciente uuid not null,
  pontos integer not null check (pontos > 0),
  motivo text not null check (motivo in ('jogo','qrcode','aposta','doacao')),
  referencia text null, created_at timestamptz default now().
Doação e aposta preenchem de_paciente. Ganho de jogo e QR code deixam null.
Pontos gastos na loja não entram aqui: crie a tabela gastos
(id, paciente_id uuid, pontos integer check (pontos > 0), item text,
created_at timestamptz). Assim nenhuma das duas tabelas aceita número
negativo, e o saldo é sempre entrada menos saída.

3. DOIS NÚMEROS
Crie a view saldo_pacientes com, por paciente:
  ganhos_total = soma de transacoes.pontos recebidas onde de_paciente is null
                 mais as recebidas por motivo 'aposta'
  recebido     = soma de tudo que entrou
  enviado      = soma de tudo que saiu
  gasto        = soma de gastos.pontos
  saldo        = recebido - enviado - gasto
ganhos_total serve ao ranking e nunca diminui. saldo é o que dá para gastar.

4. FUNÇÕES ATÔMICAS (SECURITY DEFINER, search_path = public)
  creditar_pontos(_paciente uuid, _token uuid, _pontos int, _motivo text,
                  _referencia text)
  transferir_pontos(_de uuid, _token uuid, _para uuid, _pontos int,
                    _motivo text)
    - valida o token, valida saldo suficiente, recusa transferência para si
      mesmo, recusa pontos <= 0, e grava a transação. Retorna o novo saldo.
  gastar_pontos(_paciente uuid, _token uuid, _pontos int, _item text)
Nenhuma dessas operações pode ser feita por UPDATE direto do cliente.

5. RLS
Revogue INSERT, UPDATE e DELETE de anon nas tabelas transacoes e gastos.
Deixe apenas SELECT liberado (o feed de pontos é público, faz parte da graça).
Conceda EXECUTE das três funções para anon e authenticated.

6. FRONT
Crie src/lib/pontos.ts com as funções cliente que chamam essas RPCs, e um
componente <Carteira /> que mostra saldo e ganhos_total no header da rota
inicial, em fonte 8-bits amarela, com um ícone de ficha de fliperama.

Pronto quando: eu chamar transferir_pontos com um token errado e a operação
for recusada pelo banco, não pelo front.

Não altere as rotas /camera, /mural, /panico e /arcade nesta mensagem.
```

## Crédito 2 — Perfil do paciente

```
Atue como desenvolvedor front-end sênior. Transforme a rota inicial
(src/routes/index.tsx) no perfil completo do paciente internado.

1. CABEÇALHO DO PRONTUÁRIO
Avatar grande (src/components/avatar/PixelAvatar.tsx) dentro de uma moldura,
nome do paciente, número do leito (as 4 primeiras letras do id, em maiúsculas,
prefixadas por "LEITO-"), data de internação e a carteira de pontos.

2. ATRIBUTOS
Mantenha os cinco diagnósticos e os 15 pontos, mas substitua as barrinhas por
um gráfico de radar em pixel art (5 eixos, linhas verde neon sobre preto, área
preenchida em roxo translúcido). Abaixo do radar, mantenha a lista com o valor
de cada atributo.

3. LAUDO AUTOMÁTICO
Gere um "laudo psiquiátrico" de uma linha combinando os dois atributos mais
altos do paciente. Faça uma tabela local com as 10 combinações possíveis, por
exemplo:
  Coringa + Imunidade: "Paciente de alto risco. Manter longe do som."
  Áudio + Amnésia: "Não devolva o celular a este paciente após as 2h."
  Inimigo do Fim + Imunidade: "Este paciente vai apagar as luzes. Literalmente."
Escreva as 10 no mesmo tom de humor das descrições que já existem no app.

4. HISTÓRICO
Uma lista com as últimas 10 movimentações de pontos da tabela transacoes,
cada linha com ícone, motivo e quantidade, em verde para entrada e vermelho
para saída.

5. MOLDURA
Se o paciente tiver comprado alguma moldura (leia do campo que a loja usará
depois), renderize ao redor do avatar. Deixe o componente pronto para receber
uma moldura por id, com a padrão como fallback.

Pronto quando: o radar refletir a distribuição real dos meus 15 pontos e o
laudo mudar se eu refizer a triagem com outros atributos.

Não altere a lógica de distribuição de pontos nem as outras rotas.
```

## Crédito 3 — Embargo até 30/10 às 12h

```
Atue como desenvolvedor full-stack sênior. Implemente o embargo das fotos e
das mensagens até 30/10/2026 às 12h00 (horário de Brasília).

IMPORTANTE: o embargo tem que valer no servidor, não só no visual.

1. SERVIDOR (src/lib/sanatorio.functions.ts)
Crie uma constante REVELACAO = 2026-10-30T15:00:00Z.
Em listarFotos: antes da data, NÃO gere as URLs assinadas do bucket. Devolva
por foto apenas id, autor, personagem, avatar, created_at e um campo novo
atividade (texto curto do que a pessoa registrou). Depois da data, devolva
tudo como hoje.
Em listarMural: antes da data, devolva a mensagem como null e um campo
tamanho com o número de caracteres, para o front desenhar o borrão no
comprimento certo. O autor, o avatar e o horário continuam visíveis.

2. FRONT (src/routes/camera.tsx e src/routes/mural.tsx)
Enquanto estiver embargado, renderize no lugar da foto um bloco preto com
ruído e pixelização animada, e por cima o avatar em 8-bits, o nome de quem
registrou e a atividade ("registrou um momento", "deixou um recado para o
Canela"). O texto das mensagens vira blocos borrados do tamanho certo.
Em todas as telas embargadas, um contador regressivo até a revelação:
"REVELAÇÃO EM 14H 22M".

3. Depois da data, tudo abre sozinho, sem precisar de deploy novo.

Pronto quando: eu abrir o inspetor do navegador, olhar a resposta da requisição
e não encontrar nenhuma URL de imagem nem o texto das mensagens.

Não altere a lógica de captura da câmera nem o envio de recados.
```

---

# Dia 3 — a economia e o social (4 créditos)

Só entre aqui depois que a carteira do dia 2 estiver testada.

## Crédito 1 — Ranking público e o prêmio das 3:33

```
Atue como desenvolvedor full-stack sênior. Crie a rota /ranking e coloque o
item "Ranking" na bottom bar (ícone Trophy do lucide-react).

1. PLACAR
Leia a view saldo_pacientes ordenada por ganhos_total desc, limite 50.
Renderize como placar de fliperama: posição, avatar pequeno, nome em
maiúsculas truncado em 12 caracteres, e a pontuação alinhada à direita em
amarelo. Os três primeiros ganham destaque: 1º com moldura dourada pulsante,
2º prateada, 3º bronze.
Use supabase realtime na tabela transacoes para o placar se mexer sozinho
quando alguém pontuar. Anime a troca de posição com framer-motion (layout
animation), para a linha deslizar quando alguém ultrapassa o outro.

2. O PRÊMIO
No topo, um contador regressivo gigante até 30/10/2026 às 03:33 (horário de
Brasília), com o texto "APURAÇÃO DO PRÊMIO EM 04:12:45".
Quando o contador zerar, congele o placar: mostre um overlay em tela cheia
com sirene verde e roxa, o nome do campeão e o texto "PACIENTE MAIS INSANO DA
NOITE". A partir desse momento, a tela do ranking passa a exibir o resultado
congelado, mesmo que os pontos continuem se movendo.
Grave o resultado numa tabela premiacao (id, paciente_id, ganhos_total,
apurado_em) para não depender do relógio do celular de ninguém.

3. Deixe claro na tela que o ranking usa PONTOS GANHOS, e que doar pontos para
um amigo não tira você da disputa.

Pronto quando: eu ganhar pontos num celular e ver o placar mexer no outro,
sem recarregar.

Não altere as regras de crédito de pontos nem as rotas existentes.
```

## Crédito 2 — Match com curtida e afinidade

```
Atue como desenvolvedor full-stack sênior. Reconstrua a rota /match.

1. CARD DO PACIENTE
Cada card mostra: avatar em 8-bits dentro da moldura do paciente, nome,
número do leito, o radar dos cinco atributos em miniatura, e a compatibilidade
em porcentagem (a lógica já existe em src/lib/afinidade.ts — use-a, não
reescreva).

2. CURTIDA DE VERDADE
Crie a tabela curtidas (id, de_paciente, para_paciente, created_at, unique
(de_paciente, para_paciente)). O botão passa a ser "INTERNAR JUNTO".
Ao curtir, insira a linha via RPC validando o token do paciente.

3. AVISO
Crie um sino de avisos no header. Use supabase realtime na tabela curtidas
filtrando para_paciente = meu id. Quando alguém me curte, o sino ganha um
ponto vermelho e o aviso diz: "PACIENTE [NOME] QUER FUGIR COM VOCÊ".
Se a curtida for mútua, dispare um modal em tela cheia com flash verde e roxo:
  "DIAGNÓSTICO COMPATÍVEL — 87%"
  o avatar dos dois lado a lado
  "TRATAMENTO PRESCRITO: UMA DOSE NO BAR, JUNTOS. AGORA."
  e a lista dos atributos em que os dois bateram.

4. Uma aba "MEUS MATCHES" com a lista de compatíveis mútuos, para a pessoa
achar de novo quem ela curtiu às 2h da manhã.

Pronto quando: eu curtir num celular, o sino tocar no outro em menos de
5 segundos, e o modal de match aparecer nos dois quando for mútuo.

Não altere src/lib/afinidade.ts nem as outras rotas.
```

## Crédito 3 — Prenda alcoólica e desafio de cachaça

```
Atue como desenvolvedor de jogos. Duas dinâmicas entre jogadores, ambas
usando as RPCs de pontos que já existem.

1. PRENDA ALCOÓLICA (botão no card do /match e no perfil do outro paciente)
"MANDAR PRENDA". Ao clicar, abre um dado em pixel art de 6 faces, com as
faces repetidas duas a duas: 1 bola, 1 bola, 2 bolas, 2 bolas, 3 bolas,
3 bolas. O dado rola com animação de 2 segundos e para num resultado.
O número de bolas é quantos segundos o alvo tem que beber.
O alvo recebe um aviso em tela cheia (realtime): "PRENDA RECEBIDA DE [NOME] —
BEBA POR 2 SEGUNDOS". Dois botões: "CUMPRI" e "PASSO".
  CUMPRI: o alvo ganha 10 pontos por segundo bebido.
  PASSO: quem mandou a prenda ganha 5 pontos.
Limite: cada paciente pode mandar no máximo 1 prenda por alvo a cada 15
minutos. Valide isso no banco, pelo created_at da última prenda, não no front.
Máximo de 3 segundos por prenda, sempre. Não crie nenhuma forma de aumentar
esse teto.

2. DESAFIO DE CACHAÇA (aposta de pontos)
Na tela do outro paciente, o botão "DESAFIAR — VALENDO PONTOS". O desafiante
escolhe quanto apostar (10, 25 ou 50 pontos, limitado pelo saldo dos dois).
O desafiado recebe o aviso em realtime e tem 60 segundos para aceitar.
Aceito, os dois jogam par ou ímpar no app: cada um escolhe um número de 0 a 5
numa tela que o outro não vê, e a soma decide. Quem ganhar leva os pontos
apostados, via transferir_pontos com motivo 'aposta'.
Se o desafiado não responder em 60 segundos, o desafio expira e ninguém perde
nada.

3. Crie a tabela desafios (id, de_paciente, para_paciente, pontos, status,
escolha_de, escolha_para, created_at) e as RPCs para criar, aceitar, jogar e
expirar, todas validando token e saldo.

Pronto quando: eu apostar 25 pontos, o outro aceitar, e o saldo dos dois mudar
no mesmo instante, sem nenhum dos dois conseguir mudar a escolha depois de
enviada.
```

## Crédito 4 — Loja de molduras e itens

```
Atue como desenvolvedor front-end sênior. Crie a loja onde os pontos viram
personalização.

1. ROTA /loja (item na bottom bar, ícone ShoppingBag)
Vitrine em grade estilo fliperama, cada item num card com preview ao vivo do
avatar do próprio paciente usando aquele item.

2. ITENS (tudo em pixel art, desenhado em CSS ou SVG inline, sem imagem
externa)
Molduras (aparecem ao redor do avatar no /match, no /ranking e no /mural):
  Camisa de força — 50 pontos — cinza com fivelas
  Sirene — 120 pontos — borda que pisca vermelho e azul
  Cartela do Coringa — 200 pontos — roxo e verde com naipes
  Rótulo Johnnie — 350 pontos — dourado com o traço do caminhante
  Prontuário lacrado — 500 pontos — papel envelhecido com carimbo "URGENTE"
Adereços do avatar:
  Cone de trânsito na cabeça — 80 pontos
  Copo americano na mão — 60 pontos
  Óculos escuros às 6h da manhã — 90 pontos
  Sorriso do Coringa — 250 pontos
Efeitos de nome:
  Nome piscando em neon — 150 pontos
  Nome com glitch — 300 pontos

3. COMPRA
Use gastar_pontos. Salve o inventário numa coluna itens jsonb em pacientes,
com o que foi comprado e o que está equipado. Um item comprado nunca some.
Uma aba "MEU INVENTÁRIO" para equipar e desequipar.

4. Itens que o paciente não tem saldo para comprar aparecem esmaecidos, com o
preço em vermelho e o texto "FALTAM 45 FICHAS".

Pronto quando: eu comprar a moldura de sirene, equipar, e o Recruta ver a
minha moldura piscando no card do /match dele.

Não altere as regras de ganho de pontos.
```

---

## O que dá para fazer sem gastar crédito nenhum

O código está no GitHub e o Lovable sincroniza o que chega na branch conectada.
Tudo que é front-end puro pode ser escrito direto no repositório, sem passar
pelo chat do Lovable:

- A logo e o tamanho dos ícones da barra (dia 1, crédito 1)
- Os renomes e a curva de dificuldade do Teste de Sobriedade (dia 1, crédito 3)
- Os 10 laudos automáticos do perfil (dia 2, crédito 2)
- Os textos e preços da loja (dia 3, crédito 4)
- O borrão e o contador regressivo do embargo, depois que o servidor estiver
  recusando (dia 2, crédito 3)

São uns 6 créditos de economia, mais de um dia inteiro de orçamento. Use os
créditos do Lovable no que depende de banco, RLS e realtime, que é onde a IA
dele realmente ajuda.

## Ordem que não pode mudar

Carteira de pontos antes de ranking, loja, aposta e prenda. Se você fizer o
ranking antes da carteira, vai refazer o ranking.
