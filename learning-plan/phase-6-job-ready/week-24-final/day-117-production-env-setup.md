# Day 117 — Production environment setup

## Goal
Audit and lock down every environment variable, secret, and configuration difference between local dev and production. After this day you have a checklist of every env var, where it lives, and what breaks without it — no surprises at deploy time.

## Estimated time
~1.5 hours

## Prerequisites
Day 116 (Sentry integrated). All Phase 5 and Phase 6 features in place.

## Where to put your code
In `ai-folio`.

## Explanation

**Environment variable sprawl** is how production bugs happen. A variable works locally but is missing in CI; a secret exists in staging but not production; a URL points to localhost in one file. By Day 117, `ai-folio` uses a dozen env vars across Next.js, Prisma, Auth.js, Resend, Sentry, BullMQ, and the Claude API. Auditing them systematically prevents "works on my machine" failures.

**The two-file pattern** for env vars in Next.js:
- `.env.local` — local dev only; not committed; overrides everything
- `.env.production` — committed to git; defaults for production; no secrets

Secrets (API keys, DB passwords) go only in `.env.local` or as platform secrets (Fly.io). Non-secret production config (`NEXTAUTH_URL`, `NODE_ENV`) goes in `.env.production`.

**Validation at startup** — the app should fail fast with a clear error if a required variable is missing, rather than crash mid-request with a cryptic `Cannot read properties of undefined`. A Zod schema for `process.env` achieves this.

## Step-by-step

### 1. Audit every env var in the codebase

```bash
grep -r 'process\.env\.' src/ --include='*.ts' --include='*.tsx' \
  | grep -oP 'process\.env\.\K[A-Z_]+' \
  | sort -u
```

Expected output (adjust for your implementation):

```
ANTHROPIC_API_KEY
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
NEXT_PUBLIC_APP_URL
NODE_ENV
OWNER_EMAIL
REDIS_URL
RESEND_API_KEY
SENTRY_AUTH_TOKEN
SENTRY_DSN
```

### 2. Create an env validation module

```ts name=src/env.ts
import { z } from 'zod';

const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  RESEND_API_KEY: z.string().startsWith('re_'),
  OWNER_EMAIL: z.string().email(),
  SENTRY_DSN: z.string().url().optional(),
});

const ClientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

export const env = ServerEnvSchema.parse(process.env);
export const clientEnv = ClientEnvSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});
```

Import `env` instead of `process.env` throughout the server-side code:

```ts
import { env } from '@/env';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
```

Now if `ANTHROPIC_API_KEY` is missing, the app refuses to start with: `ZodError: ANTHROPIC_API_KEY: Invalid input`. No silent `undefined` errors.

### 3. Create .env.production

```bash name=.env.production
# Committed to git — no secrets
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://ai-folio.fly.dev
NEXTAUTH_URL=https://ai-folio.fly.dev
```

### 4. Document required secrets

```markdown name=docs/environment.md
# Environment variables

## Required secrets (never commit — set in Fly.io/CI)

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Fly.io Postgres: `flyctl postgres connect` |
| `REDIS_URL` | Upstash dashboard |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `RESEND_API_KEY` | resend.com/api-keys |
| `OWNER_EMAIL` | your email address |
| `SENTRY_DSN` | Sentry project settings |
| `SENTRY_AUTH_TOKEN` | Sentry account settings (for source maps) |

## Non-secret production config (.env.production)

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_APP_URL` | `https://ai-folio.fly.dev` |
| `NEXTAUTH_URL` | `https://ai-folio.fly.dev` |

## CI secrets (GitHub Actions)

Set in GitHub → Settings → Secrets and variables → Actions:
`ANTHROPIC_API_KEY`, `FLY_API_TOKEN`, `SENTRY_AUTH_TOKEN`
```

### 5. Verify Fly.io secrets

```bash
flyctl secrets list --app ai-folio
```

Expected output: all secrets from the table above are listed (values hidden).

If any are missing:

```bash
flyctl secrets set MISSING_VAR="value" --app ai-folio
```

Fly.io automatically restarts the app Machines when secrets change.

### 6. Test env validation locally

Temporarily unset a required variable:

```bash
ANTHROPIC_API_KEY="" pnpm dev
```

Expected: the app fails immediately with a Zod validation error listing the missing variable, not a cryptic crash later.

Restore the variable and confirm normal startup.

## Test it

```bash
# List all env vars the app reads
grep -r 'process\.env\.' src/ --include='*.ts' --include='*.tsx' \
  | grep -oP 'process\.env\.\K[A-Z_]+' | sort -u

# Compare to the documented list
# Any variable in code but not in docs = undocumented dependency (fix it)
# Any variable in docs but not in code = stale documentation (clean it up)
```

Then deploy and confirm the health endpoint reports all services healthy:

```bash
curl https://ai-folio.fly.dev/api/health
# → {"status":"ok","db":"ok","redis":"ok"}
```

## Mini-task
Add a `GET /api/admin/env-check` Route Handler (auth-gated) that returns which optional env vars are set and which are missing — without exposing their values. This is useful when debugging a production misconfiguration without SSH access to the machine.

```ts
return NextResponse.json({
  SENTRY_DSN: !!process.env.SENTRY_DSN,
  RESEND_API_KEY: !!process.env.RESEND_API_KEY,
  // ...
});
```

## Glossary
- **`.env.production`** — committed Next.js env file loaded in production; no secrets, only public config.
- **`.env.local`** — untracked, highest-priority env file; used for local dev secrets.
- **Fail-fast** — design pattern where a misconfiguration causes an immediate startup error rather than a silent runtime failure.
- **Zod env validation** — parsing `process.env` through a Zod schema at module load time; all variables are validated before any request is handled.
- **`flyctl secrets list`** — lists secret names (not values) set for a Fly.io app; verifies secrets are present without exposing them.

## Resources
- [Next.js — environment variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Fly.io — secrets](https://fly.io/docs/flyctl/secrets/)
- [t3-oss/env-nextjs — Zod env validation](https://env.t3.gg/)

## Checklist
- [ ] `grep` audit finds all `process.env.*` references in the codebase
- [ ] `src/env.ts` validates all required env vars with Zod at startup
- [ ] Missing env var causes immediate startup failure with clear error message
- [ ] `.env.production` committed with non-secret production config
- [ ] `docs/environment.md` documents all variables, sources, and where to set them
- [ ] `flyctl secrets list` confirms all secrets are present in production
- [ ] `GET /api/health` returns `{"status":"ok"}` after production deploy
