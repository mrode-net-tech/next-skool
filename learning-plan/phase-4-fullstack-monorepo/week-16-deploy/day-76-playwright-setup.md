# Day 76 — Playwright setup

## Goal
Install Playwright in the monorepo, configure it as a separate workspace package, write a first sanity test, and understand how e2e tests differ from Vitest + RTL tests.

## Estimated time
~1.5 hours

## Prerequisites
Day 75 — full auth flow working. Both apps running via `pnpm turbo dev`.

## Where to put your code
New package: `task-manager/apps/e2e/`.

## Explanation

**End-to-end (e2e) tests** drive a real browser against a running application. They're the highest confidence test level: they test the full stack from UI click through API through database and back. The cost: they're slow (seconds per test), flaky (timing-dependent), and require a running server.

**Playwright** is Microsoft's e2e framework. It's faster and more reliable than Cypress, supports multiple browser engines (Chromium, Firefox, WebKit), and has first-class TypeScript support. Its key features: auto-waiting (no manual `sleep`), trace recording for debugging failures, and a code generator (`npx playwright codegen`) that records browser actions as test code.

The **test pyramid** principle: many unit tests (fast, cheap), fewer integration tests, fewest e2e tests (slow, expensive). E2e tests should cover critical paths — login, create task, see it in the list — not every edge case.

Playwright runs against a live running app. In CI (Day 80), you start the app with `pnpm turbo start` before running Playwright.

## Step-by-step

### 1. Create `apps/e2e`

```bash
mkdir apps/e2e && cd apps/e2e
```

```json name=apps/e2e/package.json
{
  "name": "@task-manager/e2e",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "codegen": "playwright codegen http://localhost:5173"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "@task-manager/types": "workspace:*"
  }
}
```

```bash
# From task-manager root
pnpm install
pnpm --filter @task-manager/e2e exec playwright install chromium
```

### 2. `playwright.config.ts`

```ts name=apps/e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // E2e tests share DB state — run sequentially
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry', // Record trace on flaky tests
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start apps before tests
  webServer: [
    {
      command: 'pnpm --filter @task-manager/api dev',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'pnpm --filter @task-manager/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
```

`webServer` tells Playwright to start the apps before running tests and wait until they're ready. `reuseExistingServer: !CI` means locally it reuses your already-running dev servers; in CI it starts them fresh.

Add `GET /health` to the API:
```ts name=apps/api/src/app.ts
app.get('/health', (_req, res) => res.json({ ok: true }));
```

### 3. Playwright Page Object Model (POM)

POM wraps page interactions in reusable classes — like a helper that knows "how to log in". This prevents test duplication and makes tests readable.

```ts name=apps/e2e/pages/LoginPage.ts
import type { Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.getByPlaceholder('you@example.com').fill(email);
    await this.page.getByPlaceholder('Password').fill(password);
    await this.page.getByRole('button', { name: /sign in/i }).click();
  }

  async expectError(message: string) {
    await this.page.getByRole('alert').filter({ hasText: message }).waitFor();
  }
}
```

```ts name=apps/e2e/pages/TasksPage.ts
import type { Page } from '@playwright/test';

export class TasksPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/tasks');
  }

  async addTask(title: string) {
    await this.page.getByRole('button', { name: /new task/i }).click();
    await this.page.getByLabel(/title/i).fill(title);
    await this.page.getByRole('button', { name: /create task/i }).click();
  }

  async expectTaskVisible(title: string) {
    await this.page.getByText(title).waitFor();
  }

  async expectTaskCount(count: number) {
    await this.page.getByRole('listitem').filter({ hasNot: this.page.locator(':empty') }).waitFor();
    const items = await this.page.getByRole('listitem').count();
    return items === count;
  }
}
```

### 4. First e2e test — home page sanity

```ts name=apps/e2e/tests/sanity.spec.ts
import { test, expect } from '@playwright/test';

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/my-web/i);
  await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
});

test('unauthenticated user is redirected from /tasks to /login', async ({ page }) => {
  await page.goto('/tasks');
  await expect(page).toHaveURL(/\/login/);
});
```

### 5. Run tests

```bash
# Make sure apps are running first (locally)
pnpm --filter @task-manager/e2e test
```

Expected:
```
✓ home page loads (1.2s)
✓ unauthenticated user is redirected from /tasks to /login (0.8s)
```

## Test it

```bash
# Run with UI mode for interactive debugging
pnpm --filter @task-manager/e2e test:ui
```

The Playwright UI shows test results, screenshots, and traces. Click a failed test to see exactly which step failed and a screenshot.

## Mini-task
Use `npx playwright codegen http://localhost:5173` to record a "login and see tasks" flow. Copy the generated test into `tests/auth.spec.ts` and clean it up — replace hardcoded selectors with `getByRole`/`getByLabel` where possible.

## Glossary
- **e2e test** — drives a real browser against a live app; highest confidence, slowest.
- **`webServer`** — Playwright config option to start the app before tests.
- **Page Object Model (POM)** — design pattern wrapping page interactions in reusable classes.
- **`trace`** — Playwright recording of every step + network + screenshots; invaluable for debugging CI failures.
- **`reuseExistingServer`** — don't restart the app if it's already running (useful locally).

## Resources
- [Playwright docs](https://playwright.dev/docs/intro)
- [Playwright — Page Object Model](https://playwright.dev/docs/pom)
- [Playwright — codegen](https://playwright.dev/docs/codegen)

## Checklist
- [ ] `apps/e2e` package created with `@playwright/test`
- [ ] `playwright.config.ts` with `webServer` for both apps
- [ ] `GET /health` endpoint added to API
- [ ] `LoginPage` and `TasksPage` POM classes
- [ ] Sanity tests pass: home loads + unauth redirect
- [ ] `--ui` mode works for interactive inspection
