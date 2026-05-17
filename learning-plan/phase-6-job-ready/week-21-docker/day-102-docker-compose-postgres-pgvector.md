# Day 102 — docker-compose with Postgres + pgvector

## Goal
Write a `docker-compose.yml` that runs Postgres (with pgvector), Redis, and `ai-folio` together. After this day you can start the full data layer with one command and run Prisma migrations against the containerised database.

## Estimated time
~2 hours

## Prerequisites
Day 101 (ai-folio Dockerfile). Day 89 (pgvector setup understood).

## Where to put your code
In `ai-folio`.

## Explanation

**docker-compose** orchestrates multiple containers as named services in one YAML file. Services share a private Docker network and reach each other by service name — the app container connects to Postgres at `postgres:5432`, not `localhost:5432`. In Laravel terms this is Sail: one command brings up PHP, MySQL, and Redis without installing anything on the host.

**`ankane/pgvector`** is a pre-built Postgres image with the pgvector extension already compiled. Using it avoids building the extension from source. You enable it once in a Prisma migration (`CREATE EXTENSION IF NOT EXISTS vector`); after that every `migrate deploy` finds it ready.

**Named volumes** (`pgdata`, `redisdata`) persist data between `docker-compose down` / `up` cycles. Without a named volume, stopping the Postgres container deletes all rows. With one, data survives restarts; `docker-compose down -v` is the explicit opt-in to delete it.

## Step-by-step

### 1. Create docker-compose.yml

```yaml name=docker-compose.yml
version: '3.9'

services:
  postgres:
    image: ankane/pgvector:v0.7.4
    restart: unless-stopped
    environment:
      POSTGRES_USER: folio
      POSTGRES_PASSWORD: folio_secret
      POSTGRES_DB: folio_dev
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - '5433:5432'     # 5433 on host avoids clashing with a local Postgres
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U folio -d folio_dev']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - '6380:6379'     # 6380 on host to avoid clash
    volumes:
      - redisdata:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      target: runner       # multi-stage target — set up in Day 103
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

volumes:
  pgdata:
  redisdata:
```

The `app` service reads `ANTHROPIC_API_KEY` and `NEXTAUTH_SECRET` from the environment or a `.env` file at the project root (not `.env.local`). Never hardcode secrets in compose files.

### 2. Create .env for docker-compose

```bash name=.env
# Loaded by docker-compose — not committed to git
ANTHROPIC_API_KEY=sk-ant-...
NEXTAUTH_SECRET=change-me-to-a-long-random-string
```

Add `.env` to `.gitignore`:

```text name=.gitignore
# (add these lines if not present)
.env
.env.local
```

Note: `.env.local` is used by `pnpm dev`. `.env` is used by docker-compose. Two separate files, two separate contexts.

### 3. Start the data services only

```bash
docker-compose up postgres redis -d
```

The `-d` flag detaches (runs in background). Verify both services are healthy:

```bash
docker-compose ps
```

Both should show `healthy` in the status column.

### 4. Run Prisma migrations against Compose Postgres

While Postgres runs in Docker, expose it on host port 5433 and run Prisma from the host:

```bash
DATABASE_URL=postgresql://folio:folio_secret@localhost:5433/folio_dev \
  pnpm prisma migrate dev
```

After migration verify the pgvector extension is active:

```bash
docker-compose exec postgres psql -U folio -d folio_dev -c '\dx'
```

Expected: `vector` appears in the extensions list.

### 5. Start the full stack

```bash
docker-compose up --build
```

`--build` rebuilds the `app` image. The `depends_on` conditions guarantee Postgres is healthy before `app` starts, so there are no race-condition connection errors.

### 6. Useful compose commands

```bash
# Follow logs from all services
docker-compose logs -f

# Follow logs from a single service
docker-compose logs -f app

# Open a psql shell inside the container
docker-compose exec postgres psql -U folio -d folio_dev

# Stop all containers, keep volumes
docker-compose down

# Stop all containers and delete volumes (destructive)
docker-compose down -v
```

## Test it

```bash
docker-compose up --build -d
docker-compose logs -f app
```

Wait for `Ready on http://localhost:3000` in the logs. Then:

```bash
curl http://localhost:3000
```

Expected: HTML response (the portfolio homepage).

Tear down when done:

```bash
docker-compose down
```

## Mini-task
Add a `migrate` service to `docker-compose.yml` that runs `pnpm prisma migrate deploy` once on startup and then exits. Use `depends_on: postgres: condition: service_healthy` and set `restart: 'no'`. Make the `app` service depend on the `migrate` service with `condition: service_completed_successfully`.

## Glossary
- **docker-compose** — tool for defining and running multi-container applications from a single YAML file.
- **service** — a container definition in `docker-compose.yml`; services address each other by service name on a shared private network.
- **healthcheck** — command Docker runs periodically inside a container; `condition: service_healthy` waits for it to pass before starting dependent services.
- **named volume** — Docker-managed persistent storage; survives `docker-compose down`, deleted only with `down -v`.
- **`depends_on`** — controls startup order and optionally waits for health conditions.

## Resources
- [Docker Compose — reference](https://docs.docker.com/compose/compose-file/)
- [pgvector Docker image (ankane)](https://hub.docker.com/r/ankane/pgvector)
- [Compose healthcheck](https://docs.docker.com/compose/compose-file/05-services/#healthcheck)

## Checklist
- [ ] `docker-compose.yml` defines `postgres`, `redis`, `app` services
- [ ] `pgdata` and `redisdata` named volumes persist data
- [ ] `postgres` healthcheck passes before `app` starts
- [ ] Prisma migrations run against Compose Postgres on host port 5433
- [ ] `\dx` inside Postgres shows `vector` extension active
- [ ] `docker-compose up --build` brings up full stack successfully
