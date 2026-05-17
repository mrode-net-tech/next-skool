# Day 66 — packages/types — shared domain types

## Goal
Expand `packages/types` with all domain types used by both `apps/api` and `apps/web`, add JSDoc, and understand the boundary between types that belong in the shared package vs types that belong inside a single app.

## Estimated time
~1 hour

## Prerequisites
Day 65 — shared config packages. Day 61 — `packages/types` skeleton.

## Where to put your code
In `task-manager/packages/types/`.

## Explanation

`packages/types` is the **contract** between the API and the web app. It contains only what crosses the HTTP boundary: request shapes, response shapes, and domain entities as returned by the API. It does NOT contain:
- Prisma model types (those live in `apps/api` — the DB schema is an API implementation detail)
- React component props (those live in `apps/web`)
- Server-only types (auth session, repository interfaces)

Think of it as an API contract file — like an OpenAPI schema but expressed as TypeScript interfaces. In a team, this package is what the backend and frontend developers agree on first before either starts building.

The Laravel analogy: it's like defining your API Resource classes (`UserResource`, `TaskResource`) in a shared library that both your backend and your frontend type-checker can consume.

## Step-by-step

### 1. Expanded `packages/types/src/index.ts`

```ts name=packages/types/src/index.ts
// ─── Domain entities (API response shapes) ───────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string; // ISO-8601; JSON serializes Date as string
}

export interface Task {
  id: string;
  title: string;
  done: boolean;
  /** 1 = Low, 2 = Medium, 3 = High */
  priority: 1 | 2 | 3;
  userId: string;
  user?: Pick<User, 'id' | 'email' | 'name'>;
  createdAt: string;
  updatedAt: string;
}

// ─── Request shapes ───────────────────────────────────────────────────────────

export interface CreateTaskRequest {
  title: string;
  priority?: 1 | 2 | 3;
  userId: string;
}

export interface UpdateTaskRequest {
  title?: string;
  done?: boolean;
  priority?: 1 | 2 | 3;
}

export interface CreateUserRequest {
  email: string;
  name?: string;
}

// ─── Response wrappers ────────────────────────────────────────────────────────

/** Generic paginated response — all list endpoints return this shape */
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

/** Standard error response body */
export interface ApiError {
  error: string;
  details?: unknown;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// ─── Utility types ────────────────────────────────────────────────────────────

/** Pick only the ID from any entity — useful for relationship references */
export type EntityRef<T extends { id: string }> = Pick<T, 'id'>;
```

### 2. What NOT to export from this package

```ts
// ❌ NOT here — Prisma type, DB implementation detail
import type { Task as PrismaTask } from '@prisma/client';

// ❌ NOT here — React prop type, UI-only concern
interface TaskCardProps { task: Task; onToggle: () => void; }

// ❌ NOT here — server-only, not serialised over HTTP
interface JwtPayload { sub: string; exp: number; }
```

If you find yourself importing something from `@task-manager/types` only in `apps/api`, it doesn't belong there.

### 3. Version the contract with `@since` JSDoc

```ts
export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: 1 | 2 | 3;
  userId: string;
  createdAt: string;
  updatedAt: string;
  /** @since Phase 5 — ai-folio extension */
  tags?: string[];
}
```

`@since` documents when a field was added without breaking backward compatibility. Consumers that don't use `tags` simply ignore it.

### 4. Verify both apps can import from the package

In `apps/api/src/tasks/routes.ts`:
```ts
import type { CreateTaskRequest, Task } from '@task-manager/types';
```

In `apps/web/src/api/tasks.ts`:
```ts
import type { Task, PaginatedResponse } from '@task-manager/types';
```

```bash
pnpm turbo typecheck
```

No errors means the contract is accepted by both sides.

### 5. Keep `PaginatedResponse` generic

```ts
// In apps/web/src/api/tasks.ts
import type { PaginatedResponse, Task } from '@task-manager/types';

export async function fetchTasksPage({ pageParam }: { pageParam: string | null }): Promise<PaginatedResponse<Task>> {
  // ...
}
```

The generic `PaginatedResponse<T>` means you add one type, use it for all paginated endpoints — tasks, users, and future `ai-folio` conversations.

## Test it

```bash
pnpm --filter @task-manager/types typecheck
pnpm turbo typecheck
```

## Mini-task
Add a `SortOrder` type and a `TaskListQuery` interface to `packages/types`:
```ts
export type SortOrder = 'asc' | 'desc';
export interface TaskListQuery {
  cursor?: string;
  limit?: number;
  done?: boolean;
  sort?: SortOrder;
}
```
Use `TaskListQuery` in `apps/web/src/api/tasks.ts` as the parameter type for `fetchTasksPage`.

## Glossary
- **API contract** — the agreed types that both client and server implement against.
- **`EntityRef<T>`** — utility type keeping only the `id` from an entity; useful for FK references in requests.
- **`@since`** — JSDoc tag documenting when a field was introduced.
- **ISO-8601** — standard date string format (`2024-01-15T12:00:00Z`); what `JSON.stringify(new Date())` produces.

## Resources
- [TypeScript — Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
- [JSDoc — @since](https://jsdoc.app/tags-since)

## Checklist
- [ ] All entity types have `createdAt: string` (not `Date` — JSON serialises Dates as strings)
- [ ] Request shapes separated from response shapes
- [ ] `PaginatedResponse<T>` and `ApiError` exported
- [ ] Auth types in shared package
- [ ] Both apps import from `@task-manager/types`, no local duplicates
- [ ] `pnpm turbo typecheck` passes
