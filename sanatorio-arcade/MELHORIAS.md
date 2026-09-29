# O que foi construído

Todas as 11 melhorias do plano estão no código, mais dois minigames novos, as
cinco quests de QR code e o modo sítio, que faz o app funcionar com pouco ou
nenhum sinal.
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

## Dois defeitos corrigidos

**A barra inferior escondia metade do app.** Ao entrar Ranking e Loja, a barra
passou a ter oito abas e eu a fiz rolar na horizontal. Numa tela de 390px isso
empurrava Câmera, Mural e Pânico para fora do campo de visão: do lado de quem
usa, essas telas tinham sumido. Nenhum arquivo foi apagado — a navegação é que
escondia. Agora são sete colunas iguais, ocupando a largura inteira sem
rolagem: os seis destinos originais na ordem de sempre (Ficha, Mural, Câmera,
Match, Arcade, Pânico) mais um botão "Mais" que abre Ranking e Loja numa
gaveta, com nome e explicação. Em 360px a barra mede exatos 360px.

**Foto registrada por insert direto.** A migração do modo sítio revogou o
INSERT em `fotos` para obrigar a chave de idempotência, mas `registrarFoto`
continuou fazendo insert direto — ia falhar por permissão na hora de enviar
foto. Agora chama a função `registrar_foto`, como o resto.

**Tipos alinhados com o gerador do Supabase.** O gerador declara argumento
opcional de função como `nome?: tipo`, sem `| null`. Onde o código mandava
`null` (referência do jogo, legenda da foto, chave do recado, item a
desequipar), a chave passa a ser omitida: o Postgres aplica o DEFAULT, o efeito
é o mesmo e a compilação fecha mesmo depois de o Supabase regenerar os tipos.
Para desequipar continuar funcionando com a chave omitida, a função
`equipar_item` ganhou `DEFAULT NULL` no argumento do item (migração
`20260913080000`).

## A marca e a leitura no escuro

**O brasão de verdade.** A logo da república entrou no lugar do símbolo que eu
tinha desenhado: o arco REPÚBLICA, o caminhante roxo com a bengala, os ramos e
a fita SANATÓRIO. Ela foi recortada da arte original, teve o fundo branco
removido e ganhou uma versão para tela preta, com o preto virado em creme —
senão a fita sumiria no fundo do app. Está em `public/marca/`, e os ícones do
PWA e o favicon saem dela.

O brasão grande abre a ficha de admissão, que é a primeira tela; no cabeçalho
fica a versão compacta de 44px ao lado do nome.

**Contraste para o escuro da pista.** O cinza do texto secundário subiu de
0.68 para 0.82 de luminosidade. Com o brilho baixo, o olho cansado e a tela
suja, o tom anterior desaparecia contra o preto. As bordas e os campos também
subiram.

**Ícones maiores.** A barra inferior foi de 26px para 32px, com alvo de toque
de 76px de altura e 70px de largura, e o traço do item ativo engrossou. É a
diferença entre acertar a aba em pé, segurando um copo, e errar.

**Canto pixelado.** Botões e cartões de seção passaram a ter o canto cortado em
três degraus de 3px: de longe parece arredondado, de perto continua sendo
pixel. Como o `clip-path` corta a borda junto, a moldura é desenhada por baixo
num pseudo-elemento com o mesmo recorte, então o contorno acompanha o degrau em
vez de deixar o canto aberto. Botões pequenos usam degrau de 2px, senão um
quadrado de 44px vira octógono.

## Modo sítio: o app no meio do mato

A festa é longe da cidade e o sinal vai e volta. O app parte dessa premissa em
vez de tratar a falta de sinal como erro.

**Nada se perde sem sinal.** Toda ação que muda dado no servidor passa antes
por uma fila no IndexedDB (`src/lib/fila.ts`): ficha de jogo, recado do mural,
foto e curtida. Com sinal, sobe na hora e o paciente nem percebe a fila. Sem
sinal, fica guardada no aparelho e sobe sozinha na próxima brecha: ao voltar o
sinal, ao abrir o app e a cada 45 segundos.

