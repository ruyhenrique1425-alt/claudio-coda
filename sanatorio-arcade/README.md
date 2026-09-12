# Sanatório Arcade

App de festa com tema de sanatório. O convidado preenche uma ficha de admissão,
monta um avatar pixelado e é "internado". Daí em diante joga no arcade, ganha
fichas, compra moldura, manda prenda para outro paciente, aposta em desafio,
deixa recado no mural e registra fotos que ninguém vê antes da hora.

PWA instalável, feito para o celular e para um sítio com sinal ruim: abre sem
internet, guarda o que você fez e envia sozinho quando o sinal volta.

## Telas

| Rota         | O que faz                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `/`          | Ficha de admissão, radar dos diagnósticos, laudo, extrato de fichas e alta médica                                              |
| `/arcade`    | Seis minigames: Sueca Bêbada, Bafômetro de Dedo, Teste de Sobriedade, Roleta Etílica, Terapia de Choque e Detector de Mentiras |
| `/match`     | Compatibilidade, curtida com aviso ao vivo, prenda alcoólica e desafio valendo fichas                                          |
| `/ranking`   | Placar ao vivo de fichas ganhas; o pódio congela às 3:33 do dia 30/10                                                          |
| `/loja`      | Molduras, adereços e efeitos de nome comprados com fichas                                                                      |
| `/camera`    | Foto direto da câmera; a imagem só é revelada em 30/10 ao meio-dia                                                             |
| `/mural`     | Recados para Camarão, Recruta e Canela, lacrados até a mesma hora                                                              |
| `/panico`    | Contador coletivo ao vivo: 5.000 cliques disparam o alerta                                                                     |
| `/q/:codigo` | O que os QR codes abrem: cena animada do Coringa e a conquista (sem exigir ficha)                                              |
| `/qrcodes`   | Folha dos cinco QR codes para imprimir (rota de organizador, fora da barra)                                                    |

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
`fotos`, `botao_panico`, `transacoes`, `gastos`, `curtidas`, `desafios`,
`prendas` e `premiacao`; views `pacientes_publicos` e `saldo_pacientes`;
bucket de storage `galeria`.

Regra que vale para tudo que envolve fichas: o cliente não escreve pontos.
A tabela `pacientes` não tem `SELECT` público, porque guarda o `token` de cada
paciente, e toda movimentação passa por uma função `SECURITY DEFINER` que
valida o par (`paciente_id`, `token`). `MELHORIAS.md` detalha os tetos e as
regras antifraude.

## Modo sítio

O app foi feito para uma festa longe da cidade. O casco fica em cache, as
fontes são servidas pelo próprio app, as leituras ficam guardadas no IndexedDB
e toda escrita passa por uma fila que sobe sozinha quando o sinal volta, com
chave de idempotência para o reenvio não duplicar nada. Com sinal fraco o app
fecha os websockets e espaça as consultas. `MELHORIAS.md` detalha.

## Segredos

`.env` está no `.gitignore`. Nunca versione chaves: use `.env.example` como
modelo. Se alguma chave já vazou em um commit, rotacione no painel do Supabase.
