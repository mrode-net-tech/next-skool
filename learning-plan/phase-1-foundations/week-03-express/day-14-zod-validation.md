# Day 14 — Zod validation

## Goal
Replace the hand-written `if (typeof title !== 'string')` checks with **Zod** schemas. Send back nice error messages.

## Estimated time
~1 hour.

## Where to put your code
`exercises/phase-1/week-03-express/my-api/`

## Explanation

**Zod** is a TypeScript-first schema validator. The schema describes the shape *and* gives you a TS type for free.

Laravel analogy: a Zod schema is roughly a `FormRequest`'s rules, but the result is also a typed object.

## Step-by-step

```bash
npm i zod
```

```ts name=src/tasks/schemas.ts
import { z } from 'zod';

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, 'title required').max(200),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
```

Use it in the route:

```ts
import { CreateTaskSchema } from './tasks/schemas';

app.post('/tasks', (req, res) => {
  const parsed = CreateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'validation_failed',
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const t = TaskStore.create(parsed.data.title);
  res.status(201).json(t);
});
```

### Reusable middleware
Validating in every route gets boring. Let's extract:

```ts name=src/middleware/validate.ts
import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'validation_failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    req.body = parsed.data;
    next();
  };
}
```

Usage:
```ts
app.post('/tasks', validateBody(CreateTaskSchema), (req, res) => {
  const t = TaskStore.create(req.body.title);
  res.status(201).json(t);
});
```

## Mini-task
Add a `priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2)` field. Verify defaulting works when missing.

## Glossary
- **Zod** — TS-first schema validator.
- **`safeParse`** — returns `{ success, data | error }` (no throws).
- **`z.infer`** — derive a TS type from a Zod schema.

## Resources
- [Zod docs](https://zod.dev/)

## Checklist
- [ ] Invalid POST returns 400 with `details`
- [ ] `validateBody` middleware reused on at least one route
- [ ] You used `z.infer`