**Reenvio não duplica.** Cada item da fila leva uma chave de idempotência
gerada no celular. O banco tem índice único nessa chave, então o "timeout" que
na verdade chegou não vira ponto creditado duas vezes quando a fila tentar de
novo. Isso está na migração consolidada `20260913032203` (as duas migrations
anteriores que definiam a mesma coisa foram removidas por ficarem redundantes
com ela).

**O app abre sem sinal.** O service worker guarda o casco (HTML, JS, CSS,
fontes e ícones) e serve do cache. Na navegação ele tenta a rede com prazo de 8
segundos e cai para a cópia da rota; offline, nem tenta. Cada rota é guardada
sob a própria URL: servir o HTML da home numa URL de `/arcade` fazia o React
descartar a página inteira e desenhar do zero.

**As fontes viajam junto.** Press Start 2P e Inter são servidas pelo próprio
app (`src/fontes.css`, 164 KB nos subsets latin). Uma requisição ao Google que
falha no sítio é meia tela sem tipografia.

**O que já foi lido continua na tela.** As respostas de cada consulta são
copiadas para o IndexedDB e devolvidas na abertura seguinte, mesmo sem sinal
(`src/lib/cache-consultas.ts`). Abrir o app offline mostra o último ranking e o
último mural em vez de tela vazia.

**Sinal fraco desliga o que não aguenta.** Websocket em 2G não entrega e ainda
fica tentando reconectar, comendo bateria numa festa que vai até o sol raiar.
Com sinal fraco o app fecha os canais de realtime e troca por consulta
espaçada; quando o sinal melhora, religa sozinho (`src/lib/realtime.ts`). Os
intervalos de recarga do mural e do match também mudam com o sinal, e sem sinal
nem tentam.

**Foto comprimida antes de sair.** A foto crua passa de 4 MB e num sinal de
sítio é uma fila que nunca anda. Reduzida para 1280px e JPEG 0.7 fica em torno
de 200 KB (`src/lib/imagem.ts`).

**O pânico manda em lotes.** Até 10 cliques por requisição, e só com sinal. O
contador da tela anda na hora de qualquer jeito; o número real se acerta no
próximo lote.

**A faixa de estado só aparece quando importa.** Com sinal bom e nada na fila,
não há o que avisar. Sem sinal ela diz o que está guardado, e com sinal fraco
mostra quantos itens estão subindo, com botão de tentar agora.

Duas coisas continuam exigindo sinal, e a tela diz isso: a prenda alcoólica e o
desafio de cachaça. Os dois são interativos e com prazo — a pessoa do outro
lado precisa receber o aviso na hora.

## Os seis jogos

**Sueca Bêbada** (novo). Dois baralhos sem coringa, 104 cartas, um celular no
meio da mesa. Vira a carta e todo mundo lê a regra do valor: ás a 3 escolhem
quem bebe, 4 é Stop, 5 é o jogo da memória, 7 é o jogo do Pi, 10 é cafofo, J
pega quem está à esquerda, Q e K pegam a mesa inteira. O 8 abre um campo para a
mesa escrever a Regra Geral, que fica fixa na tela até outro 8 aparecer. O 6 e
o 9 vão para a sua mão e ficam lá até você usar o gesto. Roda inteira sem
sinal.

Uma nota sobre as regras: a fonte descreve o 6 e o 9 como a mesma continência,
e a explicação do 9 está truncada no original. Aqui o 6 é a continência na
testa e o 9 é o dedo no nariz, para as duas cartas guardadas não fazerem a
mesma coisa. Se a mesa de vocês joga diferente, está tudo em
`src/components/arcade/sueca.ts`.

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

## As cinco quests de QR code

Cada código vive num lugar e abre uma cena animada do Coringa, desenhada em
blocos e animada por transformação — nenhuma imagem para baixar, e roda com o
app offline.

| Código     | Onde fica                            | A cena                                         | Fichas |
| ---------- | ------------------------------------ | ---------------------------------------------- | ------ |
| `bemvindo` | Instagram da Sanatório, um dia antes | Portões abrindo e cartas caindo                | 40     |
| `van`      | Dentro da van dos convidados         | Ele ao volante, van balançando, poste passando | 30     |
| `bar`      | No bar                               | Virando o copo até o fim, espuma transbordando | 30     |
| `xeque`    | Na mesa de xadrez                    | A peça caindo e a coroa piscando               | 30     |
| `privada`  | No banheiro                          | Porta da cabine abrindo, papel desenrolando    | 30     |

