# Day 20 — User ↔ Task relation

## Goal
Add a `User` model and a 1:N relation to `Task`. Expose `userId` on the API.

## Estimated time
~1.5 hours.

## Where to put your code
In `my-api`.

## Explanation

In Prisma a relation is two fields: a scalar foreign key (`userId`) and a navigation field (`user User @relation(...)`). The other side gets `tasks Task[]`.

## Step-by-step

```prisma name=prisma/schema.prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  tasks     Task[]
}

model Task {
  id        String   @id @default(cuid())
  title     String
  done      Boolean  @default(false)
  priority  Int      @default(2)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
}
```

Migrate:
```bash
npx prisma migrate dev --name add_user_relation
```

Update the `CreateTaskSchema`:

```ts name=src/tasks/schemas.ts
import { z } from 'zod';

export const CreateTaskSchema = z.object({
  title:    z.string().trim().min(1).max(200),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  userId:   z.string().min(1),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
```

Update the store to accept `userId` and to `include` the user when listing:

```ts name=src/tasks/store.ts
// in create()
create: (data: { title: string; priority?: number; userId: string }) =>
  prisma.task.create({ data }),

// list with user
list: () => prisma.task.findMany({
  include: { user: true },
  orderBy: { createdAt: 'desc' },
}),
```

Add a tiny Users router so tests can create a user first:

```ts name=src/users/routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { prisma } from '../db/prisma';

export const usersRouter = Router();

const CreateUserSchema = z.object({
  email: z.string().email(),
  name:  z.string().optional(),
});

usersRouter.post('/', validateBody(CreateUserSchema), async (req, res) => {
  const u = await prisma.user.create({ data: req.body });
  res.status(201).json(u);
});
```

Wire it in `app.ts`:
```ts
import { usersRouter } from './users/routes';
app.use('/users', usersRouter);
```

Update the test setup to also clear `User`:
```ts
beforeEach(async () => {
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
});
```

Update (or add) a test that creates a user, then a task referencing that user.

## Mini-task
Add `GET /users/:id/tasks` returning that user's tasks. Test it.

## Glossary
- **Relation field** — navigation property (`user`) referring to the related row.
- **Foreign key** — scalar column holding the related id (`userId`).
- **Cascade** — delete child rows when parent is deleted.

## Resources
- [Prisma — Relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations)
- [Prisma — include vs select](https://www.prisma.io/docs/orm/prisma-client/queries/select-fields)

## Checklist
- [ ] `User` and relation migration applied
- [ ] POST /tasks requires `userId`
- [ ] All Supertest tests green
- [ ] `GET /users/:id/tasks` works
