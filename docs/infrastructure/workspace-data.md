# Estado compartilhado e cache do workspace

O renderer guarda o estado compartilhado em uma store Zustand (`src/stores/workspace-store.ts`) com uma chave por `[workspace, campo]`. O valor sobrevive a remontagens do provider, muda ao trocar de servidor e é limpo quando a sessão é redefinida (`resetDataStore`). Nada disso é autoridade: o PostgreSQL continua sendo a fonte, e cada leitura confirmada volta para a store.

## Campos compartilhados

- `agents-context`: `agentList`, `modelOptions`, `providerStatus`.
- `conversation-context`: `conversations` (snapshots normalizados por agente).
- `turns`: `activeTurns`, `turnProgress`, `turnStepLines`, `failedTurns`, `contextStates`, `threadContextStates`, `usageLimits`, `usageLimitedModels`, `waitedUsageLimits`, `queues`, `waits`, `routinesByConversation`, `pendingPrompts`, `approvals`.
- `ui-errors`: `uiErrors`.

`useSharedSignal` preserva a API de accessor do clone Solid sobre a store tipada; `useSharedStore` aplica ações no formato `produce` ou atualização funcional. Estado exclusivo de uma janela (layout, navegação, plataforma) permanece no provider da janela.

## Sidebar e memórias no servidor

Layout, pinos da sidebar e memórias por agente passam por `GET /api/workspace` e pelos comandos `workspace.sidebar` e `workspace.memory`. As gravações usam revisão esperada: layout com `expectedRevision` e pinos com semeadura única; memória duplicada ou inexistente retorna 409/404. O reducer da sidebar (`src/contracts/sidebar-layout-reducer`) calcula a próxima árvore e o servidor grava o resultado validado.

Runs de workflow são um registro durável vazio (`workflow-runs:<servidor>:<workflow>`) preenchido apenas por um executor real; o cliente não inventa histórico.

## Cache

- Cliente (`getData`): TTL por caminho — conversa/fila/leituras 5 s, jobs 2 s, app-info 1 h, padrão 30 s; leituras paralelas do mesmo caminho compartilham uma requisição; `{ force: true }` ignora o TTL; `invalidateQueries(prefixo)` marca as entradas para recarregar.
- Servidor (`cachedDataQuery`): chave com as revisões dos domínios que afetam a projeção (`src/server/cache/policy.ts`), cache Next e Redis com revalidação de 2 s/5 s/30 s. Uma projeção não é invalidada pelo domínio alheio.
- Comandos invalidam apenas os prefixos que alteram (`src/contracts/data-cache.ts`): `agents.*` → `/api/agents`, `workspace.*` → `/api/workspace`, `settings.*` → `/api/settings`, entre outros.

Sem Redis Pub/Sub, não há push entre abas ou clientes. A convergência vem da invalidação e da próxima leitura: um comando recusado com 409 desfaz a camada otimista, marca a consulta como inválida e a leitura seguinte mostra o valor confirmado do outro cliente.

## Verificação

- `bun tests/unit/workspace-store.test.ts`: chaves por servidor, remontagem, no-op sem render loop e limpeza.
- `bun tests/unit/query-cache.test.ts`: deduplicação, TTL, `force`, invalidação e escopo de domínio.
- `bun tests/unit/conflict-convergence.test.ts`: conflito entre clientes, rollback, recarga e ordem do roster.
- `bun tests/integration/postgres-workspace.test.ts`: sidebar, pinos e memórias duráveis com PostgreSQL e Redis reais.

Consulte [estado atual](data-layer-current.md) para a cobertura geral e [agentes e conversas](agents-data.md) para o fluxo de mensagens.
