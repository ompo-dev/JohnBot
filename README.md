# JohnBot

Aplicação Next.js/React/Tailwind com Axios, Zod, nuqs e Zustand. A camada HTTP persiste dados em PostgreSQL/Prisma e usa Redis, cache Next e jobs BullMQ. Suporta execução web, containerizada via Docker e desktop via Tauri.

Repositório oficial: [github.com/ompo-dev/JohnBot](https://github.com/ompo-dev/JohnBot).

## Executar com Docker

~~~sh
docker compose up -d --build --wait
docker compose ps
~~~

A aplicação abre em http://localhost:3000. Web, PostgreSQL, Redis e worker têm serviços próprios; migrations termina antes de iniciar web e worker. Os volumes conservam os dados nas recriações.

Para desenvolvimento no host, siga [PostgreSQL e Prisma](docs/infrastructure/postgres-prisma.md). Configure DATABASE_URL/REDIS_URL, gere o cliente Prisma e aplique as migrações antes de iniciar o servidor. O worker pode ser iniciado separadamente com `bun run worker`.

## Desenvolvimento Desktop (Tauri)

~~~sh
bun run dev:desktop
~~~

Para compilar o binário desktop:

~~~sh
bun run build:desktop
~~~

## Organização

O [guia de estrutura e fronteiras](docs/architecture/project-structure.md) define onde colocar cada responsabilidade e quais dependências são permitidas.

| Local | Responsabilidade |
| --- | --- |
| src/app | Rotas, layouts e handlers Next |
| src/components, src/features, src/templates | UI compartilhada, funcionalidades e composição das telas |
| src/hooks, src/stores | Hooks compartilhados e estado Zustand |
| src/lib/api | Transporte Axios, adaptadores e políticas otimistas |
| src/middlewares | Portas e adaptação do runtime UI/IPC |
| src/server | HTTP, middlewares, comandos, serviços, repositórios, cache e conexão SQL |
| src/server/jobs, src/workers | Definições/processamento dos jobs e processo worker |
| src/contracts, src/preview | Contratos compartilhados e dados/runtime de demonstração |
| src-tauri | Configuração e backend desktop Tauri |
| tests | Testes unitários, de integração, regressão e diagnóstico manual |
| scripts, infra, prisma | Ferramentas, dependências do worker, schema e migrações |

Fluxo web: PostgreSQL → Redis → cache Next → Zustand → componentes. Alterações entram primeiro no estado otimista; comandos confirmam a gravação ou restauram a base confirmada. A outbox SQL preserva jobs entre falhas de infraestrutura.

## Verificar

~~~sh
bun install --frozen-lockfile
bun run db:generate
bun run check
bun run test:unit
bun run test:url-state
bun run styles:check
~~~

Testes que usam bancos: `test:database`, `test:jobs` e `test:data-stack`. `test:domains` cobre os endpoints HTTP. Consulte [tests](tests/README.md) para os pré-requisitos e o uso de servidor externo.

## Documentação

- [Estrutura e dependências](docs/architecture/project-structure.md)
- [Estado atual da camada de dados](docs/infrastructure/data-layer-current.md)
- [PostgreSQL e Prisma](docs/infrastructure/postgres-prisma.md)
- [Jobs, caches e estado otimista](docs/infrastructure/jobs-and-data-flow.md)
- [Integrações externas](docs/infrastructure/external-integrations.md)
- [Fidelidade dos estilos](docs/architecture/project-structure.md#ui-e-fidelidade)
- [Execução com Docker](docs/infrastructure/docker.md)
