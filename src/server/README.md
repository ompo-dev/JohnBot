# Backend

| Diretório | Papel |
| --- | --- |
| config | Configuração privada validada |
| database | Conexão Prisma/PostgreSQL |
| repositories | Leitura/gravação e importação Redis legada |
| services | Consultas, modelos e regras por domínio |
| commands | Ações permitidas e idempotência |
| http | Headers, envelopes de resposta, corpo e sessão |
| middlewares | Composição da fronteira de request |
| cache | Redis, read models e adaptação ao cache Next |
| jobs | Fila, outbox, processamento e controles |

errors.ts é compartilhado pelo backend e não carrega contexto Next. O processo worker fica em src/workers. Handlers Next permanecem em src/app/api e delegam para estas camadas.

Contratos ficam em src/contracts. Fixtures puros são uma exceção explícita durante a fase mock; código do renderer não é carregado pelo backend. Veja [as regras e verificações](../../docs/architecture/project-structure.md).
