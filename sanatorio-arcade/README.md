# Sanatório Arcade

App de festa com tema de sanatório. O convidado preenche uma ficha de admissão,
monta um avatar pixelado e é "internado" — daí em diante tem arcade, mural de
recados, galeria de fotos, match entre pacientes e um botão do pânico coletivo.

Feito para rodar no celular, todo mundo do próprio aparelho.

## Telas

| Rota      | O que faz                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------ |
| `/`       | Ficha de admissão: nome, 15 pontos entre 5 diagnósticos, escolha de personagem                   |
| `/arcade` | Quatro minigames: Roleta Etílica, Genius do Manicômio, Diagnóstico Cruzado, Detector de Mentiras |
| `/mural`  | Recados para Camarão, Recruta e Canela, com atualização automática                               |
| `/camera` | Foto direto da câmera, enviada para a galeria da festa                                           |
| `/match`  | Compatibilidade entre pacientes calculada sobre os cinco diagnósticos                            |
| `/panico` | Contador coletivo ao vivo: 5.000 cliques disparam o alerta                                       |

## Stack

TanStack Start · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase
(Postgres, Storage e Realtime) · Vite.

## Rodando local

```sh
npm install
cp .env.example .env   # preencha com os dados do seu projeto Supabase
npm run dev
```

Outros comandos: `npm run build`, `npm run lint`, `npm run format`.

## Banco

As migrações ficam em `supabase/migrations/`. Tabelas: `pacientes`, `mural`,
`fotos`, `botao_panico`; bucket de storage `galeria`; função
`incrementar_panico(_qtd)` para o contador.

Todas as tabelas estão com RLS ligado e políticas abertas para `anon` — é uma
festa, não um banco. Se o app for ficar no ar depois do evento, veja
`MELHORIAS.md`.

## Segredos

`.env` está no `.gitignore`. Nunca versione chaves: use `.env.example` como
modelo. Se alguma chave já vazou em um commit, rotacione no painel do Supabase.