O QR aponta para `/q/<codigo>`. A rota **não exige ficha**: quem lê o código
antes de se internar vê a cena na hora e a conquista fica guardada no aparelho,
creditada assim que o prontuário existir. É o caso do primeiro código, que sai
no Instagram um dia antes da festa.

Ler o mesmo código duas vezes não paga duas vezes: o banco tem índice único por
(paciente, código).

Para imprimir, a rota `/qrcodes` desenha os cinco no navegador, com correção de
erro alta — papel de bar amassa e molha. Ela não aparece na barra de navegação.

O inventário no prontuário mostra os cinco espaços, os achados acesos e os que
faltam esmaecidos, com a dica de onde procurar.

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

## O perfil que sumia

Quem tinha prontuário salvo e recarregava a página caía na tela de erro e
precisava se cadastrar de novo. O localStorage estava certo; o que quebrava era
o Supabase, que devolve o canal existente quando o nome se repete, e chamar
`.on()` num canal já inscrito levanta exceção, derrubando a página inteira.
Cada inscrição usa nome único, e falha de canal cai para consulta em vez de
derrubar a tela.

## Rodada de refino (setembro/2026)

**Avisos entre pacientes.** Match, desafios, prendas, doações e ranking agora
avisam: um sino com toast e vibração quando alguém curte de volta, dá match,
manda ou responde uma prenda, aceita ou recusa um desafio, doa fichas, ou
quando a sua posição no ranking muda (pódio, ultrapassagem, marco de fichas).
O ranking pisca a linha de quem subiu ou caiu. Todo o histórico de decisão
desse recurso está em `.lovable/plan/avisos-entre-pacientes-match-e-ranking-2026-09-15.md`.

**Navegação.** A Ficha foi para dentro do menu "Mais", junto com Ranking e
Loja: é a tela que se visita uma vez para internar e pouco depois — cede lugar
para as cinco telas de uso diário (Mural, Câmera, Match, Arcade, Pânico), que
ficam sempre a um toque.

**Ordem do arcade.** Roleta Russa Etílica e Terapia de Choque foram para o
topo da lista: são os dois jogos de entrada mais fácil (giro de roleta, missão
social), os que a mesa costuma pedir primeiro quando ninguém sabe por onde
começar.

**Fichas e XP num só relance.** A carteira compacta (a que aparece no topo das
telas) só mostrava fichas — o mesmo número que também é gasto na loja. Ela
ganhou um segundo indicador ao lado, com o ícone de estrela, mostrando o XP
(`ganhos_total`): o número que vale para o ranking e só sobe, mesmo quando o
saldo de fichas cai por uma compra ou aposta perdida.

**Avatar com relevo.** Os pixel-arts dos personagens ganharam contorno de 1px
ao redor de toda a silhueta e um bisel sutil (luz num canto, sombra no outro)
nos tamanhos médio e grande — sem imagem nova, só CSS em cima da mesma grade
14x16. O sorriso padrão, que lia como um traço reto (bigode), agora tem os
cantos levantados. A expressão de surpresa ganhou sobrancelhas arqueadas.

**Adereços da loja passaram a aparecer no avatar.** Cone de trânsito, copo
americano, óculos escuros e sorriso do Coringa — comprados na loja no slot
"adereço" — eram cosméticos sem efeito visual nenhum. Agora sobrepõem pixels
no boneco (cabeça, mão ou boca, conforme o item) em toda tela que mostra o
avatar do paciente: perfil, mural, câmera, match, ranking e loja.

**Realtime com filtro por paciente.** Carteira, extrato e desafios em jogo
escutavam a tabela inteira: a transação de qualquer pessoa na festa recarregava
a tela de todo mundo. Cada assinatura agora tem `filter` pelo `paciente_id` do
dono da tela, o que importa numa festa com dezenas de celulares abertos ao
mesmo tempo.

