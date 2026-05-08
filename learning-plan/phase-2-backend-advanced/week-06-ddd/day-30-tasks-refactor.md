# Day 30 — Refactor tasks into a module

## Goal
Apply the same DDD layout to the tasks feature. By the end of today, both `users/` and `tasks/` modules look identical structurally and the full test suite is green.

## Estimated time
~2 hours.

## Prerequisites
Days 26–29 (you understand layers, use cases, and the DI container).

## Where to put your code
In `my-api`.

## Explanation

We repeat the Day 27–29 pattern for tasks. New use cases:
- `CreateTask`
- `ListTasksForUser`
- `MarkTaskDone`
- `DeleteTask`

This is the moment the structure pays off — by the third module you'll be able to scaffold one in 10 minutes.

## Step-by-step

### 1. Folder skeleton

```bash
mkdir -p src/modules/tasks/{domain,application,infrastructure/http}
```

### 2. Domain

```ts name=src/modules/tasks/domain/Task.ts
export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: 1 | 2 | 3;
  userId: string;
  createdAt: Date;
}
export type TaskDTO = Task;
```

```ts name=src/modules/tasks/domain/TaskRepository.ts
import type { Task } from './Task';

export interface TaskRepository {
  findById(id: string): Promise<Task | null>;
  listForUser(userId: string): Promise<Task[]>;
  save(task: Task): Promise<Task>;
  remove(id: string): Promise<boolean>;
}
```

```ts name=src/modules/tasks/domain/errors.ts
export class TaskNotFoundError extends Error {
  readonly code = 'task_not_found';
  constructor(id: string) { super(`Task not found: ${id}`); }
}
export class TaskNotOwnedError extends Error {
  readonly code = 'task_not_owned';
  constructor() { super('You do not own this task'); }
}
```

### 3. Infrastructure

```ts name=src/modules/tasks/infrastructure/PrismaTaskRepository.ts
import { prisma } from '../../../db/prisma';
import type { Task } from '../domain/Task';
import type { TaskRepository } from '../domain/TaskRepository';

function fromPrisma(row: any): Task {
  return {
    id: row.id, title: row.title, done: row.done,
    priority: row.priority as 1 | 2 | 3,
    userId: row.userId, createdAt: row.createdAt,
  };
}

export class PrismaTaskRepository implements TaskRepository {
  async findById(id: string) {
    const r = await prisma.task.findUnique({ where: { id } });
    return r ? fromPrisma(r) : null;
  }
  async listForUser(userId: string) {
    const rows = await prisma.task.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' },
    });
    return rows.map(fromPrisma);
  }
  async save(t: Task) {
    const row = await prisma.task.upsert({
      where: { id: t.id },
      create: { id: t.id, title: t.title, done: t.done, priority: t.priority, userId: t.userId },
      update: { title: t.title, done: t.done, priority: t.priority },
    });
    return fromPrisma(row);
  }
  async remove(id: string) {
    try { await prisma.task.delete({ where: { id } }); return true; }
    catch { return false; }
  }
}
```

### 4. DI tokens & container

```ts name=src/shared/tokens.ts
export const TOKENS = {
  UserRepository: 'UserRepository',
  Hasher:         'Hasher',
  TaskRepository: 'TaskRepository',
} as const;
```

```ts name=src/shared/container.ts
import 'reflect-metadata';
import { container } from 'tsyringe';
import { TOKENS } from './tokens';
import { PrismaUserRepository } from '../modules/users/infrastructure/PrismaUserRepository';
import { BcryptHasher } from '../modules/users/infrastructure/BcryptHasher';
import { PrismaTaskRepository } from '../modules/tasks/infrastructure/PrismaTaskRepository';

export function configureContainer() {
  container.registerSingleton(TOKENS.UserRepository, PrismaUserRepository);
  container.registerSingleton(TOKENS.Hasher,         BcryptHasher);
  container.registerSingleton(TOKENS.TaskRepository, PrismaTaskRepository);
}
export { container };
```

### 5. Use cases

