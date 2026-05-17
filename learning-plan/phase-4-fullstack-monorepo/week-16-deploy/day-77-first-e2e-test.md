# Day 77 — First e2e test: login → create task → verify

## Goal
Write a complete e2e test that exercises the full user flow: register, login, create a task, verify it appears, delete it. Set up database seeding/cleanup for reliable test runs.

## Estimated time
~2 hours

## Prerequisites
Day 76 — Playwright configured with sanity tests passing.

## Where to put your code
In `task-manager/apps/e2e/`.

## Explanation

E2e tests that touch the database need **isolation**: each test starts with known state. Two strategies:

1. **Seed before test, clean after test** — run SQL to insert test data, then delete it. Reliable but slow.
2. **Unique data per test** — prefix all created data with a test run ID so tests don't interfere even in parallel. Fast but leaves orphaned data.

For this project, use Strategy 1 for the auth test (register + login) since you need a real user in the DB. Use Strategy 2 for tasks (unique titles with `Date.now()`) to avoid cleanup complexity.

**Flakiness** is the enemy of e2e tests. Playwright's auto-waiting handles most timing issues, but you must never assert on timing: always `await expect(element).toBeVisible()`, never `sleep(500)`. If you find yourself reaching for a sleep, Playwright has a better API for what you're trying to do.

## Step-by-step

### 1. Test fixtures for auth

Playwright **fixtures** are setup/teardown utilities injected into tests. Create a fixture that registers + logs in a test user:

```ts name=apps/e2e/fixtures/auth.fixture.ts
import { test as base, expect } from '@playwright/test';
import type { User } from '@task-manager/types';

const API = 'http://localhost:3000';

export interface AuthFixtures {
  authenticatedPage: { user: User; accessToken: string };
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    const email = `test+${Date.now()}@example.com`;
    const password = 'Password123';

    // Register
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const { user } = await res.json() as { user: User };

    // Login via the UI
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirect to /tasks
    await page.waitForURL('/tasks');

    await use({ user, accessToken: '' }); // Cookie handles auth

    // Cleanup: delete the test user via API
    // (Requires a dev-only DELETE /dev/users endpoint, or direct DB access)
  },
});

export { expect };
```

### 2. Add a dev-only cleanup endpoint to the API

```ts name=apps/api/src/dev.router.ts
import { Router } from 'express';
import { prisma } from './db/prisma';
import { config } from './shared/config';

export const devRouter = Router();

// Only available in test/development
if (config.NODE_ENV !== 'production') {
  devRouter.delete('/users/:email', async (req, res) => {
    await prisma.user.deleteMany({ where: { email: req.params['email'] } });
    res.json({ ok: true });
  });

  devRouter.delete('/tasks/all', async (_req, res) => {
    await prisma.task.deleteMany();
    res.json({ ok: true });
  });
}
```

Wire in `app.ts`:
```ts
import { devRouter } from './dev.router';
if (config.NODE_ENV !== 'production') {
  app.use('/dev', devRouter);
}
```

Update the fixture cleanup:
```ts
// After use():
await fetch(`${API}/dev/users/${email}`, { method: 'DELETE' });
```

### 3. Full e2e test

