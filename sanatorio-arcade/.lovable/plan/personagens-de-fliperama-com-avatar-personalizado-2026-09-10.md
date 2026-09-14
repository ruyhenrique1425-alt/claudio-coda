# Personagens de Fliperama com Avatar Personalizado

## O que vamos criar

Uma etapa de **seleção de personagem** no estilo tela de "Character Select" dos fliperamas dos anos 80/90, mais um editor onde cada jogador monta o próprio boneco em pixel art. O avatar acompanha o jogador pelo app e é visto por todos.

## Fluxo do jogador

```text
Ficha (nome + 15 pontos)
        v
SELECIONE SEU PACIENTE   -> grade de bonecos piscando, moldura neon no escolhido
        v
PERSONALIZAR             -> cor da roupa, cor do cabelo, acessorio, expressao, item na mao
        v
CONFIRMAR DIAGNOSTICO    -> salva no banco e no celular, segue para o Arcade
```

## Personagens base (6 bonecos)

Desenhados em pixels dentro do app (nada de imagens externas), todos com corpo, cabeça, rosto e uma mão à mostra:

- O Interno
- A Enfermeira do Caos
- O Coringa de Plantão
- O Segurança Dorminhoco
- A DJ do Isolamento
- O Doutor Duvidoso

## Personalização

- **Cor da roupa**: verde neon, roxo, amarelo, branco, vermelho
- **Cor do cabelo**: mesma paleta
- **Acessório**: nenhum, chapéu, óculos escuros, máscara do Coringa, faixa de hospital
- **Expressão**: sorriso caótico, olhar vazio, surpresa, sério
- **Item na mão**: cerveja, cigarro, raquete de tênis, lata de energético (ou nada)

Tudo com pré-visualização ao vivo, grande, no centro da tela, e botões de seta estilo arcade para trocar cada opção. Botão "SORTEAR" para montar um boneco aleatório.

## Onde o avatar aparece

- **Match**: no card de cada paciente, ao lado do nome e dos status
- **Mural**: ao lado de cada mensagem, junto do nome de quem escreveu
- **Câmera**: ao lado da legenda de cada foto
- **Ficha**: no topo, com um botão "Trocar personagem"

Quem se internou antes do avatar existir aparece com um boneco neutro padrão.

## Detalhes técnicos

**Banco**: nova migração adicionando à tabela `pacientes` as colunas `personagem` (text) e `avatar` (jsonb) com valores padrão, sem quebrar as fichas já existentes. As policies e grants atuais continuam valendo (leitura e inserção públicas).

**Componente do avatar**: `src/components/avatar/PixelAvatar.tsx` — renderiza o boneco a partir de uma matriz de pixels por personagem, usando tokens de cor do design system (`src/styles.css`), com tamanhos `sm`, `md`, `lg` e animação leve de respiração. Catálogo em `src/components/avatar/personagens.ts` (sprites, paletas, acessórios, expressões, itens).

**Editor**: `src/components/avatar/EditorAvatar.tsx` (grade de seleção + controles), consumido pela rota `/` depois da distribuição de pontos.

**Persistência**: `src/lib/paciente-local.ts` ganha `personagem` e `avatar` no `Prontuario` (chave `paciente_sanatorio`), com leitura tolerante a fichas antigas. `internarPaciente` em `src/lib/sanatorio.functions.ts` passa a gravar os dois campos; `listarPacientes`, `listarMural` e `listarFotos` passam a devolver o avatar do autor para renderizar nos feeds.

**Design system**: fundo preto, títulos em Press Start 2P, acentos verde neon/roxo/amarelo, molduras e scanlines já existentes; sem cores fixas em componentes.
