Estado implementado e limites: [camada de dados atual](data-layer-current.md). A matriz abaixo registra o planejamento por fases.



# Plano e matriz de cobertura da camada de dados

Status: implementação em fases
Escopo: `JohnBot` inteiro (Next 16.4.5, React 19, export estático + standalone), preview web com `window.johnbot` mockado
Data: 2026-11-12

## 1. Objetivo

Substituir o mock de preview por uma camada de dados real e mantível **em todo o projeto**,
sem alterar UI/UX, sem depender de backend externo e sem transformar `window.johnbot` em um
RPC livre. O escopo final é o conjunto de operações que um backend real poderia possuir:
conta/identidade, uso, catálogo, configurações sincronizáveis, conversas, tarefas, rotinas,
workflows, marketplace e administração. Cada operação é classificada por natureza:

- **Servidor**: dado de rede/serviço, implementado nesta camada.
- **Local**: capacidade real do desktop, navegador, SO, arquivos, processos ou eventos
  nativos; permanece no mock/preload e não é fingida como servidor.
- **Híbrido**: dado que um backend real assumiria, mas que nesta entrega ainda não tem
  contrato ou fonte; fica explicitamente listado como trabalho restante, não como cobertura.

Esta entrega **não declara cobertura total**. Ela entrega um núcleo coerente e validado
(conta + configurações + app info/uso) e deixa as fases seguintes com operações concretas
nomeadas na seção 9.1.

Resultado esperado:

- Um cliente Axios compartilhado, com timeout, `AbortSignal`, erros normalizados e
  `Idempotency-Key` estável por mutação lógica.
- Contratos Zod explícitos para entrada e saída de cada operação exposta.
- Registro de comandos tipado, sem despacho dinâmico por caminho de objeto.
- Idempotência no servidor com Redis atômico, fingerprint do payload, escopo por sessão,
  TTL e resultado validado armazenado.
- Cache do Next (`unstable_cache`) apenas em leituras seguras, com TTL, tags e invalidação
  escopada por sessão.
- Sessão de demo isolada por cookie `httpOnly`, estado em Redis por sessão.
- Build/runtime padrão servindo a API; export estático preservado por opt-in explícito.
- Redis no Compose interno, com persistência e healthcheck, sem porta publicada.

## 2. Restrições e decisões de arquitetura

### 2.1 O que é real e o que é mock

Não existe backend upstream real neste projeto. A camada de dados exercita o caminho
completo (Axios → Route Handler → validação Zod → comando → Redis → cache), mas a fonte de
verdade do domínio continua sendo o seed de demonstração:

- `src/preview/fixtures.ts` (`STORY_APP_INFO`, `STORY_USAGE`)
- `src/preview/mock-auth.ts` (conta assinada, sessões)
- `src/preview/mock-johnbot.ts` (comportamento de `getAppInfo`, `auth.*`, `agent.getUsage`)

Isso é uma adaptação deliberada: o projeto é um preview de UI sem credenciais de backend.
O relatório final deve declarar que o "upstream" é o seed local, não um serviço remoto.

### 2.2 Fronteira central

`src/app/ClientApp.tsx` instala a ponte de dados quando `window.johnbot` não existe. Por
padrão (build de servidor) instala `createHybridjohnBot()`; no build estático/desktop
(`NEXT_PUBLIC_DATA_STACK=local`) instala `createMockjohnBot(DEMO_OPTIONS)` como antes. O
preload do Tauri/desktop continua intocado: se `window.johnbot` já existe, nada é
sobrescrito.

A ponte híbrida:

1. cria o mock completo;
2. substitui apenas um subconjunto explícito e allowlisted por chamadas HTTP;
3. mantém eventos, assinaturas e capacidades locais no mock.

Não há proxy genérico, não há `runCommand(path, payload)`, não há invocação por string de
caminho.

### 2.3 Operações expostas (allowlist)

