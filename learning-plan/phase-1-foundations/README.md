# Phase 1 — Foundations (Weeks 1–4)

**Goal:** Get from zero TS/Node to a working Express API backed by Prisma + Postgres, with first tests.

## Outcome at the end of phase 1

You have a working **Task Manager API** (`my-api`):
- Express server with TypeScript
- Zod-validated POST endpoints
- Postgres database via Docker
- Prisma schema with `User` and `Task`
- Vitest unit tests + Supertest integration tests

## Weeks

| Week | Topic | Folder |
| ---- | ----- | ------ |
| 1 | Setup | [`week-01-setup`](./week-01-setup/) |
| 2 | TypeScript + first tests | [`week-02-typescript`](./week-02-typescript/) |
| 3 | Express + tests | [`week-03-express`](./week-03-express/) |
| 4 | Prisma + tests | [`week-04-prisma`](./week-04-prisma/) |

## Mindset for a Laravel dev

- **No framework magic** — in Node you wire things up explicitly. This is good for learning, even if it feels verbose at first.
- **Files = modules** — each file's `export`s are its public API; there is no autoloader scanning your folders.
- **Async by default** — most I/O returns Promises. `await` is your friend.
- **Types are optional but valuable** — we lean into TypeScript from Day 4.
