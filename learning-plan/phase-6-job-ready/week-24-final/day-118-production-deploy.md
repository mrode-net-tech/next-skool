# Day 118 — Production deploy (Fly.io)

## Goal
Deploy `ai-folio` — Next.js app + BullMQ worker + Postgres + Redis — to Fly.io in a production configuration. After this day the site is live at a public URL with TLS, database migrations run automatically, and the worker processes jobs in production.

## Estimated time
~3 hours

## Prerequisites
Day 117 (env vars audited, secrets set). Day 115 (worker deployment). Day 109 (CD pipeline). A Fly.io account with a credit card on file (Postgres requires a paid plan; ~$1–3/month for the smallest size).

## Where to put your code
In `ai-folio`.

## Explanation

**Fly.io** runs Docker containers as "Machines" (VMs) in data centres around the world. Traffic goes through Fly's anycast network, which terminates TLS and routes to the nearest region. You get a `fly.dev` subdomain for free, or bring your own domain. In Laravel terms, Fly.io is closer to Heroku than to a raw VPS — you push an image and Fly handles the infrastructure.

**Zero-downtime deployment** on Fly.io: when you deploy a new image, Fly starts new Machines with the new image, waits for health checks to pass, then stops the old Machines. If health checks do not pass within the timeout, Fly aborts the deploy and the old Machines stay running. This is equivalent to Laravel Forge's "maintenance mode" deploy — but automated and rollback-safe.

