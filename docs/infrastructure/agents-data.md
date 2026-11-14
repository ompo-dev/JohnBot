# API e persistência de agentes e conversas

PostgreSQL é a fonte do roster e das transcrições. `JOHNBOT_DATA_MODE=postgres` (padrão) começa com o workspace vazio e não cria exemplos; `demo` mantém os seeds de demonstração (`STORY_AGENT_SUMMARIES`, `STORY_AGENT_STATUS`, `STORY_MODELS`, `DEMO_OPTIONS.snapshots`). Em ambos os modos, o servidor não instancia o runtime React nem contata provedores.

`installDatabaseAgentsData(mock)` substitui os métodos de roster e conversa. `restoreAgents`, `restoreConversationSnapshot`, `restoreConversationReadState` e `setQueueSnapshot` reidratam o runtime original a partir das projeções validadas da store. Criar, editar, excluir, enviar, reagir, editar, apagar, marcar leitura e cancelar passam por comandos explícitos.

Enviar grava a mensagem do usuário e a entrega na fila como `queued`. Sem provedor conectado, nenhuma resposta é simulada e nenhum turno começa. Tasks, anexos e execução continuam locais; servidores diferentes de `local` são recusados pela ponte.

## Contratos HTTP

- `GET /api/agents?domain=agents|models|status|reads`: roster, modelos, estado do provedor e marcadores de leitura.
- `GET /api/agents?domain=conversation|queue&agentId=...`: registro canônico (snapshot, readState, queue, version).
- `GET /api/agents/conversation?agentId=...&limit=...&before=...|around=...`: página validada.
- Comandos: `agents.create`, `agents.update`, `agents.delete`, `agents.send-message`, `agents.change-message`.

`agents.update` exige `expectedUpdatedAt` e responde 409 quando outro cliente salvou antes. `agents.send-message` usa `clientMessageId` como chave idempotente: repetir o mesmo ID com o mesmo texto não duplica; com texto diferente, retorna 409. `agents.change-message` cobre leitura, não lida, reação, exclusão e cancelamento da fila, sempre incrementando a revisão do snapshot.

`agents.sync-roster` e `agents.persist-conversation` continuam registrados para o espelhamento do runtime nativo, mas respondem 400 fora do modo demo: nesse modo o banco é dono do roster e das conversas.

## Estado otimista

`agents.create`, `agents.update`, `agents.delete` e `agents.send-message` instalam uma camada otimista na consulta correspondente antes do HTTP. A resposta confirmada substitui a camada; um 409 desfaz apenas a camada e invalida a consulta, de modo que a próxima leitura traz o valor do outro cliente. Uma edição preserva a posição do agente no roster; apenas a criação acrescenta no fim.

## Limites

Uma nova instância restaura o snapshot confirmado; não retoma uma execução. Não há streaming, Pub/Sub ou sincronização ao vivo entre abas: a convergência depende de invalidação, nova leitura ou recarga. Provedores, anexos, tasks, permissões e rotinas continuam nos fluxos locais.

## Verificação

- `bun tests/integration/postgres-workspace.test.ts`: PostgreSQL e Redis reais, workspace vazio, CRUD, conflito por `updatedAt`, mensagem durável e idempotente, fila, leitura, sidebar, memória, isolamento e reconexão sem respostas inventadas.
- `bun tests/unit/conflict-convergence.test.ts`: conflito entre clientes, rollback, invalidação, recarga e ordem do roster.
- `bun tests/unit/agents-bridge.test.ts`: ponte anterior de espelhamento do runtime nativo.

Consulte [estado compartilhado e cache](workspace-data.md) e [estado geral](data-layer-current.md).
