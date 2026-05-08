# Day 35 — API versioning + tests

## Goal
Move every route under an `/api/v1` prefix. Update Supertest tests and the OpenAPI spec to match.

## Estimated time
~45 minutes.

## Prerequisites
Days 31–34.

## Where to put your code
In `my-api`.

## Explanation

Once an API has clients, breaking changes are expensive — the client has to redeploy. **Versioning** lets you ship breaking changes under a new prefix while keeping the old one alive:

- `/api/v1/tasks` — current contract
- `/api/v2/tasks` — new shape, different fields, both run side by side until v1 is sunset

We add the `/api/v1` prefix today. There's no `v2` yet, but the structure is in place.

Laravel analogy: this is `Route::prefix('api/v1')->group(...)`.

## Step-by-step

### 1. Add a tiny version registry

```ts name=src/shared/http/versions.ts
import { Router } from 'express';
import { authRouter } from '../../modules/users/infrastructure/http/authRouter';
import { tasksRouter } from '../../modules/tasks/infrastructure/http/tasksRouter';

export function buildV1Router(): Router {
  const r = Router();
  r.use('/auth', authRouter);
  r.use('/tasks', tasksRouter);
  return r;
}
```

### 2. Mount it in `app.ts`

```ts name=src/app.ts
import 'reflect-metadata';
import express from 'express';
import { configureContainer } from './shared/container';
import { requestLogger } from './shared/http/requestLogger';
import { buildV1Router } from './shared/http/versions';
import { docsRouter } from './shared/http/docsRouter';
import { errorHandler } from './shared/http/errorHandler';

configureContainer();

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(requestLogger);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/docs', docsRouter);

  app.use('/api/v1', buildV1Router());

  app.use(errorHandler);
  return app;
}
```

> **Note:** `/health` and `/docs` stay un-versioned. Health checks should never break; docs cover all versions.

### 3. Update the OpenAPI document

```ts name=src/shared/openapi/registry.ts
// at the bottom of buildDocument():
return generator.generateDocument({
  openapi: '3.0.0',
  info: { title: 'My API', version: '1.0.0', description: 'Task Manager API' },
  servers: [{ url: 'http://localhost:3000/api/v1' }], // ← new
});
```

Each `registry.registerPath({ path: '/auth/register', ... })` stays as-is — it's a path **inside** the versioned server.

### 4. Update Supertest paths

Every test that calls `request(app).get('/tasks')` becomes `request(app).get('/api/v1/tasks')`. Find/replace works:

```bash
# preview
grep -rn "'/auth\|'/tasks\|'/users" src --include="*.test.ts"
# then carefully replace those literals
```

A small helper avoids the repetition:

```ts name=src/test/api.ts
import request from 'supertest';
import type { Express } from 'express';

export const api = (app: Express, path: string, prefix = '/api/v1') =>
  request(app).get(`${prefix}${path}`);

// Or richer:
export function v1(app: Express) {
  return {
    get:    (p: string) => request(app).get(`/api/v1${p}`),
    post:   (p: string) => request(app).post(`/api/v1${p}`),
    patch:  (p: string) => request(app).patch(`/api/v1${p}`),
    delete: (p: string) => request(app).delete(`/api/v1${p}`),
  };
}
```

```ts name=src/modules/tasks/infrastructure/http/tasks.test.ts
import { v1 } from '../../../../test/api';

describe('GET /tasks', () => {
  it('lists my tasks', async () => {
    const res = await v1(app).get('/tasks').set(authHeader);
    expect(res.status).toBe(200);
  });
});
```

### 5. Add a version-routing test

```ts name=src/shared/http/versions.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

const app = createApp();

describe('API versioning', () => {
  it('/health is un-versioned', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('GET /tasks (no prefix) returns 404', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(404);
  });

  it('GET /api/v1/tasks (no token) returns 401', async () => {
    const res = await request(app).get('/api/v1/tasks');
    expect(res.status).toBe(401);
  });
});
```

## Test it

```bash
npm test
```

The whole suite must be green. If a stray test still hits `/tasks` you'll see 404s — fix the path.

Open `http://localhost:3000/docs` and confirm the "Try it out" buttons send requests to `/api/v1/...`.

## Mini-task
Add a `GET /api/v1/version` endpoint that returns `{ version: '1.0.0' }` from `package.json`. Document it in the OpenAPI registry. Add a test.

## Glossary
- **API versioning** — keeping old contracts alive while new ones evolve under a different prefix.
- **URL versioning** vs **header versioning** — we use URL (`/api/v1`) because it's the simplest to test, document, and cache.
- **Sunset** — the point in time after which a deprecated version stops responding.

## Resources
- [Microsoft API design — Versioning](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design#versioning-a-restful-web-api)

## Checklist
- [ ] All routes mounted at `/api/v1/...`
- [ ] `/health` and `/docs` remain un-versioned
- [ ] OpenAPI servers list points to `/api/v1`
- [ ] Supertest tests updated and green
- [ ] `version-routing` tests pass

---

## End of Phase 2 — Week 7 ✅

You now have a production-quality API. One more week (testing deep dive) and Phase 2 is complete.