```ts name=apps/e2e/tests/tasks.spec.ts
import { test, expect } from '../fixtures/auth.fixture';
import { LoginPage } from '../pages/LoginPage';
import { TasksPage } from '../pages/TasksPage';

test.describe('Task management', () => {
  test('authenticated user can create and see a task', async ({ page, authenticatedPage: _ }) => {
    const tasksPage = new TasksPage(page);
    const uniqueTitle = `E2E Task ${Date.now()}`;

    await tasksPage.goto();
    await expect(page.getByRole('heading', { name: /tasks/i })).toBeVisible();

    await tasksPage.addTask(uniqueTitle);

    // Wait for the task to appear (Dialog closes + mutation + refetch)
    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 5000 });
  });

  test('can toggle a task done', async ({ page, authenticatedPage: _ }) => {
    const tasksPage = new TasksPage(page);
    const title = `Toggle Task ${Date.now()}`;

    await tasksPage.goto();
    await tasksPage.addTask(title);
    await expect(page.getByText(title)).toBeVisible();

    // Find the checkbox next to this task and click it
    const taskRow = page.locator('li').filter({ hasText: title });
    const checkbox = taskRow.getByRole('checkbox');

    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Row should now be dimmed
    await expect(taskRow).toHaveCSS('opacity', '0.5');
  });

  test('can delete a task', async ({ page, authenticatedPage: _ }) => {
    const tasksPage = new TasksPage(page);
    const title = `Delete Task ${Date.now()}`;

    await tasksPage.goto();
    await tasksPage.addTask(title);
    await expect(page.getByText(title)).toBeVisible();

    const taskRow = page.locator('li').filter({ hasText: title });
    await taskRow.getByRole('button', { name: /✕/ }).click();

    await expect(page.getByText(title)).not.toBeVisible({ timeout: 3000 });
  });
});
```

```ts name=apps/e2e/tests/auth.spec.ts
import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test('login with wrong password shows error', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('nonexistent@example.com', 'WrongPass1');
  await loginPage.expectError(/invalid credentials/i);
});

test('login with valid credentials redirects to tasks', async ({ page }) => {
  const email = `login+${Date.now()}@example.com`;
  const password = 'Password123';

  // Register via API
  await fetch('http://localhost:3000/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(email, password);

  await page.waitForURL('/tasks');
  await expect(page.getByRole('heading', { name: /tasks/i })).toBeVisible();

  // Cleanup
  await fetch(`http://localhost:3000/dev/users/${email}`, { method: 'DELETE' });
});
```

### 4. Handling flakiness

Common sources and fixes:

| Symptom | Cause | Fix |
|---|---|---|
| Test passes locally, fails in CI | Race condition | Add explicit `waitFor` or `expect(...).toBeVisible()` |
| Element not found | Wrong selector | Use `page.getByRole` / `getByLabel` — more stable than CSS |
| Timeout on mutation | API too slow | Increase `timeout` on specific assertions |
| Tests interfere | Shared state | Use unique data per test (`Date.now()`) |

```bash
# Run with trace on all tests (debugging)
pnpm --filter @task-manager/e2e test --trace on
npx playwright show-report
```

### 5. Run the full suite

```bash
pnpm --filter @task-manager/e2e test
```

Expected:
```
✓ login with wrong password shows error
✓ login with valid credentials redirects to tasks
✓ authenticated user can create and see a task
✓ can toggle a task done
✓ can delete a task

5 passed (18s)
```

## Test it

```bash
# Run specific test with verbose output
pnpm --filter @task-manager/e2e test --grep "create and see"
```

## Mini-task
Add a test for the pagination "Load more" button: seed 12 tasks via the API, load the tasks page, verify only 10 are shown, click "Load more", verify all 12 appear.

## Glossary
- **Fixture** — Playwright setup/teardown utility injected into test functions.
- **Auto-waiting** — Playwright retries assertions until they pass or timeout; never need `sleep`.
- **`getByRole`** — ARIA role selector; most stable — doesn't break on CSS or text changes.
- **Trace** — Playwright recording of every action + screenshot; open with `show-report`.

## Resources
- [Playwright — Fixtures](https://playwright.dev/docs/test-fixtures)
- [Playwright — Auto-waiting](https://playwright.dev/docs/actionability)
- [Playwright — Best practices](https://playwright.dev/docs/best-practices)

## Checklist
- [ ] Auth fixture registers + logs in test user, cleans up after
- [ ] Dev-only `DELETE /dev/users/:email` endpoint in API
- [ ] Create task e2e test passes
- [ ] Toggle task done e2e test passes
- [ ] Delete task e2e test passes
- [ ] Auth error e2e test passes
- [ ] No hardcoded sleeps — only Playwright auto-waiting