**Migrations before traffic:** the `migrate` process group (from Day 102's mini-task, or adapted here as a `release_command`) runs Prisma migrate before any new app Machine starts. This ensures the schema is up to date before the new code runs — critical when the migration adds a column that the new code reads.

## Step-by-step

### 1. Create the Fly.io app (first time only)

```bash
flyctl apps create ai-folio --org personal
```

Set the primary region close to your target audience. For Poland: `waw` (Warsaw).

### 2. Create a Fly.io Postgres database

```bash
flyctl postgres create \
  --name ai-folio-db \
  --region waw \
  --vm-size shared-cpu-1x \
  --volume-size 1

# Attach to the app (sets DATABASE_URL secret automatically)
flyctl postgres attach ai-folio-db --app ai-folio
```

Note: Fly's Postgres is not managed Postgres — it is Postgres running in a Fly Machine. For pgvector, you need to enable the extension after creation:

```bash
flyctl postgres connect -a ai-folio-db
# Inside psql:
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

### 3. Set all production secrets

```bash
flyctl secrets set \
  ANTHROPIC_API_KEY="sk-ant-..." \
  NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  NEXTAUTH_URL="https://ai-folio.fly.dev" \
  REDIS_URL="rediss://default:...@....upstash.io:6379" \
  RESEND_API_KEY="re_..." \
  OWNER_EMAIL="you@example.com" \
  SENTRY_DSN="https://...@o....ingest.sentry.io/..." \
  --app ai-folio
```

`DATABASE_URL` was set automatically by `flyctl postgres attach`.

### 4. Configure fly.toml with release command

```toml name=fly.toml
app = "ai-folio"
primary_region = "waw"

[build]
  dockerfile = "Dockerfile"

# Release command runs ONCE before new Machines start
# Ensures migrations are applied before new code serves traffic
[deploy]
  release_command = "node dist/scripts/migrate.js"

[env]
  PORT = "3000"
  NODE_ENV = "production"

[processes]
  app    = "node server.js"
  worker = "node dist/workers/index.js"

[[services]]
  protocol      = "tcp"
  internal_port = 3000
  processes     = ["app"]

  [[services.ports]]
    port     = 443
    handlers = ["tls", "http"]

  [[services.ports]]
    port     = 80
    handlers = ["http"]

  [services.http_checks]
    interval   = "15s"
    timeout    = "10s"
    grace_period = "30s"
    path       = "/api/health"

[[vm]]
  processes = ["app"]
  memory    = "512mb"
  cpu_kind  = "shared"
  cpus      = 1

[[vm]]
  processes = ["worker"]
  memory    = "256mb"
  cpu_kind  = "shared"
  cpus      = 1
```

### 5. Create the migrate script

```ts name=src/scripts/migrate.ts
import { execSync } from 'child_process';

console.log('[migrate] Running Prisma migrations...');

execSync('npx prisma migrate deploy', {
  env: process.env,
  stdio: 'inherit',
});

console.log('[migrate] Migrations complete');
```

Add to `tsconfig.worker.json`'s `include`:

```json
"include": ["src/workers/**/*.ts", "src/lib/**/*.ts", "src/scripts/**/*.ts"]
```

### 6. First deploy

```bash
# Build and deploy — Fly builds the image remotely
flyctl deploy --app ai-folio

# Watch the deploy log
flyctl logs --app ai-folio
```

The deploy sequence:
1. Fly builds the Docker image (or uses your pre-built GHCR image)
2. `release_command` runs: Prisma migrate deploy
3. New `app` Machine starts; health checks at `/api/health`
4. On health check pass: old Machine stops
5. `worker` Machine updates with new image

### 7. Verify the live app

```bash
flyctl status --app ai-folio

# Open in browser
flyctl open --app ai-folio

# Check health endpoint
curl https://ai-folio.fly.dev/api/health
# → {"status":"ok","db":"ok","redis":"ok"}

# View logs
flyctl logs --app ai-folio --follow
```

## Test it

1. Open `https://ai-folio.fly.dev` — portfolio homepage loads.
2. Open the chat widget — send a message — Claude responds.
3. Check Sentry dashboard — no errors.
4. Check worker logs:

```bash
flyctl logs --app ai-folio --process-group worker
```

Expected: embedding jobs processing after chat messages.

If health check fails after deploy:

```bash
flyctl logs --app ai-folio
# Look for startup errors, missing env vars, Prisma connection failures
```

Roll back to the previous release if needed:

```bash
flyctl releases --app ai-folio
flyctl deploy --image <previous-image-ref> --app ai-folio
```

## Mini-task
Add a custom domain. In the Fly.io dashboard or with the CLI:

```bash
flyctl certs create your-portfolio-domain.com --app ai-folio
```

Fly provisions a Let's Encrypt TLS certificate automatically. Add the required DNS records at your registrar. Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` secrets to use the custom domain.

## Glossary
- **`release_command`** — Fly.io deploy hook; a command that runs in the new image before any new Machines start serving traffic.
- **Zero-downtime deploy** — traffic continues flowing to old Machines while new Machines start; old Machines stop only after new ones pass health checks.
- **`flyctl postgres attach`** — connects a Fly Postgres cluster to an app and sets `DATABASE_URL` as a secret automatically.
- **`flyctl certs create`** — provisions a Let's Encrypt TLS certificate for a custom domain on Fly.io.
- **`flyctl releases`** — lists all previous deployments; used to identify the image reference for a rollback.

## Resources
- [Fly.io — getting started](https://fly.io/docs/getting-started/)
- [Fly.io — Postgres](https://fly.io/docs/postgres/)
- [Fly.io — deploy strategies](https://fly.io/docs/apps/deploy/)
- [Fly.io — custom domains](https://fly.io/docs/networking/custom-domain/)

## Checklist
- [ ] Fly.io app created in `waw` region
- [ ] Fly Postgres created and pgvector extension enabled
- [ ] All production secrets set via `flyctl secrets set`
- [ ] `fly.toml` configures `app` and `worker` process groups
- [ ] `release_command` runs Prisma migrate before deploy
- [ ] `flyctl deploy` succeeds; `flyctl status` shows all Machines healthy
- [ ] `https://ai-folio.fly.dev/api/health` returns `{"status":"ok"}`
- [ ] Chat widget works end-to-end in production
- [ ] Worker processes embedding jobs (visible in worker logs)