| Operação | Canal IPC | Tipo | Cache |
| --- | --- | --- | --- |
| `getAppInfo` | `app:get-info` | leitura | `unstable_cache`, tag global |
| `getAppLanguagePreference` | `app:get-language-preference` | leitura de sessão | não |
| `setAppLanguagePreference` | `app:set-language-preference` | mutação | não |
| `getAppLogoColorPreference` | `app:get-logo-color-preference` | leitura de sessão | não |
| `setAppLogoColorPreference` | `app:set-logo-color-preference` | mutação | não |
| `getAppAppearancePreference` | `app:get-appearance-preference` | leitura de sessão | não |
| `setAppAppearancePreference` | `app:set-appearance-preference` | mutação | não |
| `getAppInterfaceSizePreference` | `app:get-interface-size-preference` | leitura de sessão | não |
| `setAppInterfaceSizePreference` | `app:set-interface-size-preference` | mutação | não |
| `auth.getState` | `auth:get-state` | leitura de sessão | não |
| `auth.retry` | `auth:retry` | leitura de sessão | não |
| `auth.requestEmailCode` | `auth:request-email-code` | mutação | não |
| `auth.verifyEmailCode` | `auth:verify-email-code` | mutação | não |
| `auth.updateName` | `auth:update-name` | mutação | não |
| `auth.updateAvatar` | `auth:update-avatar` | mutação | não |
| `auth.logout` | `auth:logout` | mutação | não |
| `auth.listAccountSessions` | `auth:list-account-sessions` | leitura de sessão | não |
| `auth.revokeAccountSession` | `auth:revoke-account-session` | mutação | não |
| `agent.getUsage` | `agent:get-usage` | leitura | `unstable_cache`, tag por sessão |

O restante de `auth` (Mobile Connect, company sign-in, `updateChatColor`) permanece no mock
nesta fase. `agent.getUsage` continua aceitando `agentId` opcional como o mock.

### 2.4 Segunda fase incluída nesta entrega: preferências sincronizáveis

As preferências de aparência/idioma/logo/tamanho são um caso híbrido: no desktop pertencem
ao processo principal, mas no preview web podem ser persistidas por sessão no servidor. Elas
são incluídas porque exercitam outro domínio (settings), outro tipo de contrato (objeto
aninhado) e o mesmo caminho de comando/idempotência.

Semântica de eventos: os setters remotos, depois de confirmados pelo servidor, chamam também
o setter local do mock para emitir `onAppLanguagePreference`, `onAppLogoColorPreference`,
`onAppAppearancePreference` e `onAppInterfaceSizePreference` na janela atual. O servidor é a
persistência; o mock continua sendo o barramento local. Não há push entre abas/janelas.

### 2.5 Estratégia de cache (decisão explícita)

O guia local do Next 16.4.5 marca `unstable_cache` como substituído por `"use cache"` e
recomenda Cache Components. Esta entrega **retém `unstable_cache`** por decisão consciente:

- `"use cache"` exige `cacheComponents: true`, que muda a semântica de renderização e o
  contrato de Suspense do App Router inteiro; o app é client-heavy e o export estático
  continua sendo um alvo suportado.
- `unstable_cache` continua documentado e funcional nesta versão exata para funções
  assíncronas fora de `fetch` em Route Handlers, que é o caso aqui.
- A migração para `"use cache"` fica registrada como fase G, quando Cache Components for
  adotado de ponta a ponta; não é necessária para provar cache, tags e invalidação.

O cache é usado apenas em `getAppInfo` e `agent.getUsage`. Preferências, estado de auth e
lista de sessões nunca entram no cache.

## 3. Contratos (`src/contracts/data-api.ts`)

- Schemas Zod 4 para payloads e respostas.
- Tipos exportados derivados de `z.infer` e verificados contra os tipos de `@johnbot/contracts/ipc`
  quando aplicável.
- Envelope de erro:

```ts
type ApiErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
    requestId: string;
    retryAfterSeconds?: number;
    details?: unknown;
  };
};
```

Códigos estáveis: `invalid_input`, `unauthorized`, `not_found`, `conflict`,
`idempotency_conflict`, `idempotency_in_progress`, `storage_unavailable`,
`upstream_unavailable`, `cancelled`, `internal_error`.

- Avatar: `{ mimeType: "image/png" | "image/jpeg" | "image/webp", bytesBase64: string }`.
  O cliente converte `Uint8Array` usando os helpers existentes em `src/team-client/base64.ts`.
  O servidor valida tamanho (máx. 256 KiB decodificados) e prefixo do MIME.
- `agent.getUsage` valida `limits` com o schema de `AccountUsage`.

## 4. Servidor

### 4.1 Diretórios

