# Day 69 — Generated SDK (openapi-fetch)

## Goal
Generate a type-safe API client from an OpenAPI spec using `openapi-fetch`, replace the hand-written `apiFetch` functions, and understand the trade-off between generated and manual clients.

## Estimated time
~2 hours

## Prerequisites
Day 68 — manual `apiFetch` client. `my-api` running.

## Where to put your code
In `task-manager/packages/` (new package `api-client`) and `apps/api/`.

## Explanation

The `apiFetch` client from Day 68 works, but it requires you to maintain response Zod schemas manually in `apps/web`. If the API adds a field, you update the Zod schema in `apps/web` — two places to change.

**OpenAPI + code generation** solves this: define the API contract once in an OpenAPI (Swagger) YAML file, then generate TypeScript types and a client automatically. Tools: `openapi-typescript` generates TypeScript types from the spec; `openapi-fetch` is a tiny fetch wrapper that uses those generated types.

The flow:
1. Write `apps/api/openapi.yaml` (the spec).
2. Run `openapi-typescript openapi.yaml -o ../packages/api-client/src/api.ts`.
3. `apps/web` imports the generated client — fully typed with no manual schema maintenance.

The Laravel analogy: it's like using `swagger.json` with a code generator to produce a PHP SDK — except this runs in seconds and integrates into your Turborepo build pipeline.

**Trade-off:** OpenAPI specs are verbose to write and must stay in sync with the actual implementation. For a small internal API (this project), the manual `apiFetch` from Day 68 is often preferable. Today you learn both so you can make the right choice on real projects.

## Step-by-step

### 1. Install tools

```bash
# In apps/api
pnpm add -D openapi-typescript

# In root
pnpm add -Dw openapi-fetch
```

### 2. Write `apps/api/openapi.yaml`

```yaml name=apps/api/openapi.yaml
openapi: "3.1.0"
info:
  title: Task Manager API
  version: "1.0.0"
servers:
  - url: http://localhost:3000
paths:
  /tasks:
    get:
      operationId: listTasks
      summary: List tasks (cursor-paginated)
      parameters:
        - name: cursor
          in: query
          schema: { type: string }
        - name: limit
          in: query
          schema: { type: integer, minimum: 1, maximum: 50, default: 10 }
        - name: done
          in: query
          schema: { type: boolean }
      responses:
        "200":
          description: Paginated tasks
          content:
            application/json:
              schema: { $ref: "#/components/schemas/PaginatedTasks" }
    post:
      operationId: createTask
      summary: Create a task
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/CreateTaskRequest" }
      responses:
        "201":
          description: Created task
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Task" }
  /tasks/{id}:
    get:
      operationId: getTask
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Task" }
        "404":
          description: Not found
    patch:
      operationId: updateTask
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      requestBody:
        content:
          application/json:
            schema: { $ref: "#/components/schemas/UpdateTaskRequest" }
      responses:
        "200":
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Task" }
    delete:
      operationId: deleteTask
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        "204":
          description: Deleted

components:
  schemas:
    Task:
      type: object
      required: [id, title, done, priority, userId, createdAt, updatedAt]
      properties:
        id: { type: string }
        title: { type: string }
        done: { type: boolean }
        priority: { type: integer, enum: [1, 2, 3] }
        userId: { type: string }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time }
    CreateTaskRequest:
      type: object
      required: [title, userId]
      properties:
        title: { type: string, minLength: 1, maxLength: 200 }
        priority: { type: integer, enum: [1, 2, 3], default: 2 }
        userId: { type: string }
    UpdateTaskRequest:
      type: object
      properties:
        title: { type: string, minLength: 1, maxLength: 200 }
        done: { type: boolean }
        priority: { type: integer, enum: [1, 2, 3] }
    PaginatedTasks:
      type: object
      required: [items, nextCursor]
      properties:
        items:
          type: array
          items: { $ref: "#/components/schemas/Task" }
        nextCursor:
          type: string
          nullable: true
```

### 3. Create `packages/api-client`

```json name=packages/api-client/package.json
{
  "name": "@task-manager/api-client",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "generate": "openapi-typescript ../../apps/api/openapi.yaml -o src/api.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "openapi-fetch": "^0.9.0"
  },
  "devDependencies": {
    "@task-manager/config-tsconfig": "workspace:*",
    "openapi-typescript": "^6.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 4. Generate types and build the client

```bash
pnpm --filter @task-manager/api-client generate
```

This creates `packages/api-client/src/api.ts` with full TypeScript types derived from the YAML.

Then create the client:

```ts name=packages/api-client/src/index.ts
import createClient from 'openapi-fetch';
import type { paths } from './api';

export function createApiClient(baseUrl: string, token?: string) {
  return createClient<paths>({
    baseUrl,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;

// Re-export generated types for consumers
export type { paths, components } from './api';
export type Task = components['schemas']['Task'];
export type CreateTaskRequest = components['schemas']['CreateTaskRequest'];
export type PaginatedTasks = components['schemas']['PaginatedTasks'];
```

### 5. Use the generated client in `apps/web`

```bash
pnpm --filter @task-manager/web add @task-manager/api-client --workspace
```

```ts name=apps/web/src/api/client.ts
import { createApiClient } from '@task-manager/api-client';

export const apiClient = createApiClient(
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
);
```

```ts name=apps/web/src/api/tasks.ts
import { apiClient } from './client';
import type { PaginatedTasks } from '@task-manager/api-client';

export async function fetchTasksPage({ pageParam }: { pageParam: string | null }) {
  const { data, error } = await apiClient.GET('/tasks', {
    params: { query: { limit: 10, ...(pageParam ? { cursor: pageParam } : {}) } },
  });
  if (error) throw new Error(JSON.stringify(error));
  return data as PaginatedTasks;
}
```

`openapi-fetch` returns `{ data, error }` — no throw by default. Check `error` before using `data`.

### 6. Add `generate` to Turborepo pipeline

```json name=turbo.json
{
  "tasks": {
    "generate": {
      "inputs": ["../../apps/api/openapi.yaml"],
      "outputs": ["src/api.ts"],
      "dependsOn": []
    }
  }
}
```

Now `pnpm turbo generate` regenerates the client whenever the spec changes.

## Test it

```bash
pnpm --filter @task-manager/api-client generate
pnpm turbo typecheck
```

The generated `api.ts` is hundreds of lines — don't edit it manually. If it compiles, the spec and implementation are in sync.

## Mini-task
Add `GET /users` to `openapi.yaml` and regenerate. The `users` endpoint should return `{ items: User[], nextCursor: string | null }`. Verify the generated `paths` type includes `/users`.

## Glossary
- **OpenAPI** — standard specification format for HTTP APIs (formerly Swagger).
- **`openapi-typescript`** — generates TypeScript types from an OpenAPI spec file.
- **`openapi-fetch`** — thin typed fetch wrapper using OpenAPI-generated types.
- **`paths` type** — generated TypeScript type with every endpoint's request/response types.

## Resources
- [openapi-typescript](https://openapi-ts.pages.dev/)
- [openapi-fetch](https://openapi-ts.pages.dev/openapi-fetch/)
- [OpenAPI 3.1 spec](https://spec.openapis.org/oas/v3.1.0)

## Checklist
- [ ] `openapi.yaml` covers all task CRUD endpoints
- [ ] `pnpm --filter @task-manager/api-client generate` creates `src/api.ts`
- [ ] `createApiClient` exported from `packages/api-client`
- [ ] `apps/web` uses generated client for at least `fetchTasksPage`
- [ ] `pnpm turbo typecheck` passes with generated types
- [ ] Understood trade-off: generated vs manual client
