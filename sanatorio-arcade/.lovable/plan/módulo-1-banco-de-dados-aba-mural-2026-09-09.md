# Módulo 1 — Banco de dados + aba Mural

Ativar o backend (Lovable Cloud), gravar as fichas de admissão no banco e transformar o Mural em um feed de recados funcional.

## 1. Backend e tabelas

Ativo o Lovable Cloud e crio duas tabelas:

- `pacientes`: `id` (uuid, PK), `nome` (text), `fator_coringa`, `imunidade_etilica`, `inimigo_do_fim`, `aptidao_audio`, `amnesia_anterograda` (int, com limites 0–10 e soma máxima de 15 validada no banco), `created_at` (timestamptz).
- `mural`: `id` (uuid, PK), `destinatario` (text, restrito a Camarão / Recruta / Canela), `mensagem` (text, 1–280 caracteres), `autor` (text), `created_at` (timestamptz).

Fase de testes sem login: RLS ativo com políticas que permitem leitura e inserção anônimas nessas duas tabelas (sem update/delete), mais os grants necessários. Índice em `mural(destinatario, created_at desc)` para o feed.

Observação honesta: nesta fase qualquer visitante pode inserir e ler recados — é o que o teste pede. Quando o app for para a festa de verdade, vale trocar por login anônimo do próprio Cloud para amarrar cada recado a um paciente.

## 2. Tela de Admissão (`/`)

- "CONFIRMAR DIAGNÓSTICO" passa a gravar a ficha no banco (nome + os 5 atributos).
- Botão com estado de carregando ("INTERNANDO…"), bloqueado durante o envio para não criar ficha duplicada.
- Em caso de sucesso: salvo `paciente_id` e o nome no armazenamento do celular, mostro rapidamente a confirmação de internação e sigo automaticamente para `/mural`.
- Em caso de falha: mensagem de erro no visual do app e opção de tentar de novo, sem perder os pontos distribuídos.
- Quem já tem `paciente_id` salvo continua vendo a tela de "Paciente Internado", com "Ir para o Mural" e "Refazer triagem" (refazer cria uma nova ficha).

## 3. Aba Mural (`/mural`)

- Substituo o placeholder por três abas (shadcn/ui `Tabs`): Camarão, Recruta, Canela — no visual 8-bits/neon.
- Cada aba tem um cabeçalho de "arquivo confidencial" (nome do morador, código do prontuário, contagem de registros) e abaixo o feed de recados, do mais recente para o mais antigo, com autor e horário.
- Formulário fixo na parte de baixo (acima da barra de navegação): input de mensagem + botão de envio estilo arcade, com estado de carregando e envio bloqueado enquanto grava; input vazio não envia.
- O autor vem do nome salvo no celular; sem ficha preenchida, o Mural mostra um aviso para passar pela triagem primeiro.
- Estados tratados: carregando o feed, feed vazio ("nenhum registro neste prontuário") e erro de leitura com botão de recarregar.

## Detalhes técnicos

- Migração SQL cria as tabelas, GRANTs para `anon`/`authenticated`/`service_role`, RLS e políticas de SELECT/INSERT para `anon`.
- Leituras e escritas via `createServerFn` públicas (sem `requireSupabaseAuth`), chamadas com TanStack Query (`useQuery` para o feed por aba, `useMutation` + `invalidateQueries` para o envio) — nada de dados sensíveis expostos.
- Feed atualizado após cada envio (invalidação da query) e no foco da aba; realtime fica para depois, se você quiser.
- localStorage: mantém `sanatorio:paciente` (nome + atributos) e passa a guardar também `paciente_id`.
- Validação de entrada com zod nas server functions, espelhando as restrições do banco.
