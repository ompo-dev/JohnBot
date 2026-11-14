# Docker e runtime

O app continua sendo um cliente com dados simulados. A imagem não contém segredos,
não acessa serviços externos e não inclui Redis.

## Build local da saída standalone

O build padrão continua estático:

```sh
bun run build          # gera out/, usado por scripts/serve.ts
```

O Docker ativa o servidor Next standalone:

```sh
# PowerShell
$env:NEXT_STANDALONE="1"; bun run build:next; Remove-Item Env:NEXT_STANDALONE

# POSIX
NEXT_STANDALONE=1 bun run build:next
```

Saída esperada:

```text
.next/standalone/server.js
.next/standalone/.next/...
.next/static/...
public/...
```

O `next.config.ts` alterna `output` e `distDir` apenas quando
`NEXT_STANDALONE=1`. Sem a variável, `output: "export"` e `distDir: "out"` são
preservados.

## Executar a imagem com Compose

```sh
docker compose up --build
```

A aplicação fica em `http://localhost:3000` (ou `JOHNBOT_PORT`). O Compose usa:

- processo non-root `nextjs` (UID/GID 1001);
- `init: true`, `no-new-privileges` e `cap_drop: ALL`;
- healthcheck HTTP em `/`;
- `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`;
- `JOHNBOT_LOG_LEVEL` opcional (padrão `info`).

Não há perfil Redis. O app atual não usa Redis; adicionar um serviço agora
simularia uma integração que não existe. Quando houver cache real, o perfil e o
handler do Next devem ser implementados juntos e documentados.

## Build manual da imagem

```sh
docker build -t johnbot:local .
docker run --rm -p 3000:3000 --read-only=false johnbot:local
```

O Dockerfile é multi-stage:

1. `oven/bun:1.4.4-alpine` instala dependências com `--frozen-lockfile`.
2. O mesmo builder executa `bun run build:next` com `NEXT_STANDALONE=1`.
3. `node:24-alpine` recebe somente `public/`, `.next/standalone` e
   `.next/static`, cria o usuário `nextjs` e inicia `node server.js`.

## Segredos e contexto

`.dockerignore` exclui `.git`, `.env*`, logs, caches, `node_modules`, `out`,
`.next`, `dist`, `.agents`, `tools`, `docs` e artefatos do Tauri.
Nenhum valor de ambiente é copiado para a imagem. Variáveis de runtime devem ser
injetadas no container; não use `ARG`/`ENV` para segredos, pois eles ficariam no
histórico/camadas.

## Limitação atual desta máquina

O CLI Docker existe (`29.9.2`), mas o daemon/Compose não está em execução
(`docker info` falha). O Docker Desktop não foi iniciado nem instalado neste
trabalho. Portanto:

- `docker compose config` foi validado;
- o build real da imagem e o healthcheck do container não foram executados aqui;
- o build standalone e o `node server.js` foram validados diretamente fora do
  Docker;
- o workflow de CI executa `docker build` quando rodar em um runner com daemon.