**Refino estético nos jogos.** Os painéis de resultado (Roleta, Terapia de
Choque, Teste de Sobriedade, Bafômetro e as regras da Sueca) passaram a usar o
mesmo `CartaoPixel` de canto em degraus do resto do app, em vez de caixas com
`border-2` reto.

**CSS morto removido.** `.canto-pixel` e `.caixa-pixel-plano`, utilitários sem
nenhuma referência no código, saíram de `styles.css`.

## Segunda rodada de refino (setembro/2026)

**Arcade reorganizado.** Detector de Mentiras saiu de vez — dependia do
`DeviceOrientationEvent`, que falha em silêncio em boa parte dos Android e
exige permissão por gesto a cada sessão no iOS, então era o jogo com maior
chance de simplesmente não funcionar na festa. Bafômetro de Dedo foi para o
fim da lista (é o que mais exige do dedo e da atenção). O Botão do Pânico
ganhou uma entrada na própria tela do arcade, na 4ª posição, que leva direto
para a tela dedicada — continua sem gastar fichas, é só caos em grupo.

**Sirene de mentira.** Um botão verde discreto no canto da tela do Pânico
dispara o mesmo efeito de tela cheia do alerta de verdade, mas só no aparelho
de quem apertou — não soma clique nenhum no contador coletivo. É pegadinha,
não faz parte do jogo real.

**Travada na troca de página, corrigida.** O contorno e o bisel do avatar
(drop-shadow empilhado + box-shadow em ~224 células por boneco) rodava em
qualquer tamanho `md` para cima. Como o Match e o mural/câmera (via
`RegistroEmbargado`) mostram vários avatares de uma vez em lista, cada troca
para essas telas pagava esse custo dezenas de vezes de uma só vez. Agora o
efeito só roda no avatar único (`size="lg"`) — Ficha, Loja, editor de
personagem — que nunca aparece em lista.

**`index.tsx` deixou de ser um componente-monolito.** As 418 linhas que
misturavam formulário de triagem, editor de avatar e resumo do paciente
internado viraram três peças: `TriagemForm` e `FichaInternado` (novos, em
`src/components/ficha/`) mais o `index.tsx` enxuto que só orquestra estado e
troca entre elas.

**Migrations duplicadas, consolidadas.** As duas migrations que eu tinha
escrito antes de existir uma migration "oficial" consolidada
(`20260911120000_economia_sanatorio.sql` e
`20260912090000_offline_idempotencia.sql`) saíram do repositório — tudo que
elas definiam já está, palavra por palavra ou de forma equivalente, na
`20260913032203`, que passou a citar isso no próprio cabeçalho. O mesmo para
o fix duplicado de `equipar_item`.

**Testes automatizados.** Vitest entrou no projeto (`npm test`), com 64 testes
cobrindo a lógica pura mais sensível a regressão: cálculo de afinidade do
Match, inventário da loja, montagem de pixels do avatar (incluindo a mistura
de customizações da oficina), avisos de ranking e o catálogo de conquistas
(incluindo a mistura com códigos do bar). Testar "tempo real" com dezenas de
celulares simultâneos ao vivo continua fora do alcance de um ambiente sem um
projeto Supabase real — o que dá para automatizar aqui é a lógica; a prova de
carga é na festa ou com um projeto de teste à parte.

**Auditoria de realtime.** O sino de avisos (match, prenda, desafio, doação)
montava seu canal direto, sem passar pelo `canalQuandoDerVerifica` que todo
outro canal do app usa — ou seja, não respeitava o "modo sítio": com sinal
fraco, ficava tentando reconectar o socket em vez de cair para consulta
espaçada, o oposto do que o resto do app faz de propósito para poupar
bateria. Corrigido. Ranking e o contador do Pânico continuam com listener sem
filtro por paciente, mas isso é inerente — qualquer transação pode mudar um
placar ou um contador coletivo, não tem paciente_id para filtrar.