```
src/server/
  env.ts                 # validação server-only, sem import no bundle do cliente
  redis.ts               # cliente lazy, ping, fail-closed
  session.ts             # cookie, criação/carregamento do snapshot
  session-store.ts       # snapshot por sessão no Redis
  idempotency.ts         # claim atômico, fingerprint, resultado
  cache.ts               # unstable_cache + tags
  http.ts                # resposta/erro normalizados
  errors.ts              # ApiError e mapeamento HTTP
  commands/
    types.ts             # contrato de comando
    index.ts             # allowlist tipada (account + settings)
    account.ts           # handlers de conta
    settings.ts          # handlers de preferências
src/app/api/
  app-info/route.ts
  account/state/route.ts
  account/sessions/route.ts
  settings/route.ts
  usage/route.ts
  commands/[command]/route.ts
src/lib/api/
  client.ts              # Axios compartilhado
  errors.ts              # ApiError
  bridge.ts              # overrides do mock
```

Todos os Route Handlers usam `export const runtime = "nodejs"` e `export const dynamic = "force-dynamic"`
(leituras com cookie/cache controlado explicitamente).

### 4.2 Sessão e isolamento

- Cookie: `johnbot_session`, `httpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=30 dias`.
- `Secure` somente quando `JOHNBOT_COOKIE_SECURE=1`; Docker local em HTTP continua funcionando.
- Valor: UUID aleatório (128 bits). Nunca contém e-mail, nome ou credencial.
- Chave Redis: `johnbot:session:<sessionId>`, TTL de 30 dias renovado em escrita.
- Snapshot inicial (por sessão):
  - `auth`: `{ status: "signed_in", user: { id: "user-1", email: "person@example.com", name: "Norbert", avatarUrl: null } }`
  - `sessions`: as quatro sessões de `mock-auth.ts`, com `current: true` na sessão de desktop principal
  - `usage`: `STORY_USAGE`
- Nenhum estado mutável global compartilhado entre tenants. Duas sessões nunca leem o
  snapshot uma da outra.
- `listAccountSessions` retorna somente o snapshot da própria sessão.
- `revokeAccountSession` remove apenas a sessão da lista do próprio tenant (comportamento do mock).

### 4.3 Idempotência

Formato:

```
johnbot:idem:<sessionId>:<command>:<clientKey>
```

- `clientKey`: header `Idempotency-Key`, 8–128 caracteres `[A-Za-z0-9._:-]`.
- Claim: `SET key <json-pending> NX PX 30000`.
- Fingerprint: SHA-256 de `command + "\n" + sessionId + "\n" + canonicalJson(payload)`.
- Valor pendente: `{ state: "pending", fingerprint }`.
- Valor concluído: `{ state: "completed", fingerprint, data, completedAt }`, TTL 24 h.
- Mesma chave + fingerprint diferente: HTTP `409 idempotency_conflict`, sem executar.
- Mesma chave + mesmo fingerprint + concluído: devolve o body armazenado com
  `Idempotency-Replayed: true`, sem executar.
- Mesma chave + mesmo fingerprint + pendente: polling interno limitado (~1,5 s, 25 ms);
  se ainda pendente, HTTP `409 idempotency_in_progress`.
- Falha do handler remove o claim (best effort) para permitir nova tentativa.
- Redis indisponível: **fail closed**. Nenhuma mutação executa; HTTP `503 storage_unavailable`.
- Não há promessa de exactly-once entre crash do processo e escrita não transacional. O
  claim e o resultado ficam no Redis; uma queda depois do efeito e antes do resultado pode
  exigir nova tentativa. Isso será documentado no `report.md`.

### 4.4 Leituras e cache

- `getAppInfo`: `unstable_cache` com TTL de 1 h e tag `data:app-info`.
- `agent.getUsage`: `unstable_cache` com TTL de 30 s e tag `data:usage:<sessionId>`; a chave
  inclui `sessionId` e `agentId`.
- Nunca cachear: `auth.getState`, lista de sessões, erros, respostas com cookie, dados de
  credencial.
- Mutação `logout` e `verifyEmailCode` chamam `revalidateTag("data:usage:<sessionId>", { expire: 0 })`.
- O cookie é lido fora do escopo de cache e passado como argumento; `cookies()` não é chamado
  dentro de `unstable_cache` (limitação documentada do Next).
- Para tornar cache observável em teste, as rotas de leitura devolvem o header
  `X-Data-Generated-At` com o instante em que o valor entrou no cache. Duas leituras dentro
  do TTL repetem o mesmo valor; invalidação produz um valor novo.

