# Workspace operacional

## Escopo entregue

O workspace acrescenta `?page=dashboard` e `?page=access`. Notebooks são registros internos dos agentes, sem página pública. Conectores são instalados e gerenciados nos apps do Marketplace; `mpInstalled=true` filtra os instalados. Endereços antigos de conexões redirecionam ao Marketplace e os de notebooks voltam aos agentes. Rotinas conserva sua tela original, a lista de agentes, o diagrama, o assistente e o histórico. As ferramentas de workflow são incorporadas à edição de etapas dentro dessa tela. O menu de servidores, seu rail, atalhos e overlays ficam desabilitados por `productFeatures.serverManagement`; o runtime interno conserva seus IDs. Cobrança, pagamentos e atualizações continuam desabilitados.

O modo desta entrega é explicitamente **simulation**. A seleção de pessoa serve para experimentar o modelo organizacional e suas permissões. Ela não é login, não autentica funcionários e não pode autorizar acesso a dados externos reais. A organização ainda está isolada pelo cookie de demonstração do workspace.

## Dados e fronteiras

`contracts/operations.ts` valida diretório, vínculos múltiplos, políticas, dashboards, notebooks, encaminhamentos e auditoria. `server/services/operations.ts` é o proprietário das mudanças. O agregado `operations-v1` fica em `domain_records`, no PostgreSQL, usando o repositório, revisão condicional e outbox existentes. Não há uma segunda base em localStorage.

Leituras seguem PostgreSQL, Redis, cache Next, Axios/Zod, Zustand e componentes. As chaves Next incluem a revisão do domínio. Expiração de políticas é avaliada fora do cache de projeção. Mutações usam `operations.change`, `expectedRevision` e a infraestrutura de idempotência. Dashboard, conclusão de pendências e confirmação de encaminhamentos têm projeções otimistas. Conflitos não repetem a escrita silenciosamente.

As telas operacionais atualizam em foco, visibilidade, notificação entre abas e a cada dez segundos enquanto visíveis. Isso não é um stream de eventos. `useDataQuery` delega a decisão de frescor ao cliente HTTP, inclusive quando uma tela remonta com uma entrada antiga na store. A repetição idempotente de um comando operacional devolve a projeção atual, evitando recuperar uma visão autorizada para uma persona anterior.

John Twin consulta a mesma projeção de vínculos e notebooks. Sua leitura usa Axios/Zod e a store compartilhada. Dados, seleção, expansão e modo da árvore ficam em `stores/twin-store.ts`, com assinatura Zustand na página; alterações não dependem de um contador manual de render. Uma falha não reinstala os arrays antigos da demonstração.

## Dashboards

Cada pessoa pode ter vários dashboards persistidos, selecionados pelo parâmetro `dashboard`. Criar abre o setup do construtor especializado; o chat flutuante mantém histórico por painel. `dashboards.compose` cria ou edita por ID e revisão, sem substituir outros painéis. O servidor fornece a projeção autorizada ao modelo, valida o programa OpenUI Lang e grava por idempotência. Renomear, duplicar e excluir usam o mesmo fluxo otimista. Erro do modelo ou conflito preserva o painel anterior. A geração não aceita autoria de agente declarada pelo cliente.

A tela reutiliza a composição de Uso: resumo/indicador em `agent-usage-summary`, informação prioritária em `agent-usage-trend`, os mesmos controles e tabelas `agent-usage-table`. O gráfico categórico usa barras de Recharts no ChartContainer compartilhado e suas cores. Não há cartões que estiquem para acompanhar listas. Cada tabela começa com cinco linhas e expande sob demanda; links de rotinas atualizam página/sidebar/ID em uma única navegação.

A geração por LLM usa um endpoint compatível com OpenAI configurado no servidor por `JOHNBOT_DASHBOARD_MODEL`, `JOHNBOT_DASHBOARD_API_KEY` e `JOHNBOT_DASHBOARD_BASE_URL`. Sem modelo e chave, o workspace de simulação conserva a prévia local explicitamente identificada, sem chamada paga ou atribuição falsa a um agente. Configuração parcial resulta em erro. Não são aceitos JavaScript, SQL ou HTML como definição de módulo. Os dados continuam vinculados às fontes do aplicativo, em vez de números inventados na resposta do modelo.

## Notebooks internos e permissões

Não há editor ou central pública de notebooks. Eles orientam agentes e preservam organização, evidência e rastreabilidade. Resumos autorizados podem aparecer no dashboard. A tela de organização usa `SettingsPageFrame`, `SettingsDialogShell`, seções e controles originais; pessoas, permissões e auditoria possuem seções próprias. Configurações de pessoas no Twin mostram vínculos e exceções, sem configuração de modelo ou cérebro.

Os cadernos existentes do Twin são importados na inicialização do agregado. Novos registros são acrescentados; correções indicam `supersedes`. O servidor determina autor e data. Referências e `runId` conectam a evidência à execução. Um registro manual não ganha autoria artificial de agente.

