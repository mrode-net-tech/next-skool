# Day 39 — Coverage reports

## Goal
Enable Vitest's coverage reporter, set thresholds, and add a CI script that fails when coverage drops below them.

## Estimated time
~45 minutes.

## Prerequisites
Day 38.

## Where to put your code
In `my-api`.

## Explanation

**Coverage** is the percentage of your code executed by tests. Vitest uses [`v8`](https://nodejs.org/api/test.html#collecting-code-coverage) under the hood.

Four metrics are reported:
- **Lines** — percentage of executable lines hit
- **Statements** — percentage of statements hit
- **Branches** — percentage of `if/else/switch` paths hit
- **Functions** — percentage of declared functions called

Coverage is **necessary but not sufficient** — 100% coverage with weak assertions still misses bugs. Use it as a smoke alarm: a sudden drop means new code wasn't tested.

Laravel analogy: `phpunit --coverage-html` with `min-coverage` thresholds in `phpunit.xml`.

## Step-by-step

### 1. Install the v8 reporter

```bash
npm i -D @vitest/coverage-v8
```

### 2. Configure coverage

```ts name=vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/*.test.ts'],
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/test/**',
        'src/server.ts',         // bootstrap, not worth testing
        'src/db/prisma.ts',      // wraps the Prisma singleton
        'src/shared/openapi/**', // just docs
      ],
      thresholds: {
        lines:      80,
        statements: 80,
        functions:  80,
        branches:   70,
      },
    },
  },
});
```

### 3. Add scripts

```json name=package.json
{
  "scripts": {
    "test:coverage": "vitest run --coverage",
    "test:coverage:ci": "vitest run --coverage --reporter=verbose"
  }
}
```

### 4. Run it

```bash
npm run test:coverage
# ... lots of output ...
# % Coverage report from v8
# -------------------|---------|----------|---------|---------|-------------------
# File              | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
# -------------------|---------|----------|---------|---------|-------------------
# All files          |   83.1  |   72.4   |  86.7   |  83.1   |
# ...
```

Open `coverage/index.html` in a browser — every file is colored, hover a line to see how often it was hit.

### 5. Improve a weak file

Pick a file with ≤60% line coverage. Open it, find the red lines, and write a test for the case that hits them. Examples typically uncovered after Phase 2:

- `errorHandler` — non-`AppError` branch (throw a plain `Error` from a route).
- `auth/refresh.ts` — expired-token path.
- `tasks` — listing when there are zero tasks; updating a task that isn't yours.

```ts name=src/shared/http/errorHandler.test.ts
it('returns 500 for unknown errors', async () => {
  const app = express();
  app.get('/boom', () => { throw new Error('plain'); });
  app.use(errorHandler);
  const res = await request(app).get('/boom');
  expect(res.status).toBe(500);
  expect(res.body).toEqual({ error: 'internal_error' });
});
```

Re-run `npm run test:coverage` and watch the number climb.

### 6. .gitignore the report

```gitignore name=.gitignore
coverage/
```

### 7. Sanity-check the threshold

Temporarily raise `lines: 99` in `vitest.config.ts`. Run `npm run test:coverage`. The exit code should be non-zero and you should see a `ERROR: Coverage for lines (...) does not meet global threshold (99)` message. Restore the real threshold.

## Test it

```bash
npm run test:coverage
echo $?    # 0 if thresholds met, non-zero otherwise
```

CI integration — Day 22 of Phase 6 will wire this into GitHub Actions, but the contract is ready: a single command that fails the build when coverage drops.

## Mini-task
Add a `c8 ignore next` comment to one truly-untestable line (e.g. a bootstrap callback) and document in a comment why it's excluded. Make the threshold pass.

## Glossary
- **Line coverage** — % of executable lines run by tests.
- **Branch coverage** — % of `if/else/switch` paths taken.
- **`lcov`** — text format consumed by Codecov, Coveralls, SonarQube.
- **Threshold** — minimum acceptable coverage; build fails below it.

## Resources
- [Vitest — Coverage](https://vitest.dev/guide/coverage.html)
- [Codecov vs Coveralls comparison](https://about.codecov.io/)

## Checklist
- [ ] `@vitest/coverage-v8` installed
- [ ] `npm run test:coverage` produces console table + `coverage/index.html`
- [ ] Thresholds enforced (≥80 lines/statements/functions, ≥70 branches)
- [ ] At least one weak file improved
- [ ] `coverage/` in `.gitignore`