## 5. Cliente

### 5.1 Axios compartilhado

- `axios.create({ baseURL: "", timeout: 15_000, withCredentials: true })`.
- Timeout curto para leitura (8 s) e mutação (15 s), aplicável por chamada.
- `AbortSignal` repassado do chamador; `ERR_CANCELED` vira `ApiError` com código `cancelled`.
- Erros normalizados: status HTTP, código do envelope, `requestId`, `Retry-After`.
- Sem retry automático de escrita. Nenhum retry cego.
- Toda mutação recebe uma `Idempotency-Key` criada uma vez por chamada lógica
  (`crypto.randomUUID()`). O mesmo valor é reutilizado se o chamador reenviar a mesma
  operação explicitamente; o cliente não reenvia sozinho.

### 5.2 Ponte híbrida

`createHybridjohnBot()`:

- chama `createMockjohnBot(DEMO_OPTIONS).api`;
- substitui `getAppInfo`, `auth.getState`, `auth.retry`, `auth.requestEmailCode`,
  `auth.verifyEmailCode`, `auth.updateName`, `auth.updateAvatar`, `auth.logout`,
  `auth.listAccountSessions`, `auth.revokeAccountSession`, `agent.getUsage`;
- mantém `auth.onEvent` e todos os demais grupos no mock;
- normaliza `AvatarImageInput` ↔ base64.

Eventos de auth continuam locais. A UI atual aplica respostas de mutação diretamente, então
não há regressão funcional; isso será declarado como limitação de push entre janelas.

## 6. Runtime, build e Docker

- Padrão: `next build` (servidor Next, não export) e `next start`.
- `NEXT_STATIC_EXPORT=1`: `output: "export"`, `distDir: "out"` e preview por `scripts/serve.ts`.
- Scripts:
  - `build` → build de servidor
  - `start` → `next start`
  - `build:static` → export estático (`NEXT_STATIC_EXPORT=1`)
  - `start:static` / `preview` → `bun scripts/serve.ts`
  - `dev` → `next dev`
- Docker continua usando `NEXT_STANDALONE=1` e `output: "standalone"`.
- `compose.yaml` adiciona `redis`:
  - imagem `redis:8-alpine`
  - `appendonly yes`, volume nomeado, `--save 60 1`
  - healthcheck `redis-cli ping`
  - sem `ports`
  - `web` depende de `redis: service_healthy`
  - `REDIS_URL=redis://redis:6379`
- CI roda `bun run check`, `test:url-state`, `bun run build` e `test:data-stack` contra um
  serviço Redis, além do build e smoke da imagem Docker.
- O build estático não pode conter Route Handlers. `scripts/build-mode.mjs` move
  `src/app/api` para `.static-build-api` durante o build estático e o restaura em `finally`;
  esse alvo usa `NEXT_PUBLIC_DATA_STACK=local` e o mock completo.

## 7. Testes

Manter `test:url-state` como está. Adicionar `test:data-stack` (script Bun + Axios):

1. `GET /api/app-info` duas vezes → mesmo `X-Data-Generated-At` (cache hit).
2. `GET /api/usage` duas vezes → mesmo `X-Data-Generated-At`.
3. `POST /api/commands/account.update-name` → novo nome em `GET /api/account/state`.
4. Repetir a mesma `Idempotency-Key` e o mesmo payload → mesmo resultado,
   `Idempotency-Replayed: true`, sem duplicar efeito.
5. Mesma chave com payload diferente → `409 idempotency_conflict`.
6. Duas requisições concorrentes com a mesma chave → uma executa, a outra replay/`in_progress`;
   o estado final tem um único efeito.
7. Payload inválido (nome vazio) → `400 invalid_input`.
8. `AbortSignal` já abortado → `cancelled`.
9. Duas sessões independentes → nomes e listas de sessões isolados.
10. `logout` invalida `data:usage:<sessionId>`; leitura seguinte tem novo
    `X-Data-Generated-At` e `limits: []`.
11. Redis parado → mutação e leitura de sessão devolvem `503 storage_unavailable`; após
    reiniciar, o serviço volta. O cenário roda com `JOHNBOT_TEST_REDIS_OUTAGE=1` quando o
    servidor está no Compose (o script para e reinicia somente o serviço `redis`).

O teste usa jars de cookie separados (Axios + `Cookie` header manual) para provar isolamento.

## 8. Fases de implementação e commits

