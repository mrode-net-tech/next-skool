# Day 24 — Protected routes + user-scoped tasks

## Goal
Apply `requireAuth` to the `/tasks` router and scope all task operations to the authenticated user — users can only see and manage their own tasks.

## Estimated time
~1.5 hours.

## Prerequisites
Day 23 (`requireAuth` middleware, `req.user` typed).

## Where to put your code
In `my-api`.

## Explanation

From Day 20 we have a `userId` column on `Task` and a `User ↔ Task` relation. Now we use the authenticated `req.user.sub` as that `userId` automatically — users never pass `userId` in the request body; the server takes it from the token.

This is the same principle as Laravel's `auth()->id()` inside a controller: the authenticated user's ID comes from the framework (session / token), not from user-supplied input. Accepting `userId` from the body would be an **IDOR** (Insecure Direct Object Reference) vulnerability.

## Step-by-step

### 1. Attach `requireAuth` at the router level

```ts name=src/tasks/routes.ts
import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { CreateTaskSchema } from './schemas';
import * as controller from './controller';

export const tasksRouter = Router();

tasksRouter.use(requireAuth); // every tasks route requires auth

tasksRouter.get('/',       controller.list);
tasksRouter.get('/:id',    controller.show);
tasksRouter.post('/',      validateBody(CreateTaskSchema), controller.create);
tasksRouter.patch('/:id',  validateBody(CreateTaskSchema.partial()), controller.update);
tasksRouter.delete('/:id', controller.remove);
```

### 2. Remove `userId` from `CreateTaskSchema` (server sets it from token)

```ts name=src/tasks/schemas.ts
import { z } from 'zod';

export const CreateTaskSchema = z.object({
  title:    z.string().trim().min(1).max(200),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
```

### 3. Update the controller to read `req.user!.sub`

```ts name=src/tasks/controller.ts
import type { Request, Response } from 'express';
import * as service from './service';

export const list = async (req: Request, res: Response) => {
  res.json(await service.list(req.user!.sub));
};

export const show = async (req: Request, res: Response) => {
  const t = await service.find(req.params.id, req.user!.sub);
  if (!t) return res.status(404).json({ error: 'not found' });
  res.json(t);
};

export const create = async (req: Request, res: Response) => {
  const t = await service.create({ ...req.body, userId: req.user!.sub });
  res.status(201).json(t);
};

export const update = async (req: Request, res: Response) => {
  const t = await service.update(req.params.id, req.user!.sub, req.body);
  if (!t) return res.status(404).json({ error: 'not found' });
  res.json(t);
};

export const remove = async (req: Request, res: Response) => {
  const ok = await service.remove(req.params.id, req.user!.sub);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.status(204).send();
};
```

### 4. Update the store to filter by userId

```ts name=src/tasks/store.ts
import { prisma } from '../db/prisma';

export const TaskStore = {
  list:   (userId: string) =>
    prisma.task.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
  find:   (id: string, userId: string) =>
    prisma.task.findFirst({ where: { id, userId } }),
  create: (data: { title: string; priority?: number; userId: string }) =>
    prisma.task.create({ data }),
  update: async (id: string, userId: string, data: Partial<{ title: string; done: boolean; priority: number }>) => {
    const existing = await prisma.task.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return prisma.task.update({ where: { id }, data });
  },
  remove: async (id: string, userId: string) => {
    const existing = await prisma.task.findFirst({ where: { id, userId } });
    if (!existing) return false;
    await prisma.task.delete({ where: { id } });
    return true;
  },
};
```

## Test it

```ts name=src/tasks/tasks.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../db/prisma';
import { signAccess } from '../auth/jwt';

const app = createApp();

async function authHeader(userId = 'u1', email = 'a@example.com') {
  const token = signAccess({ sub: userId, email });
  return { Authorization: `Bearer ${token}` };
}

beforeEach(async () => {
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
});

describe('tasks — auth scoping', () => {
  it('GET /tasks returns 401 without token', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(401);
  });

  it('user sees only their own tasks', async () => {
    const h1 = await authHeader('u1', 'a@x.com');
    const h2 = await authHeader('u2', 'b@x.com');

    // ensure users exist in DB
    await prisma.user.createMany({
      data: [
        { id: 'u1', email: 'a@x.com', password: 'x' },
        { id: 'u2', email: 'b@x.com', password: 'x' },
      ],
    });

    await request(app).post('/tasks').set(h1).send({ title: 'Alice task' });
    await request(app).post('/tasks').set(h2).send({ title: 'Bob task' });

    const res = await request(app).get('/tasks').set(h1);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Alice task');
  });
});
```

```bash
npm test
```

## Mini-task
Verify that `DELETE /tasks/:id` returns 404 when the authenticated user tries to delete a task that belongs to a different user.

## Glossary
- **IDOR** — Insecure Direct Object Reference; accessing another user's resource by guessing an ID.
- **User-scoped query** — adding `WHERE userId = ?` to every query so data is naturally isolated.

## Resources
- [Express — Router-level middleware](https://expressjs.com/en/guide/using-middleware.html#middleware.router)
- [OWASP — IDOR](https://owasp.org/www-community/attacks/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet)

## Checklist
- [ ] `GET|POST|PATCH|DELETE /tasks` all return 401 without a token
- [ ] Tasks are filtered by the authenticated user's ID
- [ ] `userId` is no longer accepted in the request body
- [ ] Cross-user isolation test passes
