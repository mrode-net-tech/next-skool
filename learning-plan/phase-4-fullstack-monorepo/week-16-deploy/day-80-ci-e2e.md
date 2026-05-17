# Day 80 — CI runs e2e

## Goal
Add a GitHub Actions workflow that runs lint, typecheck, unit tests, builds both apps, and runs Playwright e2e tests — completing Phase 4 with a production-grade CI pipeline.

## Estimated time
~2 hours

## Prerequisites
Day 79 — both apps deployed. Day 77 — Playwright tests passing locally.

## Where to put your code
`.github/workflows/` at the monorepo root.

## Explanation

**GitHub Actions** is the CI system built into GitHub. A workflow is a YAML file in `.github/workflows/` that defines jobs triggered by events (push, PR). Each job runs in an isolated Ubuntu container (or macOS/Windows).

The pipeline for a monorepo with Turborepo:
1. Install pnpm + dependencies
2. Restore Turborepo cache (from GitHub Actions cache)
3. Run `turbo lint typecheck test build` in parallel where possible
4. Run Playwright e2e tests (needs running services)

**Turborepo remote cache** is the key performance feature: if nothing changed since the last CI run, all tasks are cache hits and the pipeline finishes in seconds. Set up via `turbo login` + `TURBO_TOKEN` secret (Vercel's free tier).

## Step-by-step

### 1. Main CI workflow

```yaml name=.github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  # Turborepo remote cache (optional but recommended)
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

jobs:
  # ── Quality checks ────────────────────────────────────────────────────────
  quality:
    name: Lint + Typecheck + Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm turbo lint

      - name: Typecheck
        run: pnpm turbo typecheck

      - name: Unit tests
        run: pnpm turbo test
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

      - name: Build
        run: pnpm turbo build

  # ── E2E tests ─────────────────────────────────────────────────────────────
  e2e:
    name: Playwright E2E
    runs-on: ubuntu-latest
    needs: quality  # Only run if quality checks pass
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: tasks_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm --filter @task-manager/e2e exec playwright install --with-deps chromium

      - name: Build apps
        run: pnpm turbo build

      - name: Run DB migrations
        run: pnpm --filter @task-manager/api db:migrate:prod
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/tasks_test

      - name: Start API
        run: pnpm --filter @task-manager/api start &
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/tasks_test
          JWT_SECRET: ci-test-secret-at-least-32-characters-long
          JWT_EXPIRES_IN: 15m
          REFRESH_TOKEN_EXPIRES_IN: 7d
          CORS_ORIGIN: http://localhost:5173
          PORT: 3000
          NODE_ENV: test

      - name: Wait for API
        run: |
          for i in {1..30}; do
            curl -sf http://localhost:3000/health && break || sleep 1
          done

      - name: Start web
        run: pnpm --filter @task-manager/web preview --port 5173 &
        env:
          VITE_API_URL: http://localhost:3000

      - name: Wait for web
        run: |
          for i in {1..30}; do
            curl -sf http://localhost:5173 && break || sleep 1
          done

      - name: Run Playwright tests
        run: pnpm --filter @task-manager/e2e test
        env:
          PLAYWRIGHT_BASE_URL: http://localhost:5173

      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: apps/e2e/playwright-report/
          retention-days: 7
```

### 2. Disable `webServer` in Playwright config for CI

In CI, apps are started manually in the workflow. In `playwright.config.ts`:

```ts
webServer: process.env.CI ? undefined : [
  { command: 'pnpm --filter @task-manager/api dev', url: 'http://localhost:3000/health', reuseExistingServer: true },
  { command: 'pnpm --filter @task-manager/web dev', url: 'http://localhost:5173', reuseExistingServer: true },
],
```

### 3. GitHub Secrets to configure

In your GitHub repo → Settings → Secrets:

| Secret | Value |
|---|---|
| `TURBO_TOKEN` | From `turbo login` on vercel.com/turborepo |
| `TURBO_TEAM` | Your Turborepo team slug |
| `TEST_DATABASE_URL` | Only if unit tests need DB (Supertest integration tests) |

### 4. Cache Turborepo in CI

```yaml
- name: Restore Turborepo cache
  uses: actions/cache@v4
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-turbo-
```

Add this step before `pnpm turbo lint` etc.

### 5. Branch protection rules

Once CI is green, protect `main`:
- GitHub → Settings → Branches → Add rule for `main`
- Require status checks: `quality` and `e2e`
- Require branches to be up to date before merging

No one (including you) can merge a PR that breaks CI.

### 6. Verify CI passes

```bash
git add .github/
git commit -m "ci: add full pipeline with Playwright e2e"
git push
```

Check GitHub → Actions tab — watch the pipeline run.

## Test it

1. Make a deliberate typo in `apps/web/src/App.tsx`.
2. Push to a branch, open a PR.
3. Watch CI fail on `typecheck`.
4. Fix the typo, push again — CI passes.
5. Merge the PR.

## Mini-task
Add a `deploy` job that runs after `e2e` on pushes to `main` and triggers a Vercel redeploy via `POST https://api.vercel.com/v1/integrations/deploy/<deploy-hook>`. The deploy hook URL is a secret: `VERCEL_DEPLOY_HOOK`.

## Glossary
- **GitHub Actions** — Yaml-defined CI/CD pipelines running in isolated VMs triggered by git events.
- **`needs`** — dependency between jobs; e2e waits for quality to pass.
- **`services`** — Docker containers started alongside a job; used for Postgres in CI.
- **`actions/upload-artifact`** — saves files (Playwright reports) after job completion for later download.
- **Branch protection** — prevents merging PRs that fail required status checks.

## Resources
- [GitHub Actions docs](https://docs.github.com/en/actions)
- [Turborepo — GitHub Actions](https://turbo.build/repo/docs/ci/github-actions)
- [Playwright — CI configuration](https://playwright.dev/docs/ci-github-actions)

## Checklist
- [ ] `.github/workflows/ci.yml` with quality + e2e jobs
- [ ] Postgres service container in e2e job
- [ ] Playwright browsers installed in CI
- [ ] `webServer` disabled in CI (apps started manually)
- [ ] Playwright report uploaded as artifact on failure
- [ ] CI passes on GitHub Actions
- [ ] Branch protection requires CI on `main`
- [ ] Phase 4 complete — 20 lessons, monorepo deployed to production