```ts name=src/modules/tasks/application/CreateTask.ts
import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'node:crypto';
import { TOKENS } from '../../../shared/tokens';
import type { TaskRepository } from '../domain/TaskRepository';
import type { Task } from '../domain/Task';

@injectable()
export class CreateTask {
  constructor(@inject(TOKENS.TaskRepository) private tasks: TaskRepository) {}

  async execute(input: { title: string; priority?: 1 | 2 | 3; userId: string }): Promise<Task> {
    return this.tasks.save({
      id: randomUUID(),
      title: input.title,
      priority: input.priority ?? 2,
      done: false,
      userId: input.userId,
      createdAt: new Date(),
    });
  }
}
```

```ts name=src/modules/tasks/application/ListTasksForUser.ts
import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../../../shared/tokens';
import type { TaskRepository } from '../domain/TaskRepository';

@injectable()
export class ListTasksForUser {
  constructor(@inject(TOKENS.TaskRepository) private tasks: TaskRepository) {}
  execute(userId: string) { return this.tasks.listForUser(userId); }
}
```

```ts name=src/modules/tasks/application/MarkTaskDone.ts
import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../../../shared/tokens';
import type { TaskRepository } from '../domain/TaskRepository';
import { TaskNotFoundError, TaskNotOwnedError } from '../domain/errors';

@injectable()
export class MarkTaskDone {
  constructor(@inject(TOKENS.TaskRepository) private tasks: TaskRepository) {}

  async execute(input: { id: string; userId: string }) {
    const task = await this.tasks.findById(input.id);
    if (!task) throw new TaskNotFoundError(input.id);
    if (task.userId !== input.userId) throw new TaskNotOwnedError();
    return this.tasks.save({ ...task, done: true });
  }
}
```

```ts name=src/modules/tasks/application/DeleteTask.ts
import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../../../shared/tokens';
import type { TaskRepository } from '../domain/TaskRepository';
import { TaskNotFoundError, TaskNotOwnedError } from '../domain/errors';

@injectable()
export class DeleteTask {
  constructor(@inject(TOKENS.TaskRepository) private tasks: TaskRepository) {}

  async execute(input: { id: string; userId: string }): Promise<void> {
    const task = await this.tasks.findById(input.id);
    if (!task) throw new TaskNotFoundError(input.id);
    if (task.userId !== input.userId) throw new TaskNotOwnedError();
    await this.tasks.remove(input.id);
  }
}
```

### 6. HTTP layer

```ts name=src/modules/tasks/infrastructure/http/schemas.ts
import { z } from 'zod';
export const CreateTaskSchema = z.object({
  title:    z.string().trim().min(1).max(200),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});
```

```ts name=src/modules/tasks/infrastructure/http/tasksRouter.ts
import { Router } from 'express';
import { container } from '../../../../shared/container';
import { validateBody } from '../../../../middleware/validate';
import { requireAuth } from '../../../../auth/middleware';
import { CreateTaskSchema } from './schemas';
import { CreateTask } from '../../application/CreateTask';
import { ListTasksForUser } from '../../application/ListTasksForUser';
import { MarkTaskDone } from '../../application/MarkTaskDone';
import { DeleteTask } from '../../application/DeleteTask';

export const tasksRouter = Router();

tasksRouter.use(requireAuth); // from Day 23

tasksRouter.get('/', async (req, res, next) => {
  try {
    const useCase = container.resolve(ListTasksForUser);
    res.json(await useCase.execute(req.user!.id));
  } catch (e) { next(e); }
});

tasksRouter.post('/', validateBody(CreateTaskSchema), async (req, res, next) => {
  try {
    const useCase = container.resolve(CreateTask);
    const t = await useCase.execute({ ...req.body, userId: req.user!.id });
    res.status(201).json(t);
  } catch (e) { next(e); }
});

tasksRouter.patch('/:id/done', async (req, res, next) => {
  try {
    const useCase = container.resolve(MarkTaskDone);
    res.json(await useCase.execute({ id: req.params.id, userId: req.user!.id }));
  } catch (e) { next(e); }
});

tasksRouter.delete('/:id', async (req, res, next) => {
  try {
    const useCase = container.resolve(DeleteTask);
    await useCase.execute({ id: req.params.id, userId: req.user!.id });
    res.status(204).send();
  } catch (e) { next(e); }
});
```

### 7. Update the error handler

