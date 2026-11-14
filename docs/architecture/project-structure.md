# Estrutura e fronteiras do projeto

## Organização por responsabilidade

~~~text
src/
  app/api/                 endpoints Next: ler contexto, delegar e responder
  components/              componentes visuais compartilhados
  features/                funcionalidades e seus detalhes locais
  templates/               composição das telas
  hooks/                   hooks compartilhados, incluindo use-data-query
  stores/                  estado global Zustand e camadas otimistas
  lib/api/
    client.ts              transporte HTTP, timeout, cancelamento e contratos
    bridges/               adaptação da API para o runtime existente
    mutations/             projeções otimistas por comando
  middlewares/             portas e adaptação UI/IPC
  server/
    config/                configuração privada do servidor
    database/              cliente PostgreSQL/Prisma
    repositories/          persistência e importação Redis legada
    cache/                 Redis, projeções e cache Next
    http/                  request, response e cookie de sessão
    integrations/          adaptadores server-side para serviços externos
    middlewares/           composição da fronteira HTTP
    commands/              ações permitidas e idempotência
    services/              consultas, modelos e regras dos domínios
    jobs/                  fila, dispatcher, processor e controle dos jobs
    errors.ts              erros compartilhados do backend
  workers/                 entrypoints de processos independentes
  contracts/               tipos e validadores compartilhados
  preview/                 fixtures, demo-seed e runtime simulado
  generated/               cliente gerado pelo Prisma
tests/
  unit/                    verificações sem servidor ou bancos ativos
  integration/             PostgreSQL, Redis, worker e endpoints reais
  regression/              navegação e compatibilidade no DOM simulado
  manual/                  diagnósticos antigos, fora da CI
scripts/                   build, lint, verificações e operações CLI
infra/worker/              subset de dependências e lock do worker
prisma/                    schema e migrações versionadas
~~~

Funcionalidades mantêm hooks, componentes e estado exclusivos dentro de seu próprio diretório. Promova código a hooks/stores compartilhados quando houver consumidores reais em mais de uma funcionalidade. Não crie pastas vazias para sugerir camadas que ainda não existem.

## Fronteiras de dependência

| Camada | Pode depender de | Não deve depender de |
| --- | --- | --- |
| Componentes e hooks | contratos, store e cliente/adaptadores HTTP | Prisma, Redis, servidor ou entrypoints de workers |
| Store | Zustand vanilla e tipos/dados puros | React hooks, HTTP ou componentes |
| Cliente HTTP | contratos, store e políticas otimistas | bibliotecas privadas do servidor |
| Handlers HTTP | middlewares, comandos, serviços e leitores de cache | implementação visual |
| Serviços | contratos, modelos, fixtures puros e repositórios | APIs de contexto/cache do Next e runtime visual |
| Repositórios | Prisma, configuração e sincronização Redis de domínio | contexto/cache do Next e componentes |
| Cache | leitores de dados e infraestrutura de cache | execução de comandos |
| Integrações | configuração privada, SDKs de provedores e contratos | UI, stores e cache Next |
| Jobs e worker | contratos, persistência e Redis | contexto de request do Next e UI |

Imports apontam diretamente para o módulo proprietário. Evite barrels genéricos que carreguem processos ou misturem módulos cliente/servidor. Entry points terminados em .worker.ts são executados como processos; outros módulos importam os handlers de jobs.

`bun run check:architecture` constrói o grafo de imports de execução e verifica essas fronteiras. O comando também detecta imports relativos não resolvidos no núcleo de dados, ciclos entre módulos desse núcleo e dependências transitivas do worker sobre Next/React. Ele faz parte de `bun run check` e da CI. Imports apenas de tipos e ciclos do restante do legado não são um typecheck global; as pendências TypeScript anteriores permanecem separadas.

Os únicos fixtures de renderer permitidos no backend são preview/fixtures.ts e preview/demo-seed.ts, que permanecem dados puros. O backend não instancia preview/mock-johnbot.ts. Código gerado em src/generated não é editado manualmente.

## Fluxo de dados e execução

~~~mermaid
flowchart LR
  DB[(PostgreSQL)] --> Redis[(Redis)] --> Next[Cache Next] --> Store[Zustand] --> UI[Componentes]
  UI --> Optimistic[Camada otimista]
  Optimistic --> HTTP[Cliente HTTP]
  HTTP --> Boundary[Middleware e contrato]
  Boundary --> Commands[Comando permitido]
  Commands --> TX[Persistência e outbox SQL]
  TX --> DB
  TX --> Jobs[Dispatcher e processor]
  Worker[Processo worker] --> Jobs
  Jobs --> Redis
~~~

O cache consulta revisões do banco antes de escolher a chave; um cache hit pode poupar a leitura do payload. Confirmação de comando reconcilia a store e invalida consultas. Falhas restauram o estado confirmado, sem apagar uma edição mais recente. Detalhes operacionais e limites estão em [jobs e fluxo de dados](../infrastructure/jobs-and-data-flow.md).

Jobs permanecem coesos em server/jobs: queue configura BullMQ, dispatcher publica a outbox, processor executa o tipo permitido e service atende listagem/retry/cancel. workers/background.worker.ts cuida de configuração, sinais, heartbeat e ciclo do processo. Atualmente o job real é cache.refresh; provedores de IA e mensageria continuam simulados.

## Middlewares HTTP e UI/IPC

src/server/middlewares valida e monta contexto no servidor. readCommandContext conserva a ordem: chave de idempotência, envelope JSON e cookie de sessão. A escolha do comando permitido e o mapeamento da resposta ficam no endpoint. A sessão ainda é de demonstração, sem autenticação de produção.

src/middlewares conserva portas, eventos e adaptação do runtime do frontend. Não coloque validação de requests HTTP nessa pasta. Esses módulos não são o arquivo global de middleware do Next. Na versão instalada, essa convenção é proxy.ts; não foi necessário adicionar um proxy global nesta organização.

## UI e fidelidade

Nenhuma regra de CSS, classe de componente ou contrato visual foi alterado pela organização. Componentes, funcionalidades e templates mantêm seus diretórios. Estilos de referência e Tailwind continuam verificados por `bun run styles:check`; navegação, popups e StrictMode são cobertos por `test:url-state` em DOM simulado, sem browser/controle da interface do computador.

Arquivos de re-exportação legados na raiz de src conservam os pontos de entrada compatíveis. Novos módulos usam seu diretório proprietário.

## Como alterar uma camada

1. Altere contrato e validadores compartilhados quando mudar o formato de um dado.
2. Coloque persistência no repositório e consultas/modelos no serviço do domínio.
3. Registre a ação em commands ou o novo tipo/handler em jobs; atualize o consumidor apropriado.
4. Acrescente a projeção otimista e a reconciliação no cliente quando houver mudança visual imediata.
5. Verifique imports, testes e documentação do diretório. Mudanças de schema levam migração Prisma.
6. Execute check, testes da camada afetada e build. CI e imagens usam os mesmos caminhos públicos documentados.

Testes ficam em [tests](../../tests/README.md); scripts operacionais em [scripts](../../scripts/README.md). Consulte [estado atual dos dados](../infrastructure/data-layer-current.md) antes de ampliar a cobertura mock/HTTP.
