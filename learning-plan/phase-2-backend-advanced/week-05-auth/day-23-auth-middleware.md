# Day 23 — Auth middleware (verify JWT)

## Goal
Write an Express middleware that reads a `Bearer` token from the `Authorization` header, verifies it, and attaches the decoded user to `req.user`.

## Estimated time
~1 hour.

## Prerequisites
Day 22 (`signAccess` / `verifyAccess` helpers in `src/auth/jwt.ts`).

## Where to put your code
In `my-api`.

## Explanation

In Express, **middleware** is a function `(req, res, next) => void`. Auth middleware sits before route handlers and either calls `next()` (token valid) or responds with 401 (token missing or invalid). Any route mounted after the middleware benefits automatically.

Laravel analogy: this is identical to a Laravel **middleware** class — `handle($request, Closure $next)` — registered in `$routeMiddleware`. The pattern is the same; Node just doesn't have a `Kernel.php` registry.

We extend the `Request` interface via **TypeScript declaration merging** so that `req.user` is type-safe everywhere downstream.

## Step-by-step

### 1. Extend the Express Request type

```ts name=src/types/express.d.ts
import type { JwtPayload } from '../auth/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
```

### 2. Auth middleware

```ts name=src/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express';
import { verifyAccess } from '../auth/jwt';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
  }

  const token = header.slice(7); // strip "Bearer "
  try {
    req.user = verifyAccess(token);
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}
```

### 3. Test it on a scratch route first (optional sanity check)

```ts name=src/app.ts
import express from 'express';
import { tasksRouter } from './tasks/routes';
import { usersRouter } from './users/routes';
import { authRouter } from './auth/routes';
import { requireAuth } from './middleware/auth';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRouter);
  app.use('/users', usersRouter);

  // Protected area — all routes below this line require a valid JWT
  app.use(requireAuth);
  app.use('/tasks', tasksRouter);

  return app;
}
```

> We apply `requireAuth` as global middleware for the `/tasks` subtree here for simplicity. Day 24 shows the router-level approach, which is cleaner once you have many modules.

## Test it

```ts name=src/middleware/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../db/prisma';
import { signAccess } from '../auth/jwt';

const app = createApp();

beforeEach(async () => {
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
});

describe('auth middleware', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('missing_token');
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/tasks')
      .set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_token');
  });

  it('passes through with a valid token', async () => {
    const token = signAccess({ sub: 'user-1', email: 'a@example.com' });
    const res = await request(app)
      .get('/tasks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
```

```bash
npm test
```

## Mini-task
Add an `GET /auth/me` route (also behind `requireAuth`) that returns `req.user`. Test it returns `{ sub, email }`.

## Glossary
- **Declaration merging** — TypeScript feature where two `interface` blocks for the same name are merged; used here to add `user` to Express `Request`.
- **Bearer token** — HTTP auth scheme; the token follows the word `Bearer `.
- **`next()`** — Express convention: call this to pass control to the next middleware or route handler.

## Resources
- [Express — Writing middleware](https://expressjs.com/en/guide/writing-middleware.html)
- [TypeScript — Declaration merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html)

## Checklist
- [ ] `requireAuth` middleware exists in `src/middleware/auth.ts`
- [ ] Missing token → 401 `missing_token`
- [ ] Invalid/expired token → 401 `invalid_token`
- [ ] Valid token → request continues to route handler
- [ ] `req.user` is typed as `JwtPayload`
