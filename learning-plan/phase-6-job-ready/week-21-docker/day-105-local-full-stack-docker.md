# Day 105 — Local full stack with Docker

## Goal
Run the complete `ai-folio` stack locally — Next.js app, Postgres with pgvector, Redis — using a single `docker-compose up`. After this day you have a reproducible local environment that matches production, and you know how to debug connectivity between services.

## Estimated time
~2 hours

## Prerequisites
Day 103 (multi-stage Dockerfile). Day 102 (docker-compose basics). Day 104 (image optimised).

## Where to put your code
In `ai-folio`.

## Explanation

**Development vs production compose** is a common pattern: a base `docker-compose.yml` defines the canonical services, and a `docker-compose.override.yml` adds development conveniences (source code volume mounts, hot reload). Docker Compose merges them automatically when both files are present. In Laravel terms, this is like having `config/app.php` and `config/local/app.php` — the override layer adds without replacing.

**Volume mounts for development** let you edit source code on the host and have the container pick up changes without rebuilding. The trade-off: the host `node_modules` must not be mounted (it is platform-specific). Exclude it with an anonymous volume trick: `- /app/node_modules`.

**A health endpoint** (`/api/health`) gives docker-compose and load balancers a reliable signal that the app is ready — not just that the Node process started, but that it can actually connect to the database. Without it, `depends_on: condition: service_healthy` has nothing to check.

## Step-by-step

### 1. Add a health check Route Handler

```ts name=src/app/api/health/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' });
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 503 });
  }
}
```

This endpoint runs a trivial DB query. If Prisma can connect, it returns 200 OK. Docker uses this to determine when the app is truly ready.

### 2. Add an app healthcheck to docker-compose.yml

```yaml name=docker-compose.yml
  app:
    build:
      context: .
      target: runner
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://folio:folio_secret@postgres:5432/folio_dev
      REDIS_URL: redis://redis:6379
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: http://localhost:3000
    ports:
      - '3000:3000'
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO- http://localhost:3000/api/health || exit 1']
      interval: 15s
      timeout: 10s
      retries: 5
      start_period: 30s
```

`start_period` gives the app 30 seconds to start before healthcheck failures count as unhealthy. During Next.js startup this is necessary.

### 3. Create a development override file

```yaml name=docker-compose.override.yml
version: '3.9'

services:
  app:
    build:
      target: builder       # use builder stage for dev (has devDeps)
    command: pnpm dev       # hot-reload instead of node server.js
    volumes:
      - .:/app              # mount source code from host
      - /app/node_modules   # anonymous volume: prevent host node_modules overwriting container's
      - /app/.next          # anonymous volume: isolate Next.js build cache
    environment:
      WATCHPACK_POLLING: 'true'   # needed in WSL2 / Docker for Windows for file watch
```

Docker Compose auto-merges `docker-compose.override.yml` with `docker-compose.yml` in development. For production (CI, Fly.io) you run `docker-compose -f docker-compose.yml up` explicitly to skip the override.

### 4. Run Prisma migrate inside the compose network

Create a one-off migration service or run migrate directly:

```bash
# One-shot: run migrate inside the app container
docker-compose run --rm app sh -c \
  "DATABASE_URL=postgresql://folio:folio_secret@postgres:5432/folio_dev pnpm prisma migrate deploy"
```

Or add a dedicated service in `docker-compose.yml`:

```yaml name=docker-compose.yml
  migrate:
    build:
      context: .
      target: builder
    command: pnpm prisma migrate deploy
    environment:
      DATABASE_URL: postgresql://folio:folio_secret@postgres:5432/folio_dev
    depends_on:
      postgres:
        condition: service_healthy
    restart: 'no'
```

When using the `migrate` service, make `app` depend on it:

```yaml
    depends_on:
      migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
```

### 5. Full workflow

```bash
# 1. Start all services (first run — builds images and runs migrations)
docker-compose up --build

# 2. In another terminal: verify health
curl http://localhost:3000/api/health
# → {"status":"ok"}

# 3. Test the chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'

# 4. Open psql
docker-compose exec postgres psql -U folio -d folio_dev

# 5. Tail logs
docker-compose logs -f app

# 6. Rebuild only the app after code changes
docker-compose up --build app

# 7. Tear down (keep volumes)
docker-compose down

# 8. Full reset including volumes
docker-compose down -v
```

### 6. WSL2 and Docker Desktop notes

If running on WSL2 + Docker Desktop, set `WATCHPACK_POLLING=true` in the override file (already done in step 3) to enable file watching inside containers. Without it, Next.js HMR does not detect file changes from the host.

Keep the project directory inside the WSL2 filesystem (`/home/...`), not under `/mnt/c/...`. Docker mounts from `/mnt/c/...` are significantly slower.

## Test it

```bash
docker-compose up --build -d
sleep 30   # wait for Next.js to compile
curl http://localhost:3000/api/health
```

Expected: `{"status":"ok"}`.

Then navigate to `http://localhost:3000` in the browser. The full portfolio should load and the chat widget should respond (assuming a valid `ANTHROPIC_API_KEY` in `.env`).

```bash
docker-compose ps
```

All services should show `healthy` or `running`.

## Mini-task
Add a `docker-compose.prod.yml` file that overrides `restart: always` for all services and removes volume mounts. Document a one-liner to run production locally: `docker-compose -f docker-compose.yml -f docker-compose.prod.yml up`. This is the pattern used in CI before deploying to the real server.

## Glossary
- **`docker-compose.override.yml`** — automatically merged with `docker-compose.yml` by Compose; used for local development overrides.
- **Anonymous volume** — `- /app/node_modules`; creates an unnamed volume that shadows a host path, preventing it from being overwritten by a bind mount.
- **`service_completed_successfully`** — Compose condition that waits for a service to exit with code 0.
- **`start_period`** — healthcheck grace period during container startup; failures during this window do not count.
- **`WATCHPACK_POLLING`** — env var that enables inotify polling in Webpack/Turbopack; required for file watching in WSL2.

## Resources
- [Docker Compose — multiple compose files](https://docs.docker.com/compose/multiple-compose-files/merge/)
- [Next.js — Docker HMR in WSL2](https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack#resolving-webpack-errors)
- [Compose — `depends_on` conditions](https://docs.docker.com/compose/compose-file/05-services/#depends_on)

## Checklist
- [ ] `GET /api/health` returns `{"status":"ok"}` when DB is connected
- [ ] `healthcheck` added to `app` service in `docker-compose.yml`
- [ ] `docker-compose.override.yml` enables hot reload with volume mounts
- [ ] Prisma migrate runs against Compose Postgres (via `migrate` service or `docker-compose run`)
- [ ] `docker-compose up --build -d` brings up full stack
- [ ] `curl http://localhost:3000/api/health` returns 200
- [ ] Chat endpoint responds (SSE stream visible in curl output)
