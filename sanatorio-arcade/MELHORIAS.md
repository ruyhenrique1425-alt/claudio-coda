# O que foi construído

Todas as 11 melhorias do plano estão no código, mais um quinto minigame.
`npx tsc --noEmit`, `npm run lint` e `npm run build` passam.

## Identidade e carteira de pontos

A internação virou a função `internar_paciente` no Postgres. Ela devolve um
`token` que fica no aparelho do paciente e funciona como senha: toda operação
que mexe em fichas exige o par (`paciente_id`, `token`).

O cliente não escreve pontos. Nunca. Quem escreve são as funções
`creditar_pontos`, `transferir_pontos`, `gastar_pontos`, `curtir`,
`mandar_prenda`, `responder_prenda`, `criar_desafio`, `responder_desafio` e
`jogar_desafio` — todas `SECURITY DEFINER`, todas validando o token. A tabela
`pacientes` perdeu o `SELECT` público (o token mora nela); a leitura passou
para a view `pacientes_publicos`.

Dois números, não um:

- `ganhos_total` só sobe. É o que vale para o ranking e o prêmio.
- `saldo` sobe e desce. É o que dá para apostar, doar e gastar na loja.

Doação recebida não entra em `ganhos_total`, então não adianta três amigos
zerarem a conta para um só levar o prêmio.

Tetos que o servidor impõe: 300 fichas por hora em cada jogo, um QR code do bar
pontua uma vez por paciente, uma prenda a cada 15 minutos para o mesmo alvo,
prenda de no máximo 3 segundos, e nenhum desafio sem que os dois lados tenham
saldo.

## Os cinco jogos

**Bafômetro de Dedo** (novo). Dez segundos martelando a garrafa e três
segurando o dedo parado no alvo. A agulha do mostrador sobe com a velocidade;
a nota final é 70% velocidade e 30% firmeza. Toque a menos de 140ms encadeia
combo. Vale até 50 fichas.

**Teste de Sobriedade** (era Genius do Manicômio). A cada rodada vencida os
tempos encolhem 12%, com piso em 140ms. Da rodada 8 em diante a tela treme e a
cor apaga antes do previsto, então não dá para contar o ritmo — tem que olhar.
Uma barra mostra o quanto já acelerou. Quatro laudos por faixa de rodada.
8 fichas por rodada.

**Roleta Russa Etílica**. Sorteio ponderado: castigo leve sai mais, castigo
pesado sai menos, e as duas fatias douradas que pagam fichas (25 e 50) são as
mais raras. A roda para um pouco fora do centro da fatia, para não parecer
roteirizada.

**Terapia de Choque** (era Diagnóstico Cruzado). A missão agora tem relógio de
dois minutos e o paciente escolhe o nível: Ambulatorial (10 fichas),
Internação (20) ou Eletrochoque (35). Dezesseis missões escritas.

**Detector de Mentiras**. Mantido, agora pagando 8 fichas por análise.

## Ranking e premiação

`/ranking` lê a view `saldo_pacientes` e se reordena sozinho por realtime,
com animação de troca de posição. Pódio dourado, prateado e bronze.

Contador regressivo até 30/10 às 03:33 (Brasília). Quando zera, a função
`apurar_premiacao` congela os três primeiros na tabela `premiacao` — o
resultado não depende do relógio do celular de ninguém, e uma vez gravado não
muda mais.

## Match

Card com avatar, moldura comprada, nome com efeito, número do leito, os cinco
atributos e a compatibilidade em porcentagem sobre todos eles.

Curtir insere em `curtidas`. Quem foi curtido recebe o aviso no sino em tempo
real; se a curtida for mútua, os dois veem o modal de match com a prescrição
de ir ao bar. Uma aba filtra só os matches.

Dois botões a mais em cada card:

- **Prenda**: o dado de seis faces com três resultados (1, 1, 2, 2, 3, 3) é
  rolado no servidor, então ninguém força o 3. Cumpriu, leva 10 fichas por
  segundo; passou, quem mandou leva 5.
- **Desafiar**: par ou ímpar valendo 10, 25 ou 50 fichas. Cada um manda um
  número de 0 a 5 sem ver o do outro, a soma decide, quem desafiou fica com o
  par. Sem resposta em 60 segundos, o desafio expira e ninguém perde nada.

## Loja

Onze itens em três slots: cinco molduras, quatro adereços e dois efeitos de
nome. Tudo desenhado em CSS, sem imagem externa. Prévia ao vivo no avatar do
próprio paciente, e o que estiver equipado aparece no card dele no match, no
ranking e no mural.

## Embargo até 30/10 ao meio-dia

O embargo está onde vale: `listarFotos` não gera URL assinada nenhuma antes da
data, e `listarMural` devolve `mensagem: null` com só o comprimento do texto.
Abrir o inspetor do navegador não adianta — a foto e o texto não saem do
servidor.

Na tela: bloco preto com ruído e pixelização, o avatar de quem registrou por
cima, o nome, a atividade e o contador regressivo. O recado vira blocos
borrados do tamanho da frase original. Depois da data tudo abre sozinho, sem
precisar de deploy novo.

## Alta médica

Liberada só entre 22h e 7h. Fora da janela o botão aparece travado com o
contador até as 22h.

No lugar da assinatura, o carimbo do polegar: a pessoa pressiona e segura por
dois segundos e a digital cresce debaixo do dedo, com barra de progresso. Se
soltar antes, recomeça.

Depois vem o flash verde e roxo com a risada do Coringa, e o cupom ALTA333 em
formato de ticket serrilhado piscando, com a instrução de tirar o print (o
navegador não deixa o app salvar a imagem sozinho).

## Casca

Logo da República Sanatório com o escudo alinhado na vertical e a cruz amarela,
sem nada flutuando. Ícones da barra inferior de 20px para 26px, área de toque
de 68px, e a barra rola na horizontal porque oito abas não cabem numa linha de
360px. PWA instalável: manifest, service worker, ícones gerados (inclusive o
maskable) e as metatags que fazem o iPhone abrir em tela cheia. Banner de
instalação com o caminho certo em cada sistema.

## O que ficou de fora

O QR code do bar tem a coluna e a regra no banco (`motivo = 'qrcode'`, uma
leitura por paciente), mas a rota `/scan` com leitor de câmera não foi feita.
É o próximo pedaço natural.
