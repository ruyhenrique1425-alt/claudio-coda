## O que vou ajustar

### 1. Inventário, Reposição e Recolhimento de vazios — sempre confirmar sucesso e permanecer na tela

Arquivo: `src/routes/app.bars.$barId.tsx`

- **Inventário (`InventorySection.submit`)**
  - Remover o `setTimeout(() => nav({ to: "/app" }), 800)` que sai da tela do bar (isso está sendo percebido como "recarregou/errou"). Após salvar, permanecer na aba de inventário do próprio bar.
  - Se o insert de `inventory_items` falhar após o `inventories` ter sido criado, fazer rollback do `inventories` para não deixar registro órfão (hoje mostra erro mas fica lixo no banco).
  - Trocar `if (error) return toast.error(...)` por `throw error` dentro do `try` — assim o fallback offline captura falhas de rede e o `toast.error` final só dispara para erros reais.
  - Toast de sucesso claro: "✓ Inventário registrado" (sem mensagem de redirecionamento).

- **Reposição (`RefillSection.submit`)** e **Vazios (`CollectEmptiesSection.submit`)**
  - Mesmo tratamento: converter `if (error) return toast.error(...)` em `throw error` para o `catch` decidir entre fila offline e mensagem de erro real.
  - Garantir toast de sucesso único ("✓ Reposição registrada" / "✓ Vazios recolhidos") e manter o usuário na mesma aba, apenas atualizando os dados via `onDone()` / `load()`.
  - No refill, se `refill_items` ou `empties_removed` falharem, capturar o erro e avisar (sem quebrar a tela).

### 2. Abrir um bar sem "ESTA TELA NÃO CARREGOU"

Arquivo: `src/routes/app.bars.$barId.tsx`

- Adicionar `errorComponent` e `pendingComponent` ao `createFileRoute("/app/bars/$barId")` para que qualquer erro renderize um cartão amigável com botão "Tentar novamente" (chama `router.invalidate()`), em vez do fallback global do `ErrorBoundary`.
- Envolver as chamadas dentro de `loadAll()` em `try/catch`: em caso de falha, exibir toast e um estado de erro local com botão "Tentar novamente" (sem crashar o componente e sem redirecionar). Nunca deixar uma exceção subir para o ErrorBoundary a partir do carregamento inicial.
- Tratar `bar == null` (id inexistente) já existe; manter, mas melhorar mensagem.

### 3. Dashboard sempre em ordem alfabética

Arquivo: `src/routes/app.index.tsx`

- Substituir a ordenação atual de `sorted` (que prioriza `no_inv` → `refill` → `ok`) por ordem alfabética simples e estável por nome, independentemente do status:
  ```ts
  const sorted = [...rows].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
  );
  ```
- Manter todos os selos/pills e o bloco "ALERTAS DE REPOSIÇÃO" no topo (que já destaca urgência), então a informação de prioridade continua visível sem alterar a ordem da lista principal.

### 4. Verificação

- Rebuild + typecheck automático.
- Testar via Playwright em `/app`: confirmar ordem alfabética.
- Testar via Playwright em `/app/bars/:id`: abrir um bar existente, submeter um inventário (sem foto para forçar erro de validação — deve ver toast e não crash; com foto — deve ver toast de sucesso e continuar na tela).

Sem mudanças no schema do banco.