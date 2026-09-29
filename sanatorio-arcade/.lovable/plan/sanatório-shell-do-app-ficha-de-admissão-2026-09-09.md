# Sanatório — Shell do app + Ficha de Admissão

App mobile-first (estética sanatório / arcade 80s / Coringa / Johnnie Walker), tudo em estado local por enquanto — sem banco de dados.

## Design system

- Fundo preto sólido com camada sutil de grid verde escuro + scanlines CRT (overlay fixo, não intercepta toque).
- Tokens semânticos em `src/styles.css`: verde neon, roxo profundo, amarelo whisky, branco/cinzas de texto, sombras/glow neon.
- Fontes via `<link>` no `__root.tsx`: "Press Start 2P" (títulos e botões) + Inter (texto corrido). Tokens `--font-display` / `--font-sans`.
- Barras de rolagem nativas ocultas, área de toque mínima de 44px, safe-area no rodapé.

## Navegação

- `__root.tsx` recebe o shell: Header fixo + Bottom Navigation fixa (lucide-react) + `<Outlet />` com transição suave.
- Logo: emblema alinhado verticalmente e integrado à base do nome "Sanatório", em bloco único — sem elementos flutuantes.
- Abas: Ficha (`/`, User), Mural (`/mural`, MessageSquare), Câmera (`/camera`, Camera), Arcade (`/arcade`, Gamepad2).
- Mural, Câmera e Arcade: telas placeholder no mesmo visual ("módulo em quarentena").

## Tela inicial — Triagem (`/`)

- Prontuário de admissão em estilo RPG retro: campo "Nome de Paciente" + 5 atributos.
- Atributos: Fator Coringa, Imunidade Etílica, Inimigo do Fim, Aptidão para Mandar Áudio, Amnésia Anterógrada.
- 15 pontos para distribuir; botões [-] / [+] estilo arcade; contador "Pontos Restantes" em tempo real; barras de progresso por atributo.
- Regras aplicadas no estado (não só visual): nunca abaixo de 0, soma nunca acima de 15, botões desabilitados nos limites — cliques rápidos não conseguem furar o limite.
- "CONFIRMAR DIAGNÓSTICO" só habilita com nome preenchido e 0 pontos restantes; grava o JSON no localStorage e troca para a tela "PACIENTE INTERNADO" mostrando os status finais, com opção de refazer a ficha.
- Ao reabrir o app, se já houver ficha salva, abre direto no estado internado.

## Detalhes técnicos

- Rotas TanStack: `src/routes/index.tsx` (reescrita, remove o placeholder), `mural.tsx`, `camera.tsx`, `arcade.tsx`.
- `framer-motion` (Motion for React) para entrada dos cards, feedback dos botões e transição triagem → internado.
- Componentes novos em `src/components/`: `AppShell` (header + bottom nav), `Logo`, `CrtOverlay`, `AttributeRow`, `ArcadeButton`.
- Persistência: `localStorage` chave `sanatorio:paciente`, leitura só após hidratação (evita divergência de SSR).
- `head()` próprio por rota com título/descrição/OG específicos.
