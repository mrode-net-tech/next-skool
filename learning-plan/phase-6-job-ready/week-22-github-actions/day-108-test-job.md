# Day 108 — Test job

## Goal
Add a CI job that runs the Vitest test suite (including any tests that need a real Postgres + pgvector). After this day, failing tests block merges to `main` and you understand how to run service containers in GitHub Actions.

## Estimated time
~2 hours

## Prerequisites
Day 107 (lint + typecheck job). Vitest tests written in `ai-folio` (at minimum the embedding and lead-scoring logic from Days 89 and 95).

## Where to put your code
In `ai-folio`, inside `.github/workflows/`.

## Explanation

**Service containers** in GitHub Actions are Docker containers that run alongside the job and are reachable by the steps via `localhost:<port>`. You can spin up a Postgres container (with pgvector) and a Redis container for the duration of the test run — no external database required, no test pollution across runs. Each run gets a fresh database. In Laravel terms this is the same as running PHPUnit with `RefreshDatabase` against a dedicated test database.

**Why not mock the database in tests?** Mocks verify that your code calls a function with certain arguments — they do not verify that the SQL query is correct, that Prisma's schema matches the database, or that the pgvector index returns the right results. Integration tests against a real database catch a class of bugs that mocks structurally cannot. (You saw this reasoning in Day 34 when you wrote Prisma integration tests.)

**Test isolation** in CI: each test run applies migrations to a fresh database, runs the suite, and the service container is destroyed with the job. No shared state between runs.

## Step-by-step

### 1. Confirm the test script

```json name=package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### 2. Add a test database URL for CI

Tests need a separate `DATABASE_URL` that points to the CI Postgres service. Add to `vitest.config.ts`:

```ts name=vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    globalSetup: ['./src/test/global-setup.ts'],
  },
});
```

```ts name=src/test/global-setup.ts
import { execSync } from 'child_process';

export async function setup() {
  // Run Prisma migrations against the test database before all tests
  execSync('pnpm prisma migrate deploy', {
    env: { ...process.env },
    stdio: 'inherit',
  });
}
```

### 3. Add the test job with service containers

```yaml name=.github/workflows/ci.yml
  test:
    name: Vitest
    runs-on: ubuntu-latest

    services:
      postgres:
        image: ankane/pgvector:v0.7.4
        env:
          POSTGRES_USER: folio
          POSTGRES_PASSWORD: folio_secret
          POSTGRES_DB: folio_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U folio -d folio_test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgresql://folio:folio_secret@localhost:5432/folio_test
      REDIS_URL: redis://localhost:6379
      NEXTAUTH_SECRET: ci-test-secret
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run Prisma migrations
        run: pnpm prisma migrate deploy

      - name: Run tests
        run: pnpm test
```

Service containers are reachable on `localhost` at the mapped port. The `options` field passes Docker flags for health checks — the job waits for services to be healthy before executing steps.

### 4. Handle tests that call Claude API

Tests that invoke Claude directly (e.g., lead scoring with `generateObject`) need a real API key. Store it as a GitHub secret:

**Settings** → **Secrets and variables** → **Actions** → **New repository secret** → name: `ANTHROPIC_API_KEY`, value: your key.

The `env:` block in the job exposes it to all steps. Tests that do not need it ignore it; tests that do will find it in `process.env.ANTHROPIC_API_KEY`.

For tests that would be slow or expensive to run in CI against the real API, use `vi.mock`:

```ts name=src/test/mocks/ai.ts
import { vi } from 'vitest';

export const mockGenerateObject = vi.fn().mockResolvedValue({
  object: { score: 4, intent: 'job_offer', summary: 'test summary' },
});

vi.mock('ai', async (importOriginal) => {
  const original = await importOriginal<typeof import('ai')>();
  return { ...original, generateObject: mockGenerateObject };
});
```

Import this mock in tests that target the lead-scoring logic without hitting the real API.

### 5. Verify the test job output

In the Actions tab, click the `Vitest` job. You should see:

```
✓ src/lib/embeddings.test.ts (3 tests)
✓ src/app/api/lead-score/lead-score.test.ts (5 tests)
✓ src/lib/ai.test.ts (2 tests)

Test Files  3 passed (3)
Tests       10 passed (10)
```

If any test fails, the step exits non-zero and the job is marked failed.

## Test it

Push a branch with a deliberately broken test:

```ts
it('intentionally fails', () => {
  expect(1).toBe(2);
});
```

Open a PR. The `Vitest` job should fail and block the merge. Revert, push again, confirm green.

## Mini-task
Add a `coverage` step after `pnpm test`:

```yaml
      - name: Run tests with coverage
        run: pnpm vitest run --coverage

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
```

Download the artifact from the Actions UI and open `coverage/index.html` locally to see which files have low coverage.

## Glossary
- **Service container** — a Docker container run alongside a GitHub Actions job; reachable at `localhost:<port>` from job steps.
- **`options`** — Docker flags passed to `docker run` for the service container; used here for health checks.
- **`actions/upload-artifact`** — Action that saves files from the runner to GitHub's artifact storage; downloadable from the Actions UI.
- **Global setup** — Vitest `globalSetup` file; runs once before all tests in the suite, not once per test file.
- **`ANTHROPIC_API_KEY`** — GitHub Actions secret; exposed to steps via the `env:` block.

## Resources
- [GitHub Actions — service containers](https://docs.github.com/en/actions/using-containerized-services/about-service-containers)
- [Vitest — global setup](https://vitest.dev/config/#globalsetup)
- [GitHub Actions — secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)

## Checklist
- [ ] `pnpm test` runs locally with zero failures
- [ ] Postgres (pgvector) and Redis service containers defined in the `test` job
- [ ] `DATABASE_URL` and `REDIS_URL` point to `localhost` service container ports
- [ ] `ANTHROPIC_API_KEY` stored as a GitHub Actions secret
- [ ] Prisma migrations run inside the CI job before tests
- [ ] Test failures block PRs to `main`
