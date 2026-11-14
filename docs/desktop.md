# JohnBot Desktop (Windows)

JohnBot Desktop runs a native Tauri shell that orchestrates and displays the local JohnBot service stack.

## Prerequisites

1. **Windows 10 / 11 (64-bit)**
2. **Microsoft Edge WebView2 Runtime**:
   - Included in Windows 11 and updated Windows 10 installations.
   - The NSIS installer will detect and download WebView2 automatically if missing.
3. **Docker Desktop**:
   - Docker Desktop must be installed and running on your system with Linux container mode enabled.
   - JohnBot does not install Docker Desktop automatically.
4. **Local Docker Images**:
   - The desktop runtime uses pre-built local images with `pull_policy: never` for JohnBot services (`johnbot:local`, `johnbot:worker`, `johnbot:migrations`).
   - Build them locally before first launch:
     ```bash
     docker compose build
     docker build --target migrations --tag johnbot:migrations .
     docker build --target worker --tag johnbot:worker .
     ```
   - Standard base images (`postgres:17-alpine`, `redis:8-alpine`) pull from Docker Hub on initial start if not already cached.

## Data & Networking Model

- **Pure local backend**: The desktop app runs against the real local PostgreSQL and Redis service stack orchestrated via Docker Compose. There is no separate static in-memory fallback. (Note: seeded test datasets and mock connector catalog definitions remain available within the stack for simulation and local verification).
- **Named volumes**: Persistent database and cache data reside in named Docker volumes (`postgres-data` and `redis-data`). Stopping the app preserves all data.
- **Network binding**: The web container binds strictly to `127.0.0.1:3000`. PostgreSQL and Redis ports are not published to host interfaces.
- **Existing services**: If your JohnBot backend services are already healthy on launch, JohnBot connects immediately and skips starting new containers, preserving any running custom environment.

## Launch, Retry, and Error States

1. **Startup Check**: On open, the app checks if the service at `http://127.0.0.1:3000` is already healthy.
2. **Container Launch**: If unreachable, the app executes `docker compose -p johnbot -f <resource_dir>/runtime/compose.yaml up -d --wait --wait-timeout 120`.
3. **Docker Daemon Offline**: If Docker Desktop is stopped or daemon access fails, the app displays an error window indicating Docker is unreachable. Start Docker Desktop and click Retry.
4. **Missing Images**: If required local images (`johnbot:local`, `johnbot:worker`, `johnbot:migrations`) have not been built, Docker Compose fails to start containers. The app shows the startup error with actionable logs.
5. **Launch Timeout**: If container health checks do not pass within 120 seconds, startup aborts with a diagnostic error dialog.

## Configuration

Optional model environment variables (`JOHNBOT_DASHBOARD_MODEL`, `JOHNBOT_DASHBOARD_API_KEY`, `JOHNBOT_DASHBOARD_BASE_URL`) can be configured in your environment or passed to container runtime settings. Release builds do not embed any hardcoded credentials or API keys.

## Unsigned Binaries Notice

Release binaries built in CI are currently unsigned (no Authenticode code-signing certificate is attached). Because they lack a digital signature from an identified publisher, Windows SmartScreen will flag the binaries as being from an unknown publisher. Organizations should verify artifacts against published SHA256 checksums before deploying according to their internal security policy.

---

## JohnBot Desktop (Windows) — Português

O JohnBot Desktop executa um shell nativo Tauri que orquestra a stack de serviços JohnBot local.

### Modelo de Dados e Rede

- **Backend local real**: O aplicativo desktop conecta-se diretamente à stack local real com PostgreSQL e Redis via Docker Compose. Não há fallback estático puramente em memória; dados semeados e conectores simulados continuam existindo internamente para testes locais e simulação.
- **Interface local restrita**: A porta web escuta estritamente em `127.0.0.1:3000`. Portas de PostgreSQL e Redis não são expostas para interfaces externas do host.

### Binários Não Assinados

Os executáveis gerados no CI ainda não contêm certificado de assinatura de código Authenticode. Por isso, o Windows SmartScreen indicará publicação de origem não verificada. Verifique os hashes no arquivo `SHA256SUMS.txt` conforme a política de segurança da sua organização.
