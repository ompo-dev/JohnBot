# Stores compartilhadas

data-store.ts guarda dados de consultas, revisão, pendências e erros, além da base confirmada e das camadas otimistas. Atualizações, confirmação e rollback são independentes do transporte.

Stores usam Zustand vanilla e dados puros. HTTP pertence a lib/api; assinatura React pertence a hooks. Evite colocar estado exclusivo de uma funcionalidade neste diretório.

Consulte [fluxo de dados](../../docs/infrastructure/jobs-and-data-flow.md) e [fronteiras](../../docs/architecture/project-structure.md).