1. **docs**: este plano + matriz de cobertura por grupo e por operação.
2. **deps/contracts**: Axios, `redis`, Zod contracts, lockfile congelado.
3. **server core**: env, Redis, sessão, store, idempotência, comandos de conta, rotas de
   app info/estado/sessões/uso, cache de app info/uso.
4. **client core**: Axios, erros, ponte híbrida de conta, integração em `ClientApp`.
5. **settings**: contratos e comandos de idioma, logo, aparência e tamanho; store por sessão;
   ponte híbrida com emissão de eventos locais após confirmação.
6. **runtime**: scripts, `next.config.ts`, Docker, Compose, CI, docs de runtime.
7. **tests**: script de integração e ajustes (conta, settings, cache, idempotência, outage).
8. **validation e expansão**: `bun run check`, `test:url-state`, `styles:check`,
   `test:data-stack`, builds, instalação congelada, `docker compose up -d --build --wait`,
   HTTP/assets/health, outage do Redis, `report.md`. Em seguida, executar as fases da seção
   9.1 em commits separados, se o núcleo estiver validado.

Cada commit inclui apenas arquivos da fase e testes aplicáveis.

## 8.1 Critério de conclusão

Esta entrega só pode ser chamada de "operacional" quando o núcleo (conta + settings + app
info/uso) estiver validado em Docker com Redis. Ela **não** pode ser chamada de "projeto
inteiro coberto": a seção 9.1 nomeia o que resta. O `report.md` deve separar explicitamente
"implementado e testado", "mantido local por natureza" e "híbrido ainda não implementado".

## 9. Matriz de cobertura por grupo IPC

Classificação:

- **Server**: operações migradas para a camada real nesta entrega.
- **Local**: permanece no mock; depende de desktop, navegador, SO, processos ou eventos nativos.
- **Híbrido futuro**: dados que um backend real poderia assumir, mas fora do escopo desta fase.

