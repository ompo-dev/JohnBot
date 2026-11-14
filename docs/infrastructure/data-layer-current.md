# Estado atual da camada de dados — 2026-11-14

O [workspace operacional](../architecture/operational-workspace.md) acrescenta dashboards por pessoa, notebooks com evidências de execução, diretório com vínculos múltiplos, políticas e prévias de conectores ao mesmo fluxo PostgreSQL/Redis/Next/Zustand. O modo é explicitamente de simulação. Rotinas conserva a interface original e incorpora nela as ferramentas de workflows; o resumo e a edição usam os mesmos grafos e históricos persistidos, conservando IDs. O layout do resumo é persistido separadamente das coordenadas internas de cada rotina. Dashboards reutilizam os componentes compartilhados e o padrão visual de relatórios. Execução durável de IA, canais e webhooks ainda têm limites descritos nesse documento.

A aplicação web usa Axios e contratos Zod no transporte HTTP. `JOHNBOT_DATA_MODE=postgres` (padrão) faz o PostgreSQL com Prisma ser a fonte do workspace, do roster e das conversas, isolado pelo cookie de sessão; `demo` preserva os seeds de demonstração usados pelos testes de domínio. Alterações são comandos explícitos com chave de idempotência. A store de domínio usa revisão e atualização condicional no PostgreSQL, validando o estado antes de gravar. Redis mantém os claims/resultados de idempotência. A execução nativa e os provedores continuam sem backend externo: não há provedor conectado, resposta simulada nem autenticação de produção nesta entrega. Consulte [PostgreSQL e Prisma](postgres-prisma.md) para migrações, importação e execução local.

## Cobertura integrada

O fluxo web agora é PostgreSQL → Redis versionado → cache Next → Zustand → componentes. As mutações instalam estado otimista, confirmam por comando HTTP e reconciliam ou fazem rollback; um conflito entre clientes desfaz a camada e invalida a consulta, para que a leitura seguinte mostre o valor confirmado. Cada gravação de domínio registra uma outbox SQL para o worker BullMQ. Consulte [jobs e fluxo de dados](jobs-and-data-flow.md) para escopo, recuperação e API de controle. Redis também mantém os dados de cache e a fila; metadados estáticos e o runtime nativo continuam nos seus fluxos próprios.

- Conta, identidade, uso e preferências visuais: base anterior.
- Workflows: dados demo preservados, listagem, CRUD, grafos, revisão/conflitos e versões; isolamento por sessão e servidor. Cache Next por escopo, invalidado nas mutações. O simulador local recebe os grafos salvos antes de executar; runs e webhooks continuam em memória.
- Marketplace: listagem, filtros booleanos explícitos, busca, paginação, ordenação por instalações, detalhes, submissões e publicação demo por sessão. A publicação usa o preview validado do próprio agente local; a instalação de binários permanece local.
- Preferências: analytics, modo de mensagem, defaults dos agentes e reuso de sessão. Bootstrap e atualizações reconciliam o estado local, evitando que respostas atrasadas sobrescrevam uma gravação nova.
- Agentes e conversas: o PostgreSQL é dono do roster e das transcrições. CRUD de agentes, envio, reações, leitura e cancelamento passam por comandos; o envio grava a mensagem e a entrega na fila, sem inventar resposta. Edição usa `expectedUpdatedAt`; o cliente desfaz a camada otimista e recarrega em conflito. Consulte [agentes e conversas](agents-data.md).
- Estado compartilhado e sidebar: uma store Zustand isola os campos por servidor e sobrevive a remontagens. Layout, pinos e memórias por agente são registros duráveis com revisão condicional. O cache do cliente usa TTL por caminho, deduplicação e invalidação por prefixo de comando; o do servidor usa chaves por domínio. Consulte [estado compartilhado e cache](workspace-data.md).
- Provedores, anexos e tasks conservam seus fluxos locais; conversas remotas passam para os métodos originais sem recursão.

## Limites práticos

Não há Redis Pub/Sub ou atualização ao vivo entre clientes. Uma recarga restaura o snapshot confirmado; não retoma um processo de IA ou simulador que foi encerrado. A convergência entre abas depende da invalidação por comando e de uma nova leitura; um 409 não tenta novamente sozinho. O prazo dos claims não constitui uma transação com efeitos externos: não há promessa de exactly-once após queda ou expiração. A chave deve ser reaproveitada pelo chamador na repetição de uma operação lógica.

O Next cache usa a API suportada `unstable_cache` nos dados seguros de catálogo/uso/workflows. Não se armazena cache de stream de conversa. A adoção de Cache Components e `use cache` permanece uma mudança separada de runtime. As integrações externas de billing, hosts, mensageria, cofres, OAuth e provedores não foram inventadas; hardware e arquivos permanecem nativos.

## Verificação

`bun run test:domains` executa as quatro suítes HTTP em servidor real, PostgreSQL e Redis, no modo demo. `bun tests/integration/postgres-workspace.test.ts` cobre o modo postgres com workspace vazio, CRUD, conflitos, mensagens duráveis e sidebar. Os testes unitários cobrem cache, estado compartilhado e convergência de conflito. A CI também executa migrações, checagem de drift, importação e persistência, as pontes de conversas/preferências, o cliente Axios, concorrência entre processos, regressão de URL, estilos e build Docker. O TypeScript 7 encontra a opção antiga `baseUrl` no tsconfig; a revisão sem essa opção apontou os erros legados separadamente, sem alterar a configuração original. O build ainda mantém `ignoreBuildErrors`; não equivale a typecheck integral.

O DeepSeek gratuito retornou limite de uso; o GPT-5.6 Luna via OpenCode também retornou limite de compartilhamento da assinatura. Nenhum fallback adicional foi acionado. A revisão final e integração foram realizadas pelo agente principal.
