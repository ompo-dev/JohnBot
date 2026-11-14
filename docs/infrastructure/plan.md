# Plano de infraestrutura — JohnBot

Data: 2026-11-11
Estado do repositório antes deste plano: snapshot local sem Git, inicializado em
`53c2f73` como baseline sanitizado (sem `node_modules`, builds, caches, logs,
ferramentas de agente e arquivos de ambiente locais).

## Objetivo

Criar a menor base de produção completa para o app atual, sem substituir os mocks
e sem adicionar abstrações de aplicação ainda não usadas:

1. Docker multi-stage, non-root, com saída Next standalone e Compose funcional com mocks.
2. Biome com escopo útil e aplicável, sem reformatar o código legado em massa.
3. Husky com verificação apenas dos arquivos preparados no commit.
4. GitHub Actions com instalação congelada, checks, testes, build e build Docker.
5. Documentação de limites de cliente/servidor/cache e de deployment/CD.

## Auditoria inicial

- Gerenciador: Bun `1.4.4` (`packageManager` já fixado). Node `24.19.0`.
- Next `16.4.5`, React `19.3.1`, TypeScript `7.0.2`.
- `next.config.ts`: `output: "export"`, `distDir: "out"`, `images.unoptimized`,
  `typescript.ignoreBuildErrors: true` e aliases Turbopack para os shims
  Solid/Kobalte.
- O app é um cliente estático: `src/app/page.tsx` monta `ClientApp`; todos os dados
  vêm de `src/preview/mock-johnbot.ts` + `src/preview/demo-seed.ts`. Não há rotas
  de API, chamadas de rede reais nem dependência de servidor.
- Scripts existentes: `build` (`next build`), `start` (servidor Bun estático em
  `scripts/serve.ts`), testes de compatibilidade/URL em DOM simulado.
- `test:url-state` requer `jsdom` instalado localmente em devDependencies.
- Não existe `.github/`, Dockerfile, Compose, Biome ou Husky.
- Docker CLI existe (`29.9.2`), mas o daemon/Compose não está em execução. Não
  iniciar o Docker Desktop neste trabalho. Build real de imagem fica limitado;
  a configuração e a saída standalone serão validadas localmente.
- Sem remoto Git configurado: publicação GHCR e deploy remoto não têm metadados
  para serem configurados de forma honesta.

## Decisões

### Build

Manter `output: "export"` como padrão local. A variável explícita
`NEXT_STANDALONE=1` alterna para `output: "standalone"` e `distDir: ".next"` apenas
no build Docker. Isso preserva `bun run build`, `out/` e `scripts/serve.ts`, e
permite a imagem Next standalone pedida.

### Docker

- Builder `oven/bun:1.4.4-alpine`, instalação `bun install --frozen-lockfile`.
- Runner `node:24-alpine`, usuário `nextjs` (UID/GID 1001), porta 3000.
- Copiar `public/` e `.next/static` para o layout standalone.
- Healthcheck HTTP em `/`.
- Compose sem Redis: o app não usa cache Redis. Um perfil Redis agora simularia
  uma integração inexistente.
- `.dockerignore` exclui `.git`, `.env*`, logs, caches, `node_modules`, `out`,
  `.next`, `dist`, `.agents` e `src-tauri/target`.

### Biome

Escopo inicial:
- lint de correção em `src/`, `scripts/`, `stories/`, `tools/` com regras que o
  baseline já cumpre ou com supressões justificadas por arquivo/regra;
- formatação e organização de imports somente em arquivos novos de infraestrutura
  e configuração, sem reformatar o legado;
- CI executa `biome check` com o mesmo escopo; um arquivo sem correspondência
  (escopo vazio) deve falhar, não passar silenciosamente.

### Husky

- `prepare` chama um script Node que só instala hooks quando existe `.git` e o
  binário Git está disponível; em CI/container sem `.git`, sai com sucesso.
- `pre-commit` roda um script que coleta arquivos staged suportados e executa
  Biome neles. Sem arquivos aplicáveis, não falha; se houver, qualquer erro falha.
- Não usar lint-staged: uma dependência extra não é necessária.

### CI/CD

- GitHub Actions com `oven-sh/setup-bun@v2`, versão `1.4.4`, `bun install
  --frozen-lockfile`.
- Jobs: checks Biome, testes simulados, build Next, build Docker.
- Publicação GHCR somente quando existir repositório remoto e evento em branch
  confiável/tag. Sem remoto atual, não publicar e não inventar deploy.
- Nenhum segredo em build args, camadas, histórico ou Git. Variáveis públicas
  ficam em `.env.example`; runtime injeta valores no container.

## Fases e commits

1. `docs: add infrastructure implementation plan` (este documento).
2. `build: add standalone Docker and Compose runtime` — config condicional,
   Dockerfile, `.dockerignore`, Compose e documentação de execução.
3. `chore: add Biome checks with legacy-safe scope` — dependência, config,
   scripts e verificação de escopo.
4. `chore: add Husky staged checks` — setup tolerante a ausência de Git e hook.
5. `ci: add frozen checks, tests, build and Docker build` — workflow, `jsdom`
   local, documentação de deployment/CD e fronteiras futuras.
6. Relatório final em `.upstream-sync/infrastructure-report.md` (ignorado).

## Verificação por fase

- Biome: `bun run lint` e arquivo deliberadamente inválido/escopo vazio.
- Husky: execução do hook com e sem Git; hook não pode quebrar CI/container.
- Docker: `NEXT_STANDALONE=1 bun run build:next`, iniciar `server.js` localmente,
  `curl`/`Invoke-WebRequest`, `docker compose config` (se daemon não for necessário).
- Testes: `bun run test:url-state` com o ambiente local.
- Build padrão: `bun run build` continua gerando `out/`.
- CI: validar YAML e comandos localmente; execução remota depende de remoto.

## Limites e riscos

- `typescript.ignoreBuildErrors` continua `true`; nenhum relatório pode afirmar
  typecheck completo. Typecheck separado não será adicionado se o baseline falhar.
- Docker daemon parado: build de imagem e healthcheck real podem não ser
  executáveis nesta máquina.
- `jsdom` será adicionado como devDependency; isso altera `bun.lock`.
- Nenhum push, deploy, GHCR publish, Redis ou integração Axios/Zod será fingido.
- Mocks permanecem a fonte de dados. As fronteiras futuras serão documentadas,
  não implementadas.