| Grupo | Caminho | Requests/eventos | Decisão | Motivo |
| --- | --- | --- | --- | --- |
| app | `""` | 37/13 | Server parcial (`getAppInfo` + 8 operações de preferência) | Informação da aplicação e preferências sincronizáveis; janelas, eventos e integrações nativas continuam locais. |
| maintenance | `maintenance` | 2/0 | Local | Exporta dados/arquivos do desktop. |
| providers | `""` | 20/0 | Local | Processos e CLIs locais dos provedores. |
| providerRuntimes | `providerRuntimes` | 6/1 | Local | Download/execução de binários no computador. |
| voice | `voice` | 29/5 | Local | Modelos, áudio, microfone e servidores locais. |
| dynamicIsland | `dynamicIsland` | 10/4 | Local | Janela nativa e geometria de tela. |
| browserDock | `browserDock` | 4/3 | Local | Overlay nativo do navegador. |
| agentDock | `agentDock` | 8/4 | Local | Janela nativa, displays e arraste. |
| computerUse | `computerUse` | 6/1 | Local | Permissões e driver do SO. |
| macAutomation | `macAutomation` | 1/0 | Local | Apple Events. |
| backgroundProcesses | `backgroundProcesses` | 2/0 | Local | Processos do SO. |
| skills | `skills` | 15/0 | Local / Híbrido futuro | Arquivos locais e marketplace; sem backend real. |
| customProviders | `customProviders` | 4/0 | Local | Configuração local e chaves. |
| providerDetection | `providerDetection` | 5/0 | Local | Varredura de rede local. |
| acpRegistry | `acpRegistry` | 6/0 | Local | Instalação de agentes ACP locais. |
| customAgents | `customAgents` | 5/0 | Local | Processos locais. |
| providerAdmin | `providerAdmin` | 37/0 | Local / Híbrido futuro | Administração de conta do provedor exige backend real. |
| messaging | `messaging` | 56/0 | Híbrido futuro | Integrações externas (Slack, Telegram etc.) sem credenciais. |
| hostAdmin | `hostAdmin` | 34/0 | Híbrido futuro | Administração de host/servidor real. |
| githubConnector | `githubConnector` | 14/1 | Local / Híbrido futuro | OAuth e rede externa. |
| bitwardenConnector | `bitwardenConnector` | 6/1 | Local | Cofre local. |
| passwordManagers | `passwordManagers` | 10/1 | Local | Credenciais locais. |
| linkAccount | `linkAccount` | 4/1 | Híbrido futuro | Vínculo com serviço externo. |
| vault | `vault` | 16/1 | Local | Cofre local. |
| onePasswordConnector | `onePasswordConnector` | 11/1 | Local | Cofre local. |
| hostedSites | `hostedSites` | 5/0 | Híbrido futuro | Publicação externa. |
| routineFeed | `routineFeed` | 3/0 | Local | Feed derivado de rotinas locais. |
| billing | `billing` | 2/0 | Híbrido futuro | Cobrança externa. |
| license | `license` | 5/0 | Híbrido futuro | Licenciamento externo. |
| hostedServers | `hostedServers` | 9/0 | Híbrido futuro | Servidores hospedados reais. |
| localServers | `localServers` | 3/0 | Local | Descoberta na rede local. |
| marketplaceAgents | `marketplaceAgents` | 7/0 | Híbrido futuro | Catálogo remoto. |
| agentTemplates | `agentTemplates` | 6/1 | Híbrido futuro | Catálogo remoto. |
| auth | `auth` | 25/1 | Server (subconjunto) | Conta/identidade/uso; Mobile Connect e company sign-in ficam locais. |
| update | `update` | 9/2 | Local | Atualização do binário desktop. |
| notifications | `notifications` | 4/1 | Local | Notificações nativas. |
| agent | `agent` | 82/1 | Server (somente `getUsage`) | O resto executa agentes, arquivos, canais e tarefas locais. |
| agentMemories | `agent` | 7/0 | Local | Memória local do agente. |
| sharedTables | `agent` | 2/0 | Local | Estado local. |
| agentRoutines | `agent` | 8/0 | Local | Agendamento local. |
| channelMemories | `agent` | 5/0 | Local | Estado local. |
| channelRoutines | `agent` | 6/0 | Local | Agendamento local. |
| routineFlows | `routineFlows` | 6/0 | Local | Execução local de fluxos. |
| workflows | `workflows` | 22/0 | Local | Execução local. |
| routineResults | `routineResults` | 5/0 | Local | Resultados locais. |
| agentAttachments | `agent` | 12/1 | Local | Arquivos do computador. |
| agentFolders | `agent` | 8/0 | Local | Sistema de arquivos. |
| agentInstructions | `agent` | 3/0 | Local | Arquivos locais. |
| attachmentImports | `null` | 1/1 | Local | Drop/paste do preload. |
| browser | `browser` | 21/3 | Local | Navegador embutido e abas. |
| browserInput | `browser` | 1/0 | Local | Entrada do navegador. |
| servers | `servers` | 27/5 | Híbrido futuro | Servidores/equipe exigem backend real. |
| agentAdmin | `agent` | 37/0 | Local | Configuração local de agentes. |
| mcpServers | `agent` | 16/0 | Local | Processos e segredos locais. |
| storage | `storage` | 9/0 | Local | Disco local. |
| telemetry | `telemetry` | 1/0 | Local | Leituras do SO. |
| agentImport | `agentImport` | 9/0 | Local | Importação de arquivos. |
| instanceTransfer | `instanceTransfer` | 6/0 | Local | Exportação/importação local. |
| plugins | `plugins` | 1/1 | Local | Plugins locais. |
| marketplace | `marketplace` | 1/1 | Híbrido futuro | Catálogo remoto. |
| host | `host` | 19/1 | Híbrido futuro | Host/equipe real. |
| events | `events` | 10/0 | Local | Webhooks e rotinas locais. |
| remoteDesktop | `remoteDesktop` | 7/1 | Local | Captura de tela e rede local. |

Resumo desta entrega: 63 grupos. Operações migradas: `app.getAppInfo`, 8 operações de
preferência em `app`, 10 operações de conta em `auth` e `agent.getUsage`. Os demais grupos
permanecem locais ou estão na seção 9.1 como trabalho restante. Nenhuma linha "Híbrido
futuro" é contada como cobertura.

## 9.1 Fases seguintes (operações restantes nomeadas)

Estas fases não são "nice to have": são a continuação do escopo do projeto inteiro. Cada uma
deve virar commit próprio, com contratos, comandos, idempotência quando houver mutação,
testes e atualização desta matriz.

### Fase B — Agentes e conversas

- Leituras: `agent.listAgents`, `agent.listModels`, `agent.getStatus`,
  `conversation.getSnapshot`, `conversation.readPage`, `conversation.searchMessages`,
  `conversation.searchFiles`, `conversation.getReadState`.
