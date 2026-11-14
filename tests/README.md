# Testes

| Pasta | Pré-requisitos e objetivo |
| --- | --- |
| unit | Sem serviços ativos; contratos, store, client, bridges e regras arquiteturais |
| integration | PostgreSQL/Redis reais ou aplicação HTTP; filas, persistência, isolamento e falhas |
| regression | React/DOM simulado; navegação, menus, URL e StrictMode |
| manual | Diagnósticos antigos de renderização, fora da CI |

As suítes são scripts de assertions em processos isolados. Use os comandos do package.json; não presuma que executar todos os arquivos simultaneamente pelo runner de descoberta monta seus bancos/servidores.

~~~sh
bun run db:generate
bun run test:unit
bun run test:url-state
bun run test:database
bun run test:jobs
bun run test:data-stack
bun run test:domains
~~~

As primeiras duas suítes funcionais sem bancos são unit e url-state. Gere Prisma antes de unit, pois alguns fixtures importam contratos do backend sem abrir conexão. Testes SQL/Redis requerem DATABASE_URL/REDIS_URL; use o override de desenvolvimento descrito em [PostgreSQL](../docs/infrastructure/postgres-prisma.md).

data-stack e domains podem iniciar um Next de produção após build. Para validar um container existente, defina JOHNBOT_TEST_BASE_URL=http://127.0.0.1:3000. Interrupções voluntárias dos bancos são opt-in e documentadas no guia de [jobs](../docs/infrastructure/jobs-and-data-flow.md).

unit/run.ts executa cada arquivo .test.ts/.test.mjs em processo separado. integration/domains.ts coordena as cinco suítes HTTP. integration/data-concurrency.test.ts cria subprocessos preservando seu próprio import.meta.filename. Paths operacionais são relativos à raiz do projeto.
