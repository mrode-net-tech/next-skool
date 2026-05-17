# Week 13 — Monorepo Setup

**Goal:** Create the `task-manager` pnpm monorepo, configure Turborepo for parallel builds, and migrate both `my-api` and `my-web` into it as `apps/api` and `apps/web`.

## Days

- [Day 61 — pnpm workspaces](./day-61-pnpm-workspaces.md)
- [Day 62 — Turborepo](./day-62-turborepo.md)
- [Day 63 — Move my-api into apps/api](./day-63-move-api.md)
- [Day 64 — Move my-web into apps/web](./day-64-move-web.md)
- [Day 65 — Shared scripts + root tooling](./day-65-shared-scripts.md)

## Outcome

`task-manager/` monorepo with:
- `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`
- `turbo.json` with `build`, `dev`, `test`, `lint`, `typecheck` pipelines
- `apps/api` — full `my-api` Express backend, runnable with `pnpm --filter api dev`
- `apps/web` — full `my-web` React SPA, runnable with `pnpm --filter web dev`
- `pnpm dev` at root starts both apps in parallel via Turborepo
- Single `.eslintrc` + `tsconfig` base in `packages/config-*`
