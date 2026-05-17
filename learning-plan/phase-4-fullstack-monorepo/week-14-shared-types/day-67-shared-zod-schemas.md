# Day 67 — Shared Zod schemas

## Goal
Move Zod validation schemas into `packages/types`, export them alongside TypeScript types, and eliminate the duplication between `apps/api` and `apps/web` validation rules.

## Estimated time
~1.5 hours

## Prerequisites
Day 66 — `packages/types` with all shared interfaces. Day 49 — Zod resolvers in `apps/web`.

## Where to put your code
In `task-manager/packages/types/`.

## Explanation

On Day 49 you noticed: "Right now schemas are duplicated between `my-api/src/tasks/schemas.ts` and `my-web/src/schemas/task.schema.ts`. This is acceptable during Phase 3. In Phase 4, `packages/types` centralises them." Today is that moment.

**Shared Zod schemas** mean one source of truth for validation rules. When you tighten `title` from `max(200)` to `max(100)`, both the API rejection and the form error message update simultaneously.

The key insight: `packages/types` already exports `Task` (the TypeScript interface). Adding the Zod schema alongside it means the inferred type (`z.infer<typeof CreateTaskSchema>`) exactly equals the `CreateTaskRequest` interface — or they should be identical, which you verify at compile time.

Zod must be installed in `packages/types` as a regular dependency (not devDependency) because the compiled schema runs at runtime in both apps.

## Step-by-step

### 1. Add Zod to `packages/types`

```bash
pnpm --filter @task-manager/types add zod
```

### 2. Separate schema file

```ts name=packages/types/src/schemas.ts
import { z } from 'zod';

// ─── Task schemas ─────────────────────────────────────────────────────────────

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Max 200 characters'),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  userId: z.string().min(1, 'userId is required'),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  done: z.boolean().optional(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const TaskListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  done: z.coerce.boolean().optional(),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

export type TaskListQuery = z.infer<typeof TaskListQuerySchema>;

// ─── User schemas ─────────────────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email'),
  name: z.string().trim().min(1).max(100).optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// ─── Auth schemas ─────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
```

### 3. Update `packages/types/src/index.ts` to re-export schemas

```ts name=packages/types/src/index.ts
// Types (interfaces) — safe to import on both client and server
export type { User, Task, CreateTaskRequest, UpdateTaskRequest, CreateUserRequest, LoginRequest, AuthTokens, AuthResponse, PaginatedResponse, ApiError, SortOrder, TaskListQuery, EntityRef } from './types';

// Zod schemas + inferred types — import these where validation runs
export {
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskListQuerySchema,
  CreateUserSchema,
  LoginSchema,
} from './schemas';

export type {
  CreateTaskInput,
  UpdateTaskInput,
  CreateUserInput,
  LoginInput,
} from './schemas';
```

Rename the existing `src/index.ts` content to `src/types.ts` first:

```bash
mv packages/types/src/index.ts packages/types/src/types.ts
```

Then create the new `src/index.ts` as shown above.

### 4. Update `apps/api` to use shared schemas

```ts name=apps/api/src/tasks/infrastructure/http/task.router.ts
import { CreateTaskSchema, UpdateTaskSchema, TaskListQuerySchema } from '@task-manager/types';

// Replace local validateBody calls:
tasksRouter.post('/', validateBody(CreateTaskSchema), async (req, res) => {
  // req.body is now typed as CreateTaskInput
});

tasksRouter.patch('/:id', validateBody(UpdateTaskSchema), async (req, res) => {
  // ...
});

tasksRouter.get('/', async (req, res) => {
  const query = TaskListQuerySchema.parse(req.query);
  // query.limit, query.cursor, query.sort are typed + validated
});
```

Delete `apps/api/src/tasks/schemas.ts` — no longer needed.

### 5. Update `apps/web` to use shared schemas

```ts name=apps/web/src/components/NewTaskForm.tsx
import { CreateTaskSchema, type CreateTaskInput } from '@task-manager/types';
```

Delete `apps/web/src/schemas/task.schema.ts` — no longer needed.

### 6. Compile-time contract check

Add a type assertion to `packages/types/src/types.ts` to verify that the Zod inferred type matches the TypeScript interface:

```ts name=packages/types/src/types.ts
import type { CreateTaskInput } from './schemas';
import type { CreateTaskRequest } from './types';

// This line fails to compile if the two types diverge
type _AssertCreateTaskMatch = CreateTaskInput extends CreateTaskRequest ? true : never;
type _AssertCreateTaskMatch2 = CreateTaskRequest extends CreateTaskInput ? true : never;
```

If you add a required field to `CreateTaskRequest` but forget to add it to `CreateTaskSchema`, compilation fails.

## Test it

```bash
pnpm turbo typecheck
```

No errors — both apps compile with the shared schemas.

```bash
# Test API validation with shared schema
curl -X POST http://localhost:3000/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":""}'
# Expected: 400 with validation error
```

## Mini-task
Add a `PasswordSchema` to `packages/types/src/schemas.ts`:
```ts
export const PasswordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/, 'Must contain uppercase')
  .regex(/[0-9]/, 'Must contain number');
```
Extend `LoginSchema` to use it for the `password` field.

## Glossary
- **Schema as source of truth** — define validation once; both API rejection and form error use the same rule.
- **`z.coerce`** — Zod coercion; converts string query params to numbers/booleans before validation.
- **Type assertion** — `extends ... ? true : never` pattern to enforce type compatibility at compile time.
- **Re-export** — `export { X } from './schemas'`; allows callers to import from one entry point.

## Resources
- [Zod docs — Type inference](https://zod.dev/?id=type-inference)
- [Zod — Coerce](https://zod.dev/?id=coercion-for-primitives)

## Checklist
- [ ] Zod installed in `packages/types`
- [ ] `src/schemas.ts` contains all shared validation schemas
- [ ] `src/index.ts` re-exports both types and schemas
- [ ] Local schemas deleted from `apps/api` and `apps/web`
- [ ] Both apps import schemas from `@task-manager/types`
- [ ] Compile-time contract check added
- [ ] `pnpm turbo typecheck` passes
