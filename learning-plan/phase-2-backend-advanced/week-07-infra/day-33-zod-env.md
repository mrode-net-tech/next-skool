# Day 33 — dotenv + Zod environment

## Goal
Validate every environment variable at startup with a Zod schema and export a typed `env` object. Misconfigured env crashes the app immediately with a useful message.

## Estimated time
~45 minutes.

## Prerequisites
Days 31–32 (errors and logger in place).

## Where to put your code
In `my-api`.

## Explanation

Right now we read env vars with `process.env.JWT_SECRET ?? 'dev_secret'`. That has three problems:

1. **No validation** — a typo (`JWT_SECRRT`) silently falls through to the default.
2. **Untyped** — `process.env.X` is `string | undefined`, forcing nullish checks everywhere.
3. **No central inventory** — to know what the app needs, you grep for `process.env`.

The fix: one Zod schema describes all required vars, parses `process.env` at startup, and exports a frozen typed object. Everywhere else imports `env.JWT_SECRET` directly.

Laravel analogy: this is `config('services.jwt.secret')` plus the `php artisan config:cache` validation step, but stricter — startup fails if `JWT_SECRET` is missing.

## Step-by-step

### 1. Install dotenv (if not already)

```bash
npm i dotenv
```

### 2. The env schema

```ts name=src/shared/env.ts
import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be ≥32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
export type Env = typeof env;
```

> **Why `process.exit(1)` on failure?** Crashing loud and early is better than failing mysteriously on the first request.

### 3. Use `env` everywhere instead of `process.env`

```ts name=src/auth/jwt.ts
import jwt from 'jsonwebtoken';
import { env } from '../shared/env';

export type JwtPayload = { sub: string; email: string };

export function signAccess(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_TTL });
}

export function verifyAccess(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
```

```ts name=src/auth/refresh.ts
import { env } from '../shared/env';

const REFRESH_TTL_DAYS = env.REFRESH_TTL_DAYS;
// ... rest unchanged
```

```ts name=src/server.ts
import 'reflect-metadata';
import { createApp } from './app';
import { env } from './shared/env';
import { logger } from './shared/logger';

createApp().listen(env.PORT, () => {
  logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, 'server started');
});
```

```ts name=src/shared/logger.ts
import pino from 'pino';
import { env } from './env';

const isDev = env.NODE_ENV !== 'production';

export const logger = pino({
  level: env.LOG_LEVEL,
  // ... rest unchanged
});
```

### 4. Update `.env.example`

```env name=.env.example
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

DATABASE_URL="postgresql://app:app@localhost:5432/my_api?schema=public"
DATABASE_URL_TEST="postgresql://app:app@localhost:5433/my_api_test?schema=public"

JWT_SECRET="please_change_to_a_random_string_at_least_32_chars_long"
JWT_ACCESS_TTL=15m
REFRESH_TTL_DAYS=30
```

### 5. Verify the failure path

Temporarily delete `JWT_SECRET` from `.env` and run `npm run dev`. You should see:

```
❌ Invalid environment variables:
{ JWT_SECRET: [ 'JWT_SECRET must be ≥32 chars' ] }
```

Restore it before continuing.

## Test it

```ts name=src/shared/env.test.ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Re-declare the schema here so the test runs in isolation from the
// real .env loading at module top-level.
const EnvSchema = z.object({
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive(),
});

describe('EnvSchema', () => {
  it('rejects a short JWT_SECRET', () => {
    const r = EnvSchema.safeParse({ JWT_SECRET: 'short', PORT: '3000' });
    expect(r.success).toBe(false);
  });

  it('coerces PORT to number', () => {
    const r = EnvSchema.safeParse({
      JWT_SECRET: 'a'.repeat(32),
      PORT: '3000',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(typeof r.data.PORT).toBe('number');
  });
});
```

```bash
npm test
```

## Mini-task
Add an optional `SENTRY_DSN: z.string().url().optional()` field. In `app.ts`, log a warning at startup if it's absent in production.

## Glossary
- **`z.coerce.number()`** — Zod converts string env vars to numbers safely.
- **Frozen object** — `Object.freeze(env)` prevents accidental mutation at runtime.
- **Fail-fast** — crashing at startup is better than crashing on request #1.

## Resources
- [Zod docs](https://zod.dev/)
- [dotenv](https://www.npmjs.com/package/dotenv)
- [The Twelve-Factor App — Config](https://12factor.net/config)

## Checklist
- [ ] `src/shared/env.ts` parses and exports a typed `env`
- [ ] App crashes with a clear error when `JWT_SECRET` is missing
- [ ] All `process.env.X` reads outside `env.ts` are gone
- [ ] `.env.example` lists every required variable
- [ ] Tests pass
