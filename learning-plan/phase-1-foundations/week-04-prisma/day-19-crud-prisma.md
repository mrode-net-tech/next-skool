# Day 19 — CRUD with Prisma

## Goal
Replace the in-memory `TaskStore` with Prisma. Keep your Supertest suite green.

## Estimated time
~1.5 hours.

## Where to put your code
In `my-api`.

## Explanation

This is a refactor, not new functionality. The existing routes and tests should keep working — you swap implementations behind the service layer. This is the value of the layered structure from Day 15.

## Step-by-step

Replace the store with a Prisma-backed module:

```ts name=src/tasks/store.ts
import { prisma } from '../db/prisma';
import type { Task } from '@prisma/client';
export type { Task };

export const TaskStore = {
  list: () => prisma.task.findMany({ orderBy: { createdAt: 'desc' } }),
  find: (id: string) => prisma.task.findUnique({ where: { id } }),
  create: (title: string, priority = 2) =>
    prisma.task.create({ data: { title, priority } }),
  remove: async (id: string) => {
    try {
      await prisma.task.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },
  reset: () => prisma.task.deleteMany(),
};
```

Update the service so each call returns the Prisma promise (controllers were already `async`-friendly via `await`):

```ts name=src/tasks/service.ts
import { TaskStore } from './store';
export const list   = () => TaskStore.list();
export const find   = (id: string) => TaskStore.find(id);
export const create = (title: string, priority?: number) => TaskStore.create(title, priority);
export const remove = (id: string) => TaskStore.remove(id);
```

Make controllers `async` and `await`:

```ts name=src/tasks/controller.ts
import type { Request, Response } from 'express';
import * as service from './service';

export const list = async (_req: Request, res: Response) => {
  res.json(await service.list());
};
export const show = async (req: Request, res: Response) => {
  const t = await service.find(req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  res.json(t);
};
export const create = async (req: Request, res: Response) => {
  const t = await service.create(req.body.title, req.body.priority);
  res.status(201).json(t);
};
export const remove = async (req: Request, res: Response) => {
  const ok = await service.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.status(204).send();
};
```

### Test database setup

`prisma/migrations` is shared, but tests must run against the **test** DB. Easiest setup:

```ts name=src/test/setup.ts
import { execSync } from 'node:child_process';
import { beforeAll, beforeEach } from 'vitest';
import { prisma } from '../db/prisma';

beforeAll(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
});

beforeEach(async () => {
  await prisma.task.deleteMany();
});
```

Wire it via `vitest.config.ts`:

```ts name=vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { setupFiles: ['./src/test/setup.ts'] },
});
```

Run:
```bash
npm test
```

## Mini-task
Add `PATCH /tasks/:id` accepting `{ title?, done?, priority? }`. Validate with Zod (all optional, at least one required). Add a Supertest test.

## Glossary
- **`prisma.<model>.<method>`** — generated, type-safe DB API.
- **`migrate deploy`** — apply pending migrations without prompting (used in CI/test).

## Resources
- [Prisma — CRUD](https://www.prisma.io/docs/orm/prisma-client/queries/crud)
- [Vitest — setupFiles](https://vitest.dev/config/#setupfiles)

## Checklist
- [ ] All previous tests pass against Postgres
- [ ] Test DB is wiped between tests
- [ ] `PATCH /tasks/:id` works and is tested