Resultados terminais das simulações de workflows e do processamento CSV determinístico são publicados com deduplicação por execução. Agentes participantes recebem seus próprios registros, vinculados ao resumo da rotina. Cadernos de execução são separados por contexto de setor ou responsável privado, evitando ampliar o acesso a registros anteriores quando outro setor usa a mesma rotina. O registro informa o modo de execução e suas limitações. Resumos importantes percorrem relações explícitas de supervisão, com detecção de ciclos, deduplicação e checagem de leitura para cada destinatário. Não há envio externo por e-mail ou mensageria.

As políticas simuladas combinam pessoa, cargo e setor, recurso e ação, escopo de setor e expiração. Negativas prevalecem. O diretório aceita vários cargos, setores e responsáveis. Escritas administrativas, encaminhamentos, confirmações e alterações deixam eventos na auditoria. Esta política está aplicada às novas operações e prévias de conectores; ela **não constitui uma auditoria nem autorização integral de todos os endpoints legados**.

## Rotinas unificadas

`lib/routine-unification.ts` converte rotinas agendadas antigas para gatilhos, nós de agente, ligações e saídas do editor. IDs, agendamento, instruções e políticas são conservados. `migratedRoutineIds` impede que uma rotina excluída seja recriada na leitura seguinte. Os grafos existentes não são substituídos pela migração.

O adaptador `lib/api/bridges/routines.ts` lê e grava as rotinas agendadas de agentes na mesma base de workflows, incluindo os formulários que usam a API de eventos. Uma edição simples preserva nós adicionais do grafo. Histórico e teste manual apontam para o runner de workflows existente.

`lib/routine-canvas.ts` projeta esses mesmos grafos para o diagrama original de Rotinas. `server/services/routine-canvas.ts` acrescenta o histórico persistido e as rotinas manuais/de processamento de arquivos. O fluxo CSV também aparece nessa visão. Os caminhos entre agentes conservam condições intermediárias no editor; caminhos comprimidos não são excluídos pela visão resumida.

O botão **Editar etapas** incorpora WorkflowCanvas como uma seção da própria DiagramView, com os componentes de nós, ligações, ferramentas, versões e execução já existentes. **Voltar** restaura a visão de rotinas e remove `workflow` da URL. Links antigos com `page=routines` ou `page=workflows` são normalizados para a página de agentes com `sidebar=routines`, conservando o ID da rotina.

As posições do diagrama resumido são independentes das coordenadas internas de cada grafo. `routines.position` salva esse layout em `routine-layout:<agentId>` no PostgreSQL. Conexões e instruções editadas no resumo alteram o grafo canônico por revisão, sem recorrer ao canvas mock antigo.

**Limites:** o runner geral continua simulado e local ao processo cliente; o worker existente processa `cache.refresh`. Scheduler durável, retomada de execução de IA, webhooks e rotinas de canais ainda não foram unificados integralmente. O CSV executa análise determinística real e persiste camadas/resultados. Esses limites não devem ser apresentados como execução contínua em produção.

## Conectores

`connector-catalog.ts` separa implementação real, parcial e mock. PostgreSQL significa a persistência local do próprio app. CSV usa o arquivo local do piloto. A2A e Auto Ontology mantêm as capacidades parciais documentadas em `../infrastructure/external-integrations.md`; billion-context permanece fora do runtime.

ERP, MES, SAP, TOTVS, Power BI, Databricks, APIs, planilhas, mensageria, GitHub, MCP, UTCP e cofres possuem prévias de demonstração identificadas. `/api/connections` avalia acesso antes de devolver recursos. Uma prévia de WhatsApp não envia mensagens. Um cartão de catálogo não comprova conexão externa nem valida credenciais.

## Verificação

- `bun run check`
- `bun run test:unit`
- `bun run test:operations:ui`: DOM simulado, sem navegador ou controle do computador.
- `bun run test:routines-ui`: inclui compatibilidade de URL e recursos reversíveis, restauração da tela original, CSV manual e ferramentas incorporadas; DOM simulado sem navegador.
- `bun run test:operations:http`: app rodando, PostgreSQL/Redis reais, cookie novo isolado; aceita `JOHNBOT_TEST_URL`.
- `docker compose build web worker migrations` e `docker compose up -d web worker`.

## Próximas integrações necessárias

1. Identidade autenticada, organização compartilhada e migração do isolamento por sessão.
2. Autorização aplicada a todos os endpoints legados, fontes e ferramentas; consultas com restrições de linhas e colunas.
3. Executor/scheduler durável para grafos, aprovações humanas, retomada e efeitos externos idempotentes.
4. Adaptadores reais de cada produto, com configuração, segredos, sincronização e observabilidade.
5. Identidade de executor autenticada para publicação autônoma de dashboards e notebooks; a composição atual é solicitada pela persona da sessão.
6. Execução de tarefas A2A, aplicação semântica de Auto Ontology e avaliação de contexto no runtime.

Nesta revisão, a delegação utiliza Gemini via 9Router, conforme a preferência atual. Argon está excluído. A configuração privada do construtor não é versionada.
