# Relatório da camada de dados (entrega em fases)

Data: 2026-11-12
Base: `2bbd87b` + esta entrega
Escopo: projeto inteiro; esta entrega cobre o núcleo de conta, configurações, app info e uso.

## 1. O que foi entregue

| Área | Estado |
| --- | --- |
| Contratos Zod de request/response | Implementado |
| Cliente Axios compartilhado | Implementado |
| Ponte híbrida sobre `window.johnbot` | Implementado |
| Sessão por cookie + snapshot por tenant no Redis | Implementado |
| Idempotência atômica com fingerprint e replay | Implementado |
| Comandos allowlisted de conta | Implementado |
| Comandos allowlisted de preferências | Implementado |
| Cache de `getAppInfo` e `agent.getUsage` | Implementado |
| Redis interno no Compose com AOF/healthcheck | Implementado |
| Build padrão servindo `/api/*` | Implementado |
| Export estático/desktop preservado | Implementado por opt-in |
| Teste HTTP de integração | Implementado |
| Teste de outage do Redis | Implementado (opt-in no script) |

### Operações migradas

- `app.getAppInfo`
- `app.getAppLanguagePreference` / `setAppLanguagePreference`
- `app.getAppLogoColorPreference` / `setAppLogoColorPreference`
- `app.getAppAppearancePreference` / `setAppAppearancePreference`
- `app.getAppInterfaceSizePreference` / `setAppInterfaceSizePreference`
- `auth.getState`, `auth.retry`, `auth.requestEmailCode`, `auth.verifyEmailCode`,
  `auth.updateName`, `auth.updateAvatar`, `auth.logout`, `auth.listAccountSessions`,
  `auth.revokeAccountSession`
- `agent.getUsage`

Comandos allowlisted: `account.request-email-code`, `account.verify-email-code`,
`account.update-name`, `account.update-avatar`, `account.logout`,
`account.revoke-session`, `settings.set-language`, `settings.set-logo-color`,
`settings.set-appearance`, `settings.set-interface-size`.

## 2. O que foi testado e passou

Execução real em 2026-11-12:

- `bun install --frozen-lockfile` → 411 installs, sem mudanças no lockfile.
- `bun run check` → exit 0. O repositório já tinha 472 warnings de lint antes desta
  entrega; a contagem final é a mesma, sem novos warnings nos arquivos adicionados.
- `bun run test:url-state` → passou (uma primeira execução teve um aviso `act(...)`
  intermitente; a repetição passou, e a mesma suíte passava na base).
- `bun run styles:check` → 26.805 declarações e 25.560 declarações Tailwind verificadas.
- `bun run build` → build de servidor com as rotas `/api/*` listadas como dinâmicas.
- `bun run build:static` → export estático gerado em `out/`, sem route handlers.
- `bun run test:data-stack` (Redis local + `next start`) → todos os checks passaram.
- `docker compose up -d --build --wait` → `redis` e `web` healthy.
- `JOHNBOT_TEST_BASE_URL=http://127.0.0.1:3000 JOHNBOT_TEST_REDIS_OUTAGE=1
  bun run test:data-stack` → todos os checks passaram, incluindo outage e recuperação.
- `web` roda como `uid=1001(nextjs)`, Redis responde `appendonly yes` e não publica porta.
- `/` respondeu 200, asset `/_next/static/chunks/*.js` respondeu 200 e
  `/api/app-info` respondeu 200 com `X-Data-Generated-At`.

Cobertura do teste HTTP:

1. Página e asset servidos.
2. Cache hit de app info pelo `X-Data-Generated-At`.
3. Cache hit de usage por sessão.
4. Persistência de settings e leitura de volta.
5. Replay da mesma `Idempotency-Key` com `Idempotency-Replayed: true`.
6. Mesma chave com payload diferente → `409 idempotency_conflict`.
7. Payload inválido → `400 invalid_input`.
8. Comando fora da allowlist → `404 not_found`.
9. Oito duplicatas concorrentes → todas 200, exatamente uma execução do handler.
10. Isolamento entre dois jars de cookie independentes.
11. `logout` invalida `data:usage:<sessionId>` e a leitura seguinte é regenerada.
12. `AbortSignal` já abortado → cancelamento no cliente, sem request.
13. Redis parado → leitura e escrita retornam `503 storage_unavailable`; após reiniciar,
    o serviço volta a responder 200.

## 3. O que permanece local por natureza

Estas operações não atravessam a API HTTP porque dependem de SO, arquivos, processos,
segredos locais, janelas nativas ou eventos do desktop:

