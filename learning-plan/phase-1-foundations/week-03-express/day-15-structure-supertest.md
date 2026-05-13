# Day 15 — Folder structure + Supertest

## Goal
Refactor `my-api` into a clean folder structure and add **Supertest** integration tests.

## Estimated time
~1 hour.

## Where to put your code
`exercises/phase-1/week-03-express/my-api/`

## Explanation

**Supertest** drives an Express app over a fake HTTP socket — no real port needed, no server to start in tests. The result: fast end-to-end tests of your routes.

We also separate the **app** (the Express instance) from the **server** (calling `listen`). This makes the app testable without binding to a port.

## Step-by-step

### 1. Refactor the structure

```
src/
├── app.ts                 # builds & exports the express app (no listen)
├── server.ts              # calls app.listen — entry point
├── middleware/
│   └── validate.ts
└── tasks/
    ├── routes.ts          # defines the express.Router
    ├── controller.ts      # request → response handlers
    ├── service.ts         # business logic
    ├── store.ts           # in-memory data
    └── schemas.ts         # Zod
```

```ts name=src/app.ts
import express from 'express';
import { tasksRouter } from './tasks/routes';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/tasks', tasksRouter);
  return app;
}
```

```ts name=src/server.ts
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);
createApp().listen(port, () => console.log(`http://localhost:${port}`));
```

```ts name=src/tasks/routes.ts
import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import { CreateTaskSchema } from './schemas';
import * as controller from './controller';

export const tasksRouter = Router();

tasksRouter.get('/',          controller.list);
tasksRouter.get('/:id',       controller.show);
tasksRouter.post('/',         validateBody(CreateTaskSchema), controller.create);
tasksRouter.delete('/:id',    controller.remove);
```

```ts name=src/tasks/controller.ts
import type { Request, Response } from 'express';
import * as service from './service';

export const list   = (_req: Request, res: Response) => res.json(service.list());
export const show   = (req: Request, res: Response) => {
  const t = service.find(req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  res.json(t);
};
export const create = (req: Request, res: Response) => {
  const t = service.create(req.body.title);
  res.status(201).json(t);
};
export const remove = (req: Request, res: Response) => {
  const ok = service.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.status(204).send();
};
```

```ts name=src/tasks/service.ts
import { TaskStore } from './store';
export const list   = TaskStore.list;
export const find   = TaskStore.find;
export const create = TaskStore.create;
export const remove = TaskStore.remove;
```

Update `package.json` `main` / `start` to point at `dist/server.js`.

### 2. Supertest

```ts name=src/tasks/tasks.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

let app = createApp();
beforeEach(() => { app = createApp(); }); // fresh in-memory store per test

describe('tasks API', () => {
  it('lists empty initially', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('creates and lists', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Buy milk' });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe('Buy milk');

    const list = await request(app).get('/tasks');
    expect(list.body).toHaveLength(1);
  });

  it('rejects invalid input', async () => {
    const res = await request(app).post('/tasks').send({ title: '' });
    expect(res.status).toBe(400);
  });

  it('deletes', async () => {
    const c = await request(app).post('/tasks').send({ title: 'temp' });
    const d = await request(app).delete(`/tasks/${c.body.id}`);
    expect(d.status).toBe(204);
  });
});
```

> **Note:** the in-memory store is module-scoped, so it leaks between tests unless you reset it. The simplest fix is to add a `reset()` to `TaskStore` and call it in `beforeEach`. Add that as part of the mini-task.

Run:
```bash
npm test
```

## Mini-task
Add `TaskStore.reset()`, call it in `beforeEach`. Confirm tests are independent.

## Glossary
- **Supertest** — HTTP assertion library wrapped around an Express app.
- **App vs server** — the app is the request handler; the server binds it to a port.

## Resources
- [Supertest npm](https://www.npmjs.com/package/supertest)
- [Express — Router](https://expressjs.com/en/api.html#router)

## Checklist
- [x] At least 4 passing Supertest tests
- [x] App and server are split
- [x] Folder structure refactored
