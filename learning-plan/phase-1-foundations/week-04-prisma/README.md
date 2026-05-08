# Week 4 — Prisma + Postgres

**Goal:** Replace the in-memory store with a real **Postgres** database accessed through **Prisma**. Your Supertest suite must still be green at the end.

## Days

- [Day 16 — Postgres in Docker](./day-16-postgres-docker.md)
- [Day 17 — Install Prisma](./day-17-install-prisma.md)
- [Day 18 — First model + migration](./day-18-first-model-migration.md)
- [Day 19 — CRUD with Prisma](./day-19-crud-prisma.md)
- [Day 20 — User ↔ Task relation](./day-20-user-task-relation.md)

## Outcome

The `my-api` project from Week 3, now backed by:
- Postgres running in Docker (`docker-compose.yml`)
- Prisma schema with `User` and `Task` (1:N)
- All routes using Prisma instead of the in-memory store
- A test database used by Supertest tests