`voice`, `dynamicIsland`, `browserDock`, `agentDock`, `computerUse`, `macAutomation`,
`backgroundProcesses`, `browser`, `browserInput`, `attachmentImports`, `storage`,
`telemetry`, `instanceTransfer`, `plugins`, execução de `update`, `remoteDesktop`,
anexos/pastas/instruções locais, `providerRuntimes`, `providerDetection`, execução e
instalação de `acpRegistry`, `vault`, `passwordManagers` e conectores de cofre,
`mcpServers`, `agentAdmin`, `agentMemories`, `sharedTables`, `agentRoutines`,
`channelMemories`, `channelRoutines`, `routineFlows`, `workflows`, `routineResults`,
`agentAttachments`, `agentFolders`, `agentInstructions`, `agentImport`, `localServers`,
`notifications`, `maintenance`, `providers`, `customProviders`, `customAgents`,
`providerDetection`, `bitwardenConnector`, `onePasswordConnector`, `githubConnector`
(parte OAuth), `routineFeed`.

Eventos locais continuam no mock. Nas preferências, o setter remoto confirmado chama o
setter original do mock para emitir o evento na janela atual. Não há push entre abas ou
janelas.

## 4. Híbrido ainda não implementado (fases seguintes)

O projeto inteiro **não** está coberto. Continuam pendentes, com operações nomeadas:

- **Fase B — agentes/conversas:** `agent.listAgents`, `agent.listModels`, `agent.getStatus`,
  `conversation.*` (snapshot, páginas, busca, read state, reações, fila), `agent.sendMessage`.
  Exige transporte de streaming e cancelamento reais.
- **Fase C — rotinas/workflows:** `agentTasks.*`, `agentRoutines.*`, `routineFlows.*`,
  `routineResults.*`, `workflows.*`, `events.*`, `routineFeed.*`, com idempotência por `runId`.
- **Fase D — marketplace/catálogo:** `marketplace.*`, `marketplaceAgents.*`, `skills.*`,
  `agentTemplates.*`, `acpRegistry.search`.
- **Fase E — preferências restantes:** analytics, busy message mode, app behavior,
  remote session reuse, remote network route, agent defaults, approval automation,
  external link, `update.*`.
- **Fase F — colaboração/host/monetização:** `servers.*`, `host.*`, `hostAdmin.*`,
  `messaging.*`, `billing.*`, `license.*`, `hostedServers.*`, `hostedSites.*`,
  `linkAccount.*`, `githubConnector.*`.
- **Fase G — Cache Components:** migrar `unstable_cache` para `"use cache"`.

A matriz completa por grupo está em `docs/infrastructure/data-layer-plan.md`.

## 5. Desvios e decisões que precisam ser conhecidas

1. **Não existe backend upstream real.** A fonte de verdade é o seed de demonstração
   (`STORY_APP_INFO`, `STORY_USAGE`, `mock-auth.ts`). A camada prova o caminho
   Axios → Route Handler → Zod → Redis/cache, mas não integra um serviço externo.
2. **`unstable_cache` foi retido de propósito.** O Next 16.4.5 o marca como substituído
   por `"use cache"`; migrar exigiria `cacheComponents: true`, mudando a semântica de
   Suspense do App Router e o alvo de export estático. A migração é a fase G.
3. **Export estático não suporta Route Handlers.** `scripts/build-mode.mjs static` move
   `src/app/api` para `.static-build-api` durante o build e restaura em `finally`; o alvo
   usa `NEXT_PUBLIC_DATA_STACK=local` e o mock completo. O build de servidor é o padrão.
4. **Idempotência não é transacional entre crash e efeito.** O claim e o resultado ficam no
   Redis; uma queda depois do efeito e antes do resultado pode exigir nova tentativa. Não se
   promete exactly-once entre processos.
5. **Lock de snapshot é por processo.** O `withSnapshotLock` serializa escritas no mesmo
   processo; não é um lock distribuído. O Compose usa uma réplica.
6. **Invalidação de cache é por instância** com `unstable_cache`, também coerente com uma
   réplica.
7. **Redis sem porta publicada.** O teste local fora do Compose usa uma instância Redis
   temporária em `127.0.0.1:6379`; o `compose.yaml` mantém o Redis apenas na rede interna.
8. **`Secure` do cookie é opt-in.** `JOHNBOT_COOKIE_SECURE=1` deve ser usado atrás de HTTPS;
   o Compose local usa HTTP.
9. **TypeScript do projeto ignora erros no build.** Os arquivos novos foram mantidos
   type-clean e passam no Biome, mas o repositório inteiro não é type-checked pelo build.

## 6. Como operar

```bash
# servidor padrão (API + UI)
bun run build && bun run start

# preview estático/desktop (mock local)
bun run build:static && bun run preview

# stack completa com Redis interno
docker compose up -d --build --wait

# testes
bun run test:url-state
bun run test:data-stack
JOHNBOT_TEST_BASE_URL=http://127.0.0.1:3000 JOHNBOT_TEST_REDIS_OUTAGE=1 bun run test:data-stack
```

Variáveis:

- `REDIS_URL` (padrão `redis://127.0.0.1:6379`; no Compose `redis://redis:6379`).
- `JOHNBOT_COOKIE_SECURE=1` para HTTPS.
- `JOHNBOT_SESSION_TTL_SECONDS` (padrão 30 dias).
- `NEXT_PUBLIC_DATA_STACK=local` só é definido pelo build estático.
