# Estado de interface na URL

O JohnBot usa `nuqs@2.10.3` para navegação e estado de apresentação. O adaptador do App Router está no layout do Next, dentro de Suspense. O renderer e os previews usam o adaptador React quando ainda não existe o contexto da aplicação.

## Parâmetros

| Área | Parâmetros |
| --- | --- |
| Página principal | `page=agents|schedule|workflows|twin|usage|marketplace|settings|server-settings` |
| Configurações pessoais | `settingsTab` |
| Configurações de servidor | `settingsServer`, `serverTab` |
| Workspace e conversa | `server`, `agent`, `person`, `channel`, `thread` |
| Layout | `sidebar=agents|routines`, `sidebarCollapsed`, `serverView=menu|rail` |
| Painel de conversa | `panel`, `panelTab`, `panelPanes`, `panelMax` |
| Busca na conversa | `chatSearch`, `chatQ`, `threadSearch`, `threadQ` |
| Busca global | `globalSearch`, `globalQ`, `globalTab` |
| Marketplace | `mpTab`, `mpQ`, `mpSort`, `mpAgentSource`, `mpSkillSource`, `mpView`, `mpItem` |
| Workflows | `workflow` |
| Relatório de uso | `usageRange=7d|30d|90d|1y`, `usageMetric=cost|tokens`, `usageAgent`, `usageBreakdown=agent|model|day` |
| Calendário | `calendarDate=YYYY-MM-DD`, `calendarView=month|week|day` |
| Superfícies de interface | `menu`, `submenu`, `select`, `dialog` |

Booleanos usam `true`/`false`. Valores padrão normalmente são removidos da URL. IDs precisam existir no contexto carregado; um parâmetro não concede acesso a um servidor, agente, pessoa ou workflow.

Uma conversa principal usa `thread=<AgentProfile.threadId>`, o ID fornecido pelo host. A URL não precisa mais de `agent=sales` ou `agent=research` para abrir essas conversas. Esses valores eram IDs dos agentes da seed, não nomes calculados a partir do título. Os dados existentes não foram renomeados.

Conversas secundárias usam `thread=<AgentTask.threadId>` e o ID do agente proprietário em `agent`, necessário para buscar sua lista de threads. Os dois valores são gravados juntos na mesma ação canônica, preservando painel e busca visíveis. Uma conversa secundária restaurada por link passa a ter aba local salva, sem que a normalização da URL conte como navegação. Links antigos por `agent` e pelo ID de task continuam aceitos e são normalizados com `replace`, sem criar uma etapa extra no histórico. Um rascunho sem mensagem ainda não tem um ID durável do host.

IDs de menus implementados: `rail-more`, `server-menu`, `provider-model`, `setup-provider-model`, `channel-provider-model`, `diagram-provider-model`, `settings-provider-model`, `rail-help`, `context-usage` e `side-panel-add`. O submenu de layout usa `submenu=server-layout`. As listas de Uso usam `select=usage-agent|usage-period|usage-metric`. Os formulários de criação de agente e entrada em servidor usam `dialog=agent-setup|join-server`.

O Marketplace restaura detalhes de apps, categorias, skills locais e listagens de agentes/skills. Para listagens remotas, a URL guarda somente o ID/slug e o controlador busca os dados. Uma resposta antiga não substitui uma navegação mais recente. Abrir um link não instala nem conecta um app.

## Exemplos locais

