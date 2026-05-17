# Day 115 — Worker deployment

## Goal
Deploy the BullMQ worker as a separate long-running process on Fly.io, alongside the Next.js app. After this day the worker runs in production, processes jobs continuously, and restarts automatically if it crashes.

## Estimated time
~2 hours

## Prerequisites
Day 114 (digest email worker written). Day 109 (CD pipeline with Fly.io). Multi-stage Dockerfile from Day 103.

## Where to put your code
In `ai-folio`.

## Explanation

**Workers are long-running processes** — they block on a Redis BRPOP call waiting for jobs. Next.js serverless functions (Vercel) cannot host them: serverless functions run for a fixed duration per request and then terminate. You need a persistent process. Fly.io "Machines" are persistent VMs that stay running. You can run multiple Fly processes from the same Docker image using different `CMD` commands.

**Fly.io process groups** let you define multiple process types in `fly.toml`. Each process group runs its own set of Machines with the same image but a different start command. The `app` group runs `node server.js` (Next.js); the `worker` group runs `node --loader tsx/esm src/workers/index.ts` (BullMQ). Both share secrets and environment variables defined in `fly.toml`.

**One image, two entry points** is the canonical pattern. Building two separate Docker images (one for app, one for worker) wastes CI time and risks version skew (worker running old code while app runs new code). One image, deployed atomically, guarantees they are always in sync.

In Laravel terms, this is like running `php artisan serve` and `php artisan queue:work` from the same codebase — same composer dependencies, same `.env`, different processes.

## Step-by-step

### 1. Create a compiled worker entry point

TypeScript source cannot run directly with `node` in Docker (tsx is a dev dependency). Compile the worker:

```dockerfile name=Dockerfile
# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build        # builds Next.js
RUN pnpm exec tsc --project tsconfig.worker.json   # compiles worker to dist/
```

Create a dedicated tsconfig for the worker:

```json name=tsconfig.worker.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist/workers",
    "module": "commonjs",
    "moduleResolution": "node",
    "noEmit": false
  },
  "include": ["src/workers/**/*.ts", "src/lib/**/*.ts"]
}
```

Add to `package.json`:

```json name=package.json
{
  "scripts": {
    "build:worker": "tsc --project tsconfig.worker.json"
  }
}
```

### 2. Add compiled worker to the runner stage

```dockerfile name=Dockerfile
# ─── Stage 3: runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs
USER nextjs

# Next.js standalone
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

# Worker compiled output
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist

EXPOSE 3000
# Default CMD: Next.js app
CMD ["node", "server.js"]
```

The worker is started by overriding CMD, not by changing the Dockerfile.

### 3. Configure Fly.io process groups

```toml name=fly.toml
app = "ai-folio"
primary_region = "waw"   # Warsaw — closest to you

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"
  NEXTAUTH_URL = "https://ai-folio.fly.dev"

[processes]
  app    = "node server.js"
  worker = "node dist/workers/index.js"

[[services]]
  protocol    = "tcp"
  internal_port = 3000
  processes   = ["app"]    # only app process handles HTTP

  [[services.ports]]
    port     = 443
    handlers = ["tls", "http"]

  [[services.ports]]
    port     = 80
    handlers = ["http"]

  [services.http_checks]
    interval = "15s"
    timeout  = "5s"
    path     = "/api/health"

[[vm]]
  processes    = ["app"]
  memory       = "512mb"
  cpu_kind     = "shared"
  cpus         = 1

[[vm]]
  processes    = ["worker"]
  memory       = "256mb"   # worker needs less memory than Next.js
  cpu_kind     = "shared"
  cpus         = 1
```

### 4. Create the worker entry point

```ts name=src/workers/index.ts
import { setupScheduledJobs } from './scheduler';
import { embeddingWorker } from './embedding-worker';
import { schedulerWorker } from './scheduler-worker';

console.log('[worker] Starting all workers...');

setupScheduledJobs().catch((err) => {
  console.error('[worker] Failed to register scheduled jobs:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('[worker] SIGTERM received, shutting down gracefully...');
  await Promise.all([embeddingWorker.close(), schedulerWorker.close()]);
  process.exit(0);
});

console.log('[worker] All workers running');
```

### 5. Deploy with process groups

```bash
# First deploy: Fly creates both app and worker Machines
flyctl deploy --app ai-folio

# Check status of all processes
flyctl status --app ai-folio

# View worker logs
flyctl logs --app ai-folio --process-group worker

# Scale worker to 0 (pause) or back to 1
flyctl scale count worker=0 --app ai-folio
flyctl scale count worker=1 --app ai-folio
```

### 6. Update the CD pipeline

The deploy job from Day 109 deploys both processes automatically:

```bash
flyctl deploy --image ghcr.io/<owner>/ai-folio:sha-$GITHUB_SHA --app ai-folio
```

Fly rolls out the new image to both `app` and `worker` Machines. If the `app` health check fails, Fly rolls back — but only the `app` machines. Worker machines are updated independently. For zero-downtime worker updates, the SIGTERM handler (Day 113) ensures in-flight jobs complete before the old worker exits.

## Test it

After deploying:

```bash
# Verify both processes are running
flyctl status --app ai-folio
# Should show: Machines for "app" and "worker" processes

# Check worker is processing jobs
flyctl logs --app ai-folio --process-group worker

# Trigger a test job (from the admin endpoint)
curl -X POST https://ai-folio.fly.dev/api/admin/trigger-digest \
  -H "Cookie: <production-session-cookie>"

# Watch the worker logs in another terminal
flyctl logs --app ai-folio --process-group worker --follow
```

Expected in the worker logs: digest built, email sent.

## Mini-task
Scale the embedding worker to 2 instances:

```bash
flyctl scale count worker=2 --app ai-folio
```

Send several chat messages simultaneously. Observe in the logs that jobs are distributed across both worker instances. BullMQ guarantees each job is processed by exactly one worker — Redis atomic pop prevents double-processing.

## Glossary
- **Fly.io process group** — a named set of Machines running the same image with a different command; defined in `fly.toml` under `[processes]`.
- **`tsconfig.worker.json`** — separate TypeScript config that compiles worker source to CJS for production use.
- **`flyctl scale count`** — adjusts the number of running Machines for a process group.
- **SIGTERM handler** — Node.js listener for the shutdown signal; used to close workers gracefully before the process exits.
- **In-flight job** — a job currently being processed by a worker; SIGTERM handling waits for these to complete before exiting.

## Resources
- [Fly.io — multiple processes](https://fly.io/docs/app-guides/multiple-processes/)
- [BullMQ — graceful shutdown](https://docs.bullmq.io/patterns/graceful-shutdown)
- [Fly.io — flyctl scale](https://fly.io/docs/flyctl/scale/)

## Checklist
- [ ] `tsconfig.worker.json` compiles worker source to `dist/workers/`
- [ ] `Dockerfile` copies `dist/` into the runner stage
- [ ] `fly.toml` defines `app` and `worker` process groups with different `CMD`
- [ ] Worker process gets fewer resources than app process (256 MB vs 512 MB)
- [ ] `flyctl status` shows both `app` and `worker` Machines running
- [ ] Worker logs confirm jobs processed in production after `trigger-digest`
- [ ] SIGTERM handler closes all workers gracefully
