# Week 16 — Deploy + E2E

**Goal:** Add Playwright end-to-end tests for the critical auth + task flow, deploy both apps to production, and run e2e tests in GitHub Actions CI.

## Days

- [Day 76 — Playwright setup](./day-76-playwright-setup.md)
- [Day 77 — First e2e test](./day-77-first-e2e-test.md)
- [Day 78 — Deploy api (Railway / Fly.io)](./day-78-deploy-api.md)
- [Day 79 — Deploy web (Vercel)](./day-79-deploy-web.md)
- [Day 80 — CI runs e2e](./day-80-ci-e2e.md)

## Outcome

`task-manager` is deployed and tested end-to-end:
- Playwright installed at `apps/web` with a shared base URL config
- e2e tests: register, login, create task, mark done, logout — all green
- `apps/api` deployed to Railway (or Fly.io) with `DATABASE_URL` + `JWT_*` env vars set
- `apps/web` deployed to Vercel with `VITE_API_URL` pointing to the live API
- GitHub Actions workflow: lint → typecheck → unit tests → e2e tests on every PR
- Phase 4 complete — full-stack monorepo live in production
