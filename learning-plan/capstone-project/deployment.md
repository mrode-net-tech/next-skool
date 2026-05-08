# Habit Tracker — deployment plan

## Targets

| Component         | Hosting                  |
| ----------------- | ------------------------ |
| Web app (Next.js) | Vercel                   |
| PostgreSQL        | Railway                  |
| Redis             | Railway or Upstash       |
| Worker (BullMQ)   | Railway (separate service) |
| Object storage    | Cloudflare R2 or AWS S3 (Phase 6) |
| Errors            | Sentry                   |

## Environments

- **`development`** — local, Postgres + Redis via Docker.
- **`preview`** — Vercel preview per PR; uses a shared preview DB.
- **`production`** — Vercel `main` branch + Railway services.

## Environment variables

Validated with Zod (see Day 33). Examples:

```
DATABASE_URL=
REDIS_URL=
AUTH_SECRET=
AUTH_URL=
RESEND_API_KEY=
SENTRY_DSN=
NEXT_PUBLIC_APP_URL=
```

## Steps to first production deploy (end of Week 20)

1. Create a new Postgres project on Railway, copy `DATABASE_URL`.
2. Run `prisma migrate deploy` against it.
3. Create a Vercel project, link the repo, set env vars.
4. First deploy. Test sign up + create habit + mark done.

## Steps for Phase 6

1. **Docker** — add `Dockerfile` for the worker; `docker-compose.yml` for local.
2. **Redis** — add a Redis instance on Railway; set `REDIS_URL`.
3. **Worker** — deploy worker as a separate Railway service from the same repo.
4. **CI** — GitHub Actions: lint, typecheck, test, then auto-deploy on merge.
5. **Sentry** — install `@sentry/nextjs` and configure in both web and worker.
6. **Custom domain** — point a subdomain to Vercel.
7. **Smoke test** — Playwright suite runs against the deployed URL nightly.
