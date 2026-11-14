# Jobs

- queue.ts configura conexões, prefix e política BullMQ.
- dispatcher.ts entrega registros da outbox com lease SQL e ID determinístico.
- processor.ts valida o job permitido, executa e registra estado/tentativas.
- service.ts oferece listagem e ações de controle por sessão.

O entrypoint é src/workers/background.worker.ts. Jobs não importam o processo worker, UI ou contexto Next. Novos efeitos precisam de tipo permitido, validação e comportamento idempotente.

Operação, estados, retries, cancelamento e retenção estão em [jobs e fluxo de dados](../../../docs/infrastructure/jobs-and-data-flow.md).
