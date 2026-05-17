# Phase 4 — Fullstack Monorepo (Weeks 13–16)

**Goal:** Merge `my-api` and `my-web` into a single `task-manager` pnpm monorepo, add shared type packages, wire real end-to-end auth, and ship both apps to production.

## Outcome at the end of phase 4

You have a deployed **Task Manager monorepo** (`task-manager`):
- pnpm workspaces + Turborepo for parallel builds and caching
- `apps/api` — Express API ported from `my-api`
- `apps/web` — React SPA ported from `my-web`
- `packages/types` — shared Zod schemas + TypeScript interfaces consumed by both apps
- `packages/config-eslint` + `packages/config-tsconfig` — shared tooling config
- Login flow end-to-end: JWT issued by API, stored in the browser, protected React routes
- Playwright e2e tests covering the full login → task CRUD flow
- `apps/api` deployed to Railway or Fly.io
- `apps/web` deployed to Vercel
- GitHub Actions CI pipeline that runs lint, typecheck, unit tests, and e2e tests on every PR

## Weeks

| Week | Topic | Folder |
| ---- | ----- | ------ |
| 13 | Monorepo setup | [`week-13-monorepo-setup`](./week-13-monorepo-setup/) |
| 14 | Shared types | [`week-14-shared-types`](./week-14-shared-types/) |
| 15 | Auth integration | [`week-15-auth`](./week-15-auth/) |
| 16 | Deploy + e2e | [`week-16-deploy`](./week-16-deploy/) |

## Mindset for a Laravel dev entering this phase

**Monorepos are a deployment strategy, not a magic box.** You still have two separate processes (API + web). The monorepo just means they share a single git repository, a single `node_modules` install, and a single CI pipeline. Changes to `packages/types` are picked up by both apps immediately — no npm publishing step.

**Types as the contract.** Zod schemas in `packages/types` replace the informal "the API returns this shape" agreement. Both API (validation) and web (parsing) import the same schema. A breaking API change becomes a TypeScript error in the frontend before any tests even run.

**e2e tests are slow — use them surgically.** Playwright tests exercise the full stack (browser → API → DB). Run them in CI, not in watch mode. Unit and integration tests (Vitest + Supertest) stay fast; e2e covers the critical paths only.
