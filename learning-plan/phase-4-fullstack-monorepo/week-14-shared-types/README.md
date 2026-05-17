# Week 14 — Shared Types

**Goal:** Extract shared Zod schemas and TypeScript interfaces into a `packages/types` workspace package. Build a type-safe fetch client that uses the schemas to parse responses. Centralise ESLint and tsconfig into shared packages.

## Days

- [Day 66 — packages/types](./day-66-packages-types.md)
- [Day 67 — Shared Zod schemas](./day-67-shared-zod-schemas.md)
- [Day 68 — Type-safe API client (fetch + Zod)](./day-68-type-safe-api-client.md)
- [Day 69 — Generated SDK](./day-69-generated-sdk.md)
- [Day 70 — ESLint + TS config packages](./day-70-eslint-ts-config-packages.md)

## Outcome

`task-manager` now has:
- `@task-manager/types` — `Task`, `User`, `PaginatedResponse` interfaces + Zod schemas
- `@task-manager/api-client` — typed fetch wrapper; every call returns `z.infer<Schema>`
- `apps/api` imports schemas for validation; `apps/web` imports schemas for parsing
- Type mismatch between API response and frontend expectation is a compile-time error
- `@task-manager/config-eslint` + `@task-manager/config-tsconfig` used by both apps