- Mutações: `agent.sendMessage`, `conversation.respondToPrompt`,
  `conversation.setReaction`, `conversation.markRead`, `conversation.markUnread`,
  `conversation.deleteMessage`, `conversation.editQueuedMessage`, `conversation.cancelQueuedMessage`.
- Sincronização: `agent:event` e eventos de conversa deixam de ser mock puro; execução de
  turno continua local ao desktop, mas transcrição/estado persistido passa pelo servidor.
- Dependência: streaming e cancelamento com `AbortSignal`; nenhum evento de push sem
  transporte real (SSE/WebSocket) definido.

### Fase C — Rotinas, tarefas e workflows

- `agentTasks.*`, `agentRoutines.*`, `routineFlows.*`, `routineResults.*`, `workflows.*`,
  `events.*`, `routineFeed.*`.
- Definições, histórico de runs e resultados no servidor; agendador/executor permanece no
  processo local até existir um worker real.
- Dependência: concorrência de runs e idempotência por `runId`, não por clique.

### Fase D — Marketplace e catálogo

- `marketplace.getState`, `marketplaceAgents.list/get/install`, `skills.list/get/getBySlug/
  install/local*`, `agentTemplates.list/get/install`, `acpRegistry.search`.
- Download/instalação de pacotes continua local; o catálogo e os metadados passam pelo
  servidor.
- Dependência: cache com tags por catálogo, invalidação em instalação/publicação.

### Fase E — Preferências restantes

- `app.getAnalyticsPreference` / `setAnalyticsPreference`,
  `getBusyMessageModePreference` / `set...`, `getAppBehaviorPreference` / `set...`,
  `getRemoteSessionReusePreference` / `set...`, `getRemoteNetworkRoute` / `set...`,
  `getAgentDefaults` / `set...`, `getApprovalAutomation` / `onApprovalAutomation`,
  `app.getExternalLinkPreference` / `set...`, `update.*`.
- Manter eventos locais via mock após confirmação remota, como na fase de settings atual.

### Fase F — Colaboração, host e monetização

- `servers.*`, `host.*`, `hostAdmin.*`, `messaging.*`, `billing.*`, `license.*`,
  `hostedServers.*`, `hostedSites.*`, `linkAccount.*`, `githubConnector.*`.
- Exige backend/credenciais reais e isolamento multi-tenant forte; não deve ser simulada
  como se fosse cobertura real.

### Fase G — Cache Components

- Migrar `unstable_cache` para `"use cache"` + `cacheLife`/`cacheTag` quando
  `cacheComponents: true` for adotado no app inteiro, com testes de invalidação equivalentes.

### Exclusões permanentes (capacidade local)

`voice`, `dynamicIsland`, `browserDock`, `agentDock`, `computerUse`, `macAutomation`,
`backgroundProcesses`, `browser`, `browserInput`, `attachmentImports`, `storage`,
`telemetry`, `instanceTransfer`, `plugins`, `update` (execução), `remoteDesktop`,
`attachment`/`folder`/`instructions` locais, `providerRuntimes`, `providerDetection`,
`acpRegistry` (execução/instalação), `vault`/`passwordManagers`/conectores de cofre.
Essas operações não devem atravessar a API HTTP: dependem de SO, arquivos, processos,
segredos locais ou sessões nativas.

## 10. Riscos e trade-offs

- **Sem upstream real**: a camada prova o desenho, não integra um serviço externo. O relatório
  precisa ser explícito.
- **Push de auth ausente**: `auth.onEvent` continua mock. A janela atual reflete mutações
  porque a UI aplica a resposta; outras janelas/abas não recebem push real.
- **Idempotência não transacional**: Redis guarda claim e resultado, mas o efeito no seed é
  local ao processo. Não se promete exactly-once após crash.
- **Cache em processo**: `unstable_cache` é o mecanismo suportado no modelo atual do Next
  (sem Cache Components). Em múltiplas réplicas, a invalidação é por instância; o Compose usa
  uma réplica.
- **Cookie sem `Secure` local**: necessário para HTTP em Docker; produção deve definir
  `JOHNBOT_COOKIE_SECURE=1`.
- **TypeScript do projeto ignora erros no build**: a nova camada será mantida type-clean e
  coberta por Biome, mas isso não garante o repositório inteiro.