**Falha real corrigida na crediticação de QR code.** `creditar_pontos`
aceitava qualquer valor de fichas que o cliente mandasse para o motivo
`qrcode`, sem checar se o código era de verdade — uma chamada direta à função
(fora do app, por quem soubesse o RPC) forjava até 100 fichas com qualquer
string como código. Agora o valor de fichas para QR code vem sempre do
servidor, lido da tabela `conquistas_bar`; o que o cliente manda é ignorado
para esse motivo.

**Oficina de personagens.** Nova tela em `/oficina` (dentro do menu "Mais" da
Ficha), protegida por senha, para editar nome, frase, cabeça, corpo, cores,
acessório e item padrão de cada um dos 6 bonecos — sem precisar mexer em
código. A senha padrão de fábrica é `sanatorio2026` (trocável direto no
banco, `UPDATE oficina_config SET senha = '...'`).

**Administração do bar.** Nova tela em `/bar-admin` (organizador, fora da
barra de navegação — mesmo padrão de `/qrcodes`), com a mesma senha da
oficina, para cadastrar novos códigos de QR code e a conquista de cada um,
sem depender de parâmetro de URL nem de reimportar o projeto. O código
cadastrado aparece automaticamente na folha de impressão de `/qrcodes` e no
inventário de sobrevivência de quem o encontrar.

**PWA (ícone e prompt de instalação).** Já estava tudo pronto de uma rodada
anterior — ícone próprio, manifest, meta tags de iOS/Android e o componente
`InstalarPwa` com prompt do Android e instruções manuais do iOS — só
confirmado que continua funcionando.

## Terceira rodada (setembro/2026)

**Instalação: fechar não é para sempre.** Quem fechava o banner de instalação
perdia o convite de vez (guardava num localStorage permanente). Agora fechar
só recolhe para um botão pequeno fixo no canto — continua ali, discreto, para
quando a pessoa quiser instalar mais tarde.

**Painel do organizador em `/admin-sanatorio`.** Tela nova, fora da barra de
navegação, protegida pela mesma senha da oficina e do bar: pacientes e fotos
recentes, nível de pânico ao vivo (mesma leitura e canal realtime da tela
`/panico`) e um botão para exportar o mural inteiro (os três moradores) em
CSV, com BOM para o Excel abrir acentuado sem sopa de letrinhas. Reaproveita
`listarPacientes`, `listarFotos` e `listarMural`, que já existiam para o
guest.

## Quarta rodada (setembro/2026) — mural, câmera e navegação

**Embargo fixo virou revelação rolante.** Fotos e recados não ficam mais
travados até uma data única da festa (30/10 ao meio-dia): agora toda foto e
todo recado aparece na hora, pra galera toda ver e interagir. Depois de uma
hora, quem postou vira anônimo (aparece "Paciente desconhecido" com uma
máscara no lugar do nome — o conteúdo continua ali) até o dia seguinte, hora
em que o autor volta a aparecer — o "quem fez isso ontem?" da manhã, todo
dia, em vez de um único grande momento no fim da festa. A lógica mora em
`estadoDoPost` (`lib/datas.ts`), calculada em cima do fuso de Brasília (não
do relógio do servidor nem do celular de quem está vendo), e testada em
`datas.test.ts`. `listarFotos`/`listarMural` decidem por linha, não mais
globalmente — o componente `RegistroEmbargado` (a versão antiga, "esconde
tudo até a data") saiu do código.

**Câmera com cara de câmera de novo.** O botão de anexar arquivo genérico
virou um visor de vigilância: moldura escura com cantos de mira, "REC"
piscando e um obturador redondo enorme no meio — o gesto físico ("aperte o
círculo") em vez de ler um rótulo de botão.

**Mural e Câmera reforçados na barra.** As duas ações que a festa inteira usa
o tempo todo ganharam um selo visual (fundo neon suave, ícone um pouco maior)
que as destaca das outras três mesmo paradas — não precisa estar na tela pra
notar que é ali que a ação acontece. Rótulos da barra também subiram de 7px
para 8px.

**Reações em fotos e recados.** Um coração simples (toggle, sem escolha de
emoji) em cada foto e cada recado, com contagem — tabela `reacoes` nova, RPC
`reagir` com o mesmo travamento por token de toda escrita do app. Otimista na
tela: reage na hora, desfaz sozinho se o servidor recusar.