- [Perfil](http://localhost:3000/?page=settings&settingsTab=profile)
- [Conversa de pesquisa](http://localhost:3000/?thread=thread-research)
- [Conversa secundária de vendas](http://localhost:3000/?agent=sales&thread=task-thread-sales-1)
- [WhatsApp](http://localhost:3000/?page=marketplace&mpView=app&mpItem=whatsapp)
- [Busca de apps](http://localhost:3000/?page=marketplace&mpQ=whatsapp)
- [Menu de páginas](http://localhost:3000/?menu=rail-more)
- [Seletor de modelos](http://localhost:3000/?menu=provider-model)
- [Arquivos da conversa](http://localhost:3000/?panel=files&panelTab=files&panelPanes=files)
- [Busca global](http://localhost:3000/?globalSearch=true&globalQ=hello&globalTab=messages)
- [Uso em sete dias](http://localhost:3000/?page=usage&usageRange=7d&usageMetric=tokens)
- [Calendário](http://localhost:3000/?page=schedule&calendarDate=2026-12-15&calendarView=day)

## Regras de sincronização

`src/lib/url-state.tsx` mantém os parsers e adapta os hooks React ao contrato de accessors dos domínios migrados. A página é um enum único: as flags de settings e Marketplace são derivadas dele. Não há efeitos concorrentes fechando uma página recém-aberta.

Mudanças de páginas, conversas, abas de settings e datas do calendário usam `push`; digitação, filtros, abertura de menus e normalização de links antigos usam `replace`. O estado visual muda imediatamente, e o nuqs agrupa as escritas no histórico. Parâmetros externos não gerenciados pelo JohnBot e o hash são preservados.

`src/lib/url-state-policy.ts` define quais chaves pertencem a cada página. Ao sair do Marketplace, suas chaves `mp*` são removidas; ao sair de Workflows, `workflow` é removido. Parâmetros de conversa não ficam acumulados nas páginas de settings, uso ou calendário. URLs antigas com estados de várias páginas são normalizadas ao abrir.

Trocar de página fecha menus, submenus, listas e diálogos abertos. Fechar um painel remove `panel`, `panelTab`, `panelPanes` e `panelMax`. Fechar uma busca remove sua flag, texto e filtro. Fechar por Escape, clicar fora ou escolher uma opção atualiza as chaves correspondentes. Cada instância do seletor de modelos tem identidade explícita para evitar abrir pickers de telas diferentes juntos.

Componentes `Select` aceitam `queryKey` para registrar uma lista com identidade estável. Uma lista nova deve receber uma chave semântica e única, nunca um texto traduzido ou um índice. O controle externo de `open` continua tendo precedência nesses componentes.

## Estado que continua local

Este trabalho cobre os eixos de navegação e apresentação listados acima; não transforma cada booleano de cada componente em parâmetro. Tooltips, foco, hover, gestos, scroll, medidas e estados de carregamento continuam locais. Também ficam locais mensagens em edição, arquivos em memória, segredos, sessões de pareamento, confirmações e ações de conexão, publicação, instalação, gravação de voz e exclusão. A URL não inicia microfone nem confirma operações.

Uma prévia de arquivo precisa dos dados de preview obtidos pelo controlador; apenas `panel=file-preview` não contém esses dados. Threads novas sem mensagens continuam transitórias. O backend de conectores permanece o mock documentado na integração upstream.

## Verificação e delegação

```powershell
bun run test:url-state
bun run styles:check
bun run build
```

O teste de URL executa também as regressões de navegação, popups e conectores. Usa DOM simulado e StrictMode, verificando recarga da aplicação, Voltar/Avançar, parâmetros inválidos, isolamento de menus, buscas, painéis e preservação de parâmetros externos. Não usa navegador/controlador de tela.

A regressão de limpeza inclui a URL acumulada reportada pelo usuário, remoção das chaves ao fechar painéis/buscas, transições Marketplace → Workflows → Settings, IDs reais de threads principais e secundárias e substituição de mensagens enquanto a lista virtual ainda muda de conversa. As linhas virtuais têm chave por mensagem e isolam os hooks posteriores ao carregamento em outro componente; uma linha temporariamente sem mensagem não muda a quantidade de hooks da anterior.

O trabalho foi delegado em partes ao OpenCode com `opencode/deepseek-v4.1-flash-free#low`. A revisão principal corrigiu adaptações de valores React versus accessors, identidades de pickers, fechamento por Escape e caminhos de busca/perfil revelados pelos testes. Logs locais da delegação ficam em `.upstream-sync/nuqs-agent-*.jsonl`. O backup anterior está em `.upstream-sync/nuqs-before.tar`.

A revisão final gratuita encontrou quatro casos adicionais, corrigidos antes da entrega: preservar um canal salvo quando falta o parâmetro inicial, manter as outras abas ao fechar um painel restaurado, respeitar Voltar durante uma seleção lenta de servidor e evitar entradas idênticas no histórico do Marketplace. Os testes também atrasam respostas de listagens e de servidor para confirmar que uma navegação mais recente prevalece na interface e no mock do host.

[url-state-manifest.json](./url-state-manifest.json) registra hashes dos arquivos alterados e as sessões de delegação. Os logs do OpenCode informaram custo zero para os modelos gratuitos utilizados.

O build mantém a configuração existente `ignoreBuildErrors: true`; não equivale a uma checagem integral de tipos. A análise semântica dirigida encontrou diagnósticos legados da camada Solid/React; os novos módulos centrais de URL e parsers não apresentaram diagnósticos nessa análise.

Referências: [adaptadores](https://nuqs.dev/docs/adapters), [atualizações agrupadas](https://nuqs.dev/docs/batching), [opções de histórico](https://nuqs.dev/docs/options).
