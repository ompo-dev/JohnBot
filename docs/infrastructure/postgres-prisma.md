# PostgreSQL e Prisma

## Responsabilidades

PostgreSQL 17 é a fonte de verdade de conta, sessões demo, configurações, preferências, catálogo/submissões, workflows e conversas já integrados ao HTTP. Prisma ORM/client/adapter-pg usam a mesma versão estável 7.10.1. Redis continua com claims/resultados de idempotência; o cache Next conserva a invalidação por escopo.

A tabela `domain_records` tem chave composta `(sessionId, domain)`, payload JSONB, revisão de concorrência e timestamps. A escolha preserva os contratos agregados atuais, validados com Zod antes de gravar e depois de ler. Não cria tabelas fictícias para provedores que ainda são mocks. Normalização de agentes, mensagens e relacionamentos será uma migração posterior, quando esses contratos forem definidos.

As atualizações usam `updateMany` condicionado à revisão lida e incremento atômico; conflitos recarregam e reaplicam a função pura. A versão de conversa esperada pelo cliente continua protegendo conflitos entre janelas. Não há fallback para seed em uma falha de PostgreSQL nem substituição silenciosa de um payload inválido.

Os registros PostgreSQL não expiram com o TTL do cookie. O acesso continua isolado pelo cookie opaco de demonstração; isto não implementa autenticação/contas de produção nem retenção automática. Idempotência Redis e alteração SQL não são uma transação distribuída: uma queda entre esses passos não garante exactly-once.

## Docker completo

```sh
docker compose stop web
docker compose up -d --build --wait
docker compose ps
```

O serviço `migrations` aguarda PostgreSQL e Redis, executa `prisma migrate deploy` e importa os dados legados. O web só inicia após conclusão com sucesso. Ao atualizar uma instalação antiga, parar o web evita escritas no Redis durante a cópia. Migrações destrutivas não são executadas automaticamente por `migrate dev` ou `db push`.

Os bancos ficam na rede interna, sem portas publicadas no Compose normal. O volume `postgres-data` preserva o banco nas recriações; `redis-data` permanece. Não use `docker compose down -v` para atualizar, pois exclui os volumes. As credenciais padrão são exclusivas da demonstração local. Para alterá-las, configure POSTGRES_PASSWORD e a senha percent-encoded correspondente em DATABASE_URL; no Compose o host é `postgres`, não `127.0.0.1`. Não coloque DATABASE_URL em variáveis NEXT_PUBLIC.

## Desenvolvimento no host

```sh
docker compose -f compose.yaml -f compose.dev.yaml up -d --wait postgres redis
bun install --frozen-lockfile
bun run db:generate
bun run db:migrate
bun run dev
```

Copie `.env.example` para `.env` e descomente DATABASE_URL com host 127.0.0.1 para esses comandos. O override publica apenas em loopback. Para voltar ao Docker completo, remova o DATABASE_URL do host do `.env` ou ajuste o host para postgres.

`bun run dev` e os builds de servidor geram o cliente. O cliente gerado é ignorado no Git e no contexto Docker; cada plataforma gera o seu. A geração não precisa de banco ou credencial. O cliente Prisma é lazy e compartilhado no processo, com pool limitado e timeout. O export estático/desktop conserva seu runtime local e não exige banco.

## Migrações e dados anteriores

A migração `20261112000200_background_jobs` adiciona a outbox persistente e os estados dos jobs. Atualizações de domínio e criação do job usam a mesma transação. O novo serviço `worker` usa PostgreSQL e Redis, aguarda migrações e tem healthcheck próprio. Veja [fila, caches e optimistic first](jobs-and-data-flow.md).

- `bun run db:validate`: valida o schema.
- `bun run db:migrate:dev --name nome`: cria uma próxima migração apenas em banco de desenvolvimento.
- `bun run db:migrate`: aplica migrações versionadas; repetir não redefine dados.
- `bun run db:check`: detecta diferença entre o banco e o schema, com exit code 2 para drift.
- `bun run db:import-redis`: copia chaves `johnbot:session:*` e `johnbot:domain:*`, sem apagar Redis ou atualizar registros SQL existentes.

A importação aceita o JSON legado e valida estrutura de chave/payload JSON; os contratos de domínio são verificados na leitura normal. JSON inválido interrompe a importação. Uma primeira leitura também importa um registro legado ainda ausente, validando seu contrato antes de gravar. Redis não é lido para registros que já existem no PostgreSQL. Mantenha as chaves antigas durante a validação da atualização; não execute um runtime antigo que escreve apenas no Redis em paralelo.

## Verificação

A CI sobe os dois bancos, gera/valida o cliente, aplica migrações, verifica drift e executa `test:database`, concorrência entre processos e suítes HTTP. `test:database` verifica importação, preservação de registros SQL existentes, persistência após reconexão, isolamento por sessão, gravações inválidas e corrupção sem reseed.

`JOHNBOT_TEST_BASE_URL=http://127.0.0.1:3000 bun run test:domains` valida os quatro domínios no Docker. Para verificar falha/recuperação do PostgreSQL no Compose, execute o teste HTTP com `JOHNBOT_TEST_POSTGRES_OUTAGE=1`; ele para e reinicia apenas postgres em um bloco finally. O cenário Redis continua disponível com JOHNBOT_TEST_REDIS_OUTAGE=1. Use apenas uma flag de interrupção por execução.

O build continua com a limitação legada ignoreBuildErrors. Build e testes de integração não equivalem a typecheck integral da base.

Validado localmente em Docker em 2026-11-12: 74 registros legados importados, migração reaplicada sem alterações, drift vazio, testes dos quatro domínios, 12 atualizações concorrentes entre quatro processos e falha/recuperação dos dois bancos. Durante a interrupção do Redis, registros PostgreSQL existentes continuaram legíveis. A recriação do container PostgreSQL preservou contagem, payloads e revisões no volume. Build standalone, estilos, cliente Axios e pontes também passaram. A pipeline foi atualizada; sua execução remota depende do push.

Referências: [Prisma PostgreSQL](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql) e [Prisma Config](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference).
