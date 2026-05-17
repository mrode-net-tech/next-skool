# Day 78 — Deploy api (Railway / Fly.io)

## Goal
Deploy `apps/api` to Railway (or Fly.io), provision a managed Postgres database, run Prisma migrations in production, and verify the live API with curl.

## Estimated time
~2 hours

## Prerequisites
Day 77 — all e2e tests passing. `apps/api` building cleanly.

## Where to put your code
No new source code today — configuration files and CLI commands only.

## Explanation

**Railway** is a PaaS (Platform as a Service) that deploys Docker containers or Node.js apps from your git repo. It provisions managed infrastructure (Postgres, Redis) with one click. The workflow: push to main → Railway detects changes → rebuilds and deploys automatically.

**Fly.io** is the alternative — more control, faster global deploys via anycast IPs, but requires a `fly.toml` config. Both support monorepos via build context configuration.

Today uses Railway because it requires the least config for a Node + Postgres stack. Fly.io steps are included at the end for reference.

**Production invariants** you must set up:
1. `NODE_ENV=production`
2. `DATABASE_URL` pointing to managed Postgres (not `localhost`)
3. `JWT_SECRET` from environment (not hardcoded)
4. `CORS_ORIGIN` set to the deployed frontend URL
5. `pnpm run db:migrate` as a deploy hook (runs before the new version starts)

## Step-by-step

### 1. Prepare `apps/api` for production build

```json name=apps/api/tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "./dist",
    "paths": {}
  },
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

```json name=apps/api/package.json
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/index.js",
    "db:migrate:prod": "prisma migrate deploy"
  }
}
```

`prisma migrate deploy` (not `migrate dev`) applies pending migrations without creating new ones — safe for production.

### 2. `Dockerfile` for `apps/api`

```dockerfile name=apps/api/Dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json packages/types/
COPY packages/config-tsconfig/package.json packages/config-tsconfig/

# Copy apps/api
COPY apps/api/package.json apps/api/

# Install all deps (hoisted)
RUN npm i -g pnpm && pnpm install --frozen-lockfile

# Stage 2: Build
FROM deps AS builder
COPY packages/ packages/
COPY apps/api/ apps/api/

WORKDIR /app/apps/api
RUN pnpm build

# Stage 3: Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Only copy what's needed to run
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/package.json ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

Test locally:
```bash
# From task-manager root
docker build -f apps/api/Dockerfile -t task-manager-api .
docker run -p 3000:3000 -e DATABASE_URL="..." -e JWT_SECRET="..." task-manager-api
```

### 3. Deploy to Railway

**Option A: Railway dashboard (easiest)**

1. Create account at [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub repo" → select your monorepo
3. Railway auto-detects the `Dockerfile` in `apps/api/`
4. Set root directory: `apps/api` (or leave blank if using the Dockerfile build context from root)
5. Add a Postgres service: "+ New" → "Database" → "PostgreSQL"
6. Railway auto-sets `DATABASE_URL` in the API service environment

**Option B: Railway CLI**

```bash
npm i -g @railway/cli
railway login
railway init     # Creates a new project
railway up       # Deploy

# Add Postgres
railway add --plugin postgresql

# Set env vars
railway variables set JWT_SECRET="$(openssl rand -hex 32)"
railway variables set NODE_ENV=production
railway variables set CORS_ORIGIN="https://your-vercel-app.vercel.app"
```

### 4. Run migrations as part of deploy

In Railway, add a pre-deploy command:
- Dashboard → Service → Settings → Pre-deploy command:
```
pnpm db:migrate:prod
```

Or in `apps/api/package.json` add a `railway.json`:

```json name=apps/api/railway.json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "apps/api/Dockerfile"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "preDeployCommand": "npx prisma migrate deploy"
  }
}
```

### 5. Production CORS

Update `apps/api/src/app.ts`:

```ts
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  credentials: true,
}));
```

Set `CORS_ORIGIN` to your Vercel frontend URL (deployed on Day 79).

### 6. Verify live API

After deploy:

```bash
# Replace with your Railway URL
API=https://task-manager-api.up.railway.app

# Health check
curl $API/health

# Register
curl -X POST $API/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"prod@example.com","password":"ProdPass123"}'
```

### Fly.io alternative (reference)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# From apps/api:
fly launch --dockerfile Dockerfile --name task-manager-api

# Set secrets
fly secrets set JWT_SECRET="$(openssl rand -hex 32)"
fly secrets set DATABASE_URL="$(fly postgres create --name task-manager-db)"

# Deploy
fly deploy
```

## Test it

```bash
curl https://your-railway-url.up.railway.app/health
# Expected: {"ok":true}

curl -X POST https://your-railway-url.up.railway.app/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"prod@example.com","password":"ProdPass123"}'
# Expected: {"user":{...}}
```

## Mini-task
Add a `GET /health/db` endpoint that queries `SELECT 1` from Postgres and returns `{"db":"ok"}` — a database connectivity health check. Railway can use this as a readiness probe.

## Glossary
- **PaaS** — Platform as a Service; abstracts servers, scaling, and networking.
- **`prisma migrate deploy`** — applies pending migrations; safe for production (no schema creation).
- **Pre-deploy command** — runs before the new version starts traffic; safe place for migrations.
- **Multi-stage Docker build** — separate build and runtime images; keeps production image small.
- **Anycast** — Fly.io routes requests to the nearest datacenter; fast global response times.

## Resources
- [Railway docs](https://docs.railway.app/)
- [Fly.io — Dockerfile deployment](https://fly.io/docs/languages-and-frameworks/dockerfile/)
- [Prisma — Production migrations](https://www.prisma.io/docs/guides/deployment/deploy-database-changes-with-prisma-migrate)

## Checklist
- [ ] `tsconfig.build.json` produces clean `dist/`
- [ ] `Dockerfile` multi-stage builds correctly locally
- [ ] Railway project created + Postgres provisioned
- [ ] `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` set in Railway env
- [ ] `prisma migrate deploy` runs on pre-deploy
- [ ] `GET /health` returns `{"ok":true}` on live URL
- [ ] Login endpoint works on live URL
