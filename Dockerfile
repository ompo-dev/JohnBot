# syntax=docker/dockerfile:1.7

FROM oven/bun:1.4.4-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY scripts/setup-husky.mjs ./scripts/setup-husky.mjs
RUN bun install --frozen-lockfile

FROM oven/bun:1.4.4-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build:standalone

FROM oven/bun:1.4.4-alpine AS worker-deps
WORKDIR /app
COPY infra/worker/package.json infra/worker/bun.lock ./
RUN --mount=type=cache,id=johnbot-worker-bun,target=/root/.bun/install/cache bun install --frozen-lockfile

FROM worker-deps AS migrations
COPY . .
RUN bun run db:generate
CMD ["sh", "-c", "bun run db:migrate && bun run db:import-redis"]

FROM oven/bun:1.4.4-alpine AS worker-runtime-deps
WORKDIR /app
COPY infra/worker/package.json infra/worker/bun.lock ./
RUN --mount=type=cache,id=johnbot-worker-bun,target=/root/.bun/install/cache bun install --frozen-lockfile --production

FROM oven/bun:1.4.4-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=worker-runtime-deps /app/node_modules ./node_modules
COPY --from=migrations /app/src/server ./src/server
COPY --from=migrations /app/src/generated ./src/generated
COPY src/workers/background.worker.ts ./src/workers/background.worker.ts
USER nextjs
CMD ["bun", "src/workers/background.worker.ts"]

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs \
  && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
