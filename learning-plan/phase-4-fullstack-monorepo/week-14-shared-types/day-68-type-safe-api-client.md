# Day 68 — Type-safe API client (fetch + Zod)

## Goal
Build a type-safe HTTP client in `apps/web` that validates API responses with Zod at runtime, and understand why runtime validation matters even when you control both sides.

## Estimated time
~1.5 hours

## Prerequisites
Day 67 — shared Zod schemas. Day 51–52 — TanStack Query in `apps/web`.

## Where to put your code
In `task-manager/apps/web/src/api/`.

## Explanation

TypeScript types are erased at runtime — the browser never sees them. When your API returns `{ id: "1", title: "Task", priority: 5 }`, TypeScript won't complain at runtime even though `priority: 5` violates the `1 | 2 | 3` union. Without runtime validation, type safety is a compile-time illusion for API responses.

**Runtime validation with Zod** closes this gap: parse the response through the same Zod schema before returning it to the component. If the API returns an unexpected shape, you get an error immediately (at the API boundary) rather than a cryptic runtime crash deep in the component tree.

This is especially important when:
- The API evolves and a field is renamed
- You consume a third-party API outside your control
- Your API returns different shapes based on DB state (optional relations)

The Laravel analogy: it's like using `$validated = $request->validate(...)` on both sides — client and server — so that any mismatch in expectations is caught immediately rather than causing silent data corruption.

## Step-by-step

### 1. Generic `apiFetch` wrapper

```ts name=apps/web/src/api/client.ts
import { z } from 'zod';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface FetchOptions extends RequestInit {
  token?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  options?: FetchOptions
): Promise<T> {
  const { token, ...init } = options ?? {};

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new ApiError(res.status, message, body);
  }

  return schema.parse(body); // throws ZodError if shape is wrong
}
```

### 2. Response schemas (separate from request schemas)

```ts name=apps/web/src/api/schemas.ts
import { z } from 'zod';

// Mirror the API response shape — these exist in apps/web only
// (the server-side Prisma output may include relations we don't need on the client)

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  createdAt: z.string(),
});

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PaginatedTasksSchema = z.object({
  items: z.array(TaskSchema),
  nextCursor: z.string().nullable(),
});
```

> Note: these response schemas live in `apps/web` — they represent what the API actually returns, which may differ from the request schemas in `packages/types`. If the API returns nested `user` objects, add them here.

### 3. Typed API functions using `apiFetch`

```ts name=apps/web/src/api/tasks.ts
import { apiFetch } from './client';
import { PaginatedTasksSchema, TaskSchema } from './schemas';
import type { CreateTaskInput, UpdateTaskInput } from '@task-manager/types';

export async function fetchTasksPage({
  pageParam,
}: {
  pageParam: string | null;
}) {
  const cursor = pageParam ? `&cursor=${pageParam}` : '';
  return apiFetch(`/tasks?limit=10${cursor}`, PaginatedTasksSchema);
}

export async function fetchTask(id: string) {
  return apiFetch(`/tasks/${id}`, TaskSchema);
}

export async function createTask(input: CreateTaskInput) {
  return apiFetch(`/tasks`, TaskSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateTask(id: string, patch: UpdateTaskInput) {
  return apiFetch(`/tasks/${id}`, TaskSchema, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteTask(id: string) {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/tasks/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
```

### 4. Handle `ZodError` in components

When response validation fails, TanStack Query catches the thrown `ZodError`. In `TasksPage`:

```tsx
if (isError) {
  const msg = error instanceof Error ? error.message : 'Unknown error';
  return <ErrorMessage message={msg} />;
}
```

`ZodError` extends `Error` so this works. For debugging, log `error.errors` (array of issues with paths).

### 5. Add `VITE_API_URL` to `.env`

```env name=apps/web/.env
VITE_API_URL=http://localhost:3000
```

Vite exposes `VITE_*` variables to the browser via `import.meta.env`. Never put secrets in `VITE_*` variables.

### 6. Test that schema mismatch throws

Temporarily change `TaskSchema`:
```ts
export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
  priority: z.literal(99), // impossible value
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

The task list should show the `ErrorMessage` component with a Zod parse error. Revert after verifying.

## Test it

Update msw handlers to return the expected shape, then run tests:

```bash
pnpm --filter @task-manager/web test
```

Add a specific test verifying that a malformed API response triggers an error state:

```tsx name=apps/web/src/pages/TasksPage.test.tsx
it('shows error when API returns unexpected shape', async () => {
  server.use(
    http.get('http://localhost:3000/tasks', () =>
      HttpResponse.json({ items: [{ id: '1', WRONG_FIELD: true }], nextCursor: null })
    )
  );

  renderTasksPage();
  expect(await screen.findByRole('alert')).toBeInTheDocument();
});
```

## Mini-task
Add an `apiFetchVoid` helper for endpoints that return no body (like `DELETE /tasks/:id`):
```ts
export async function apiFetchVoid(path: string, options?: FetchOptions): Promise<void> {
  // Similar to apiFetch but no schema validation — just check res.ok
}
```

## Glossary
- **Runtime validation** — checking data shape at runtime (not just compile time) using Zod.
- **`ApiError`** — custom error class carrying `status` + body for typed error handling.
- **`import.meta.env`** — Vite's mechanism for environment variables; only `VITE_*` prefix is exposed.
- **`ZodError`** — thrown by `.parse()` when data doesn't match schema; has `.errors` array with paths.

## Resources
- [Zod — Parse](https://zod.dev/?id=parse)
- [Vite — Env Variables](https://vitejs.dev/guide/env-and-mode.html)

## Checklist
- [ ] `apiFetch` wrapper validates responses with Zod
- [ ] `ApiError` class thrown on non-2xx responses
- [ ] All API functions use `apiFetch` with typed schemas
- [ ] `VITE_API_URL` in `.env` file
- [ ] Malformed API response shows error in component
- [ ] Test for schema mismatch passes
