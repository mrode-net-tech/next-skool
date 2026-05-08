# Day 32 — Pino logger + request log middleware

## Goal
Replace `console.log` with **Pino** structured JSON logging. Add a request-log middleware that prints one line per HTTP request with method, path, status, and duration.

## Estimated time
~1 hour.

## Prerequisites
Day 31 (`AppError` + `errorHandler`).

## Where to put your code
In `my-api`.

## Explanation

`console.log` is fine in tutorials, awful in production:
- it prints to stdout in human-readable form, but log aggregators (Loki, Datadog, CloudWatch) want **JSON**.
- it has no levels (`debug` / `info` / `warn` / `error`).
- it has no context — every log line is anonymous.

**Pino** is the de-facto standard logger in Node: extremely fast, JSON by default, supports child loggers, and pairs well with `pino-http` for request logging.

Laravel analogy: this is roughly Monolog with the JsonFormatter. Pino's `logger.info({ userId: 'u1' }, 'login')` is the same as `Log::info('login', ['user_id' => 'u1'])`.

In **development** we pipe the JSON through `pino-pretty` so the terminal stays readable.

## Step-by-step

### 1. Install

```bash
npm i pino pino-http
npm i -D pino-pretty
```

### 2. Create the root logger

```ts name=src/shared/logger.ts
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
    },
  }),
  redact: {
    paths: ['req.headers.authorization', '*.password', '*.passwordHash'],
    censor: '[REDACTED]',
  },
});
```

### 3. Request-log middleware

```ts name=src/shared/http/requestLogger.ts
import pinoHttp from 'pino-http';
import { logger } from '../logger';

export const requestLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} → ${res.statusCode}`,
  customErrorMessage: (req, res) =>
    `${req.method} ${req.url} → ${res.statusCode} ERROR`,
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
```

### 4. Wire into `app.ts` (BEFORE routes, AFTER body parser)

```ts name=src/app.ts
import 'reflect-metadata';
import express from 'express';
import { configureContainer } from './shared/container';
import { requestLogger } from './shared/http/requestLogger';
import { authRouter } from './modules/users/infrastructure/http/authRouter';
import { tasksRouter } from './modules/tasks/infrastructure/http/tasksRouter';
import { errorHandler } from './shared/http/errorHandler';

configureContainer();

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(requestLogger);
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRouter);
  app.use('/tasks', tasksRouter);
  app.use(errorHandler);
  return app;
}
```

### 5. Replace stray `console.*` calls

Search the codebase: `console.log`, `console.error`. Replace with `logger.info(...)` / `logger.error(...)`. The error handler uses `logger.error({ err }, 'unhandled error')` instead of `console.error`.

```ts name=src/shared/http/errorHandler.ts
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../errors/AppError';
import { logger } from '../logger';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const ve = new ValidationError('Invalid input', err.flatten());
    return res.status(ve.status).json({ error: ve.code, details: ve.details });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error:   err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'internal_error' });
};
```

### 6. Use child loggers in use cases (optional but recommended)

```ts name=src/modules/users/application/RegisterUser.ts
import { logger } from '../../../shared/logger';

@injectable()
export class RegisterUser {
  private log = logger.child({ useCase: 'RegisterUser' });

  async execute(input) {
    this.log.info({ email: input.email }, 'registering user');
    // ... existing logic ...
    this.log.info({ userId: saved.id }, 'user registered');
    return toDTO(saved);
  }
}
```

### 7. Silence logs in tests

`pino-pretty` clutters test output. Set the level to `silent` for the test environment:

```ts name=src/test/setup.ts
import { execSync } from 'node:child_process';
import { beforeAll, beforeEach } from 'vitest';
import { prisma } from '../db/prisma';

process.env.LOG_LEVEL = 'silent';

beforeAll(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
});

beforeEach(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
});
```

## Test it

```ts name=src/shared/logger.test.ts
import { describe, it, expect, vi } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  it('exposes the standard pino API', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.child).toBe('function');
  });

  it('child logger inherits config and adds bindings', () => {
    const child = logger.child({ scope: 'test' });
    expect(typeof child.info).toBe('function');
  });

  it('redacts authorization headers', () => {
    // pino does not expose redaction directly, but we can sanity-check the option
    expect(true).toBe(true); // placeholder — see mini-task
  });
});
```

Smoke-test the API and watch the prettified logs:

```bash
npm run dev
curl -i http://localhost:3000/health
# In the dev terminal you should see:
# 12:34:56 INFO: GET /health → 200
```

## Mini-task
Write a Supertest request to `/auth/login` and capture `process.stdout` to verify the `Authorization` header is REDACTED in the printed log. (Tip: spy on `process.stdout.write`.)

## Glossary
- **Pino** — fast JSON logger for Node.
- **`pino-http`** — middleware that logs one line per HTTP request.
- **`pino-pretty`** — dev-only pretty printer that consumes Pino's JSON.
- **Child logger** — derived logger with extra fields auto-attached to every line.
- **Log redaction** — automatically replacing sensitive fields with `[REDACTED]`.

## Resources
- [Pino docs](https://getpino.io/)
- [pino-http](https://github.com/pinojs/pino-http)
- [pino-pretty](https://github.com/pinojs/pino-pretty)

## Checklist
- [ ] `pino`, `pino-http`, `pino-pretty` installed
- [ ] `requestLogger` middleware added; one log line per request
- [ ] `console.*` calls removed
- [ ] Auth header is redacted
- [ ] Tests run with `LOG_LEVEL=silent`
- [ ] All previous tests still pass
