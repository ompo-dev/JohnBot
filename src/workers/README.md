# Processos workers

background.worker.ts inicia o consumidor e o dispatcher. Configura concorrência, sinais, heartbeat e encerramento dos recursos. Execute com `bun run worker` ou pelo serviço worker do Compose.

Regras de job ficam em src/server/jobs. Não importe este entrypoint a partir da aplicação: carregá-lo inicia conexões e um loop de longa duração. A verificação de arquitetura bloqueia esse import.

Consulte [operação da fila](../../docs/infrastructure/jobs-and-data-flow.md).