```ts name=src/middleware/errorHandler.ts
import type { ErrorRequestHandler } from 'express';
import { EmailTakenError, InvalidCredentialsError } from '../modules/users/domain/errors';
import { TaskNotFoundError, TaskNotOwnedError } from '../modules/tasks/domain/errors';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof EmailTakenError)         return res.status(409).json({ error: err.code });
  if (err instanceof InvalidCredentialsError) return res.status(401).json({ error: err.code });
  if (err instanceof TaskNotFoundError)       return res.status(404).json({ error: err.code });
  if (err instanceof TaskNotOwnedError)       return res.status(403).json({ error: err.code });
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
};
```

### 8. Mount the new router and delete the old folder

```ts name=src/app.ts
import { tasksRouter } from './modules/tasks/infrastructure/http/tasksRouter';
// remove the old import; the rest stays the same
```

```bash
rm -rf src/tasks
```

## Test it

### 1. Unit-test a use case with an in-memory repo

```ts name=src/modules/tasks/application/MarkTaskDone.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MarkTaskDone } from './MarkTaskDone';
import { TaskNotFoundError, TaskNotOwnedError } from '../domain/errors';
import type { TaskRepository } from '../domain/TaskRepository';
import type { Task } from '../domain/Task';

class InMemoryTaskRepo implements TaskRepository {
  rows: Task[] = [];
  async findById(id: string) { return this.rows.find(t => t.id === id) ?? null; }
  async listForUser(userId: string) { return this.rows.filter(t => t.userId === userId); }
  async save(t: Task) {
    const i = this.rows.findIndex(r => r.id === t.id);
    if (i >= 0) this.rows[i] = t; else this.rows.push(t);
    return t;
  }
  async remove(id: string) {
    const i = this.rows.findIndex(r => r.id === id);
    if (i < 0) return false;
    this.rows.splice(i, 1);
    return true;
  }
}

describe('MarkTaskDone', () => {
  let repo: InMemoryTaskRepo;
  let useCase: MarkTaskDone;
  const ownTask: Task = {
    id: 't1', title: 'x', done: false, priority: 2,
    userId: 'u1', createdAt: new Date(),
  };

  beforeEach(() => {
    repo = new InMemoryTaskRepo();
    useCase = new MarkTaskDone(repo);
  });

  it('marks an owned task as done', async () => {
    repo.rows.push({ ...ownTask });
    const updated = await useCase.execute({ id: 't1', userId: 'u1' });
    expect(updated.done).toBe(true);
  });

  it('throws TaskNotFoundError for unknown id', async () => {
    await expect(useCase.execute({ id: 'nope', userId: 'u1' }))
      .rejects.toBeInstanceOf(TaskNotFoundError);
  });

  it('throws TaskNotOwnedError when caller is not the owner', async () => {
    repo.rows.push({ ...ownTask });
    await expect(useCase.execute({ id: 't1', userId: 'someone-else' }))
      .rejects.toBeInstanceOf(TaskNotOwnedError);
  });
});
```

### 2. Run the full suite

```bash
npm test
```

All Phase 1 + Week 5 tests must pass with no behavioural change.

## Mini-task
Add `UpdateTask` use case + `PATCH /tasks/:id` route accepting `{ title?, priority?, done? }` (at least one required). Throw `TaskNotOwnedError` for non-owners. Add unit + Supertest tests.

## Glossary
- **Aggregate root** — the entity that owns its consistency boundary; here, `Task` is its own root.
- **Authorization vs authentication** — Day 23 added authentication (who?); ownership checks in use cases are authorization (allowed to do what?).

## Resources
- [Vaughn Vernon — Effective Aggregate Design (PDF)](https://kalele.io/wp-content/uploads/2016/07/effective-aggregate-design.pdf)

## Checklist
- [ ] `src/modules/tasks/` mirrors `src/modules/users/` layout
- [ ] Old `src/tasks/` folder is deleted
- [ ] Four task use cases exist (`CreateTask`, `ListTasksForUser`, `MarkTaskDone`, `DeleteTask`)
- [ ] `errorHandler` maps task errors to 404 / 403
- [ ] At least three unit tests for `MarkTaskDone` pass
- [ ] Full `npm test` is green
