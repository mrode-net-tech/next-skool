# Day 38 — Test database setup

## Goal
Run integration & e2e tests against an **isolated test database** that's reset between tests, fast, and never touches your dev data.

## Estimated time
~1.5 hours.

## Prerequisites
Day 37; Docker is convenient but not required.

## Where to put your code
In `my-api`.

## Explanation

If integration tests share the dev DB you'll get:
- flaky tests when you've added rows manually,
- accidental deletion of your dev data,
- collisions when two test files run in parallel.

Three classic strategies to isolate:

| Strategy | How | Tradeoff |
|---|---|---|
| **Truncate between tests** | `DELETE FROM ...` in the right order before each test | Simple; slowest on big schemas |
| **Transaction rollback** | Wrap each test in a transaction, rollback at end | Very fast, but fights Prisma's connection model |
| **Separate schema per worker** | Each Vitest worker uses `?schema=test_<n>` | Fast, parallel-safe, more setup |

We'll do **Strategy 1 (truncate)** here — it's good enough until you have hundreds of integration tests, and it's what `setup.ts` already started.

Laravel analogy: this is `RefreshDatabase` (truncate + re-migrate) from `Illuminate\Foundation\Testing`.

## Step-by-step

### 1. Spin up a separate Postgres for tests

If you use Docker (`docker-compose.yml` from Phase 1):

```yaml name=docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: my_api
    ports: ["5432:5432"]

  db-test:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: my_api_test
    ports: ["5433:5432"]
    tmpfs: /var/lib/postgresql/data   # in-memory, very fast
```

```bash
docker compose up -d db-test
```

### 2. Add `DATABASE_URL_TEST` to env

You already added it on Day 33. `.env`:

```env
DATABASE_URL_TEST="postgresql://app:app@localhost:5433/my_api_test?schema=public"
```

### 3. The setup script

```ts name=src/test/setup.ts
import { execSync } from 'node:child_process';
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { prisma } from '../db/prisma';

beforeAll(() => {
  if (!process.env.DATABASE_URL_TEST) {
    throw new Error('DATABASE_URL_TEST is not set');
  }
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST },
  });
});

beforeEach(async () => {
  // Truncate in dependency-safe order
  await prisma.refreshToken.deleteMany();
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
});

afterEach(() => vi.clearAllMocks());
```

Faster alternative on large schemas — `TRUNCATE` with restart identity:

```ts
await prisma.$executeRawUnsafe(
  'TRUNCATE TABLE "RefreshToken", "Task", "User" RESTART IDENTITY CASCADE',
);
```

### 4. Fixtures / factories

Hand-rolling test data is repetitive. A tiny factory layer keeps tests focused on the case under test:

```ts name=src/test/factories.ts
import { prisma } from '../db/prisma';
import bcrypt from 'bcrypt';

export async function makeUser(overrides: Partial<{ email: string; password: string; name: string }> = {}) {
  const email    = overrides.email    ?? `u_${Date.now()}_${Math.random().toString(36).slice(2)}@x.io`;
  const password = overrides.password ?? 'pass1234';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, name: overrides.name ?? null, passwordHash },
  });
  return { user, password };
}

export async function makeTask(userId: string, overrides: Partial<{ title: string; done: boolean }> = {}) {
  return prisma.task.create({
    data: { title: overrides.title ?? 'Test task', done: overrides.done ?? false, userId },
  });
}
```

Use them:

```ts name=src/modules/tasks/infrastructure/http/list-tasks.integration.test.ts
import { describe, it, expect } from 'vitest';
import { createApp } from '../../../../app';
import { v1 } from '../../../../test/api';
import { makeUser, makeTask } from '../../../../test/factories';
import { signAccess } from '../../../../auth/jwt';

const app = createApp();

describe('GET /tasks (integration)', () => {
  it('returns only my tasks', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await makeTask(a.user.id, { title: 'mine' });
    await makeTask(b.user.id, { title: 'theirs' });

    const token = signAccess({ sub: a.user.id, email: a.user.email });
    const res = await v1(app).get('/tasks').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.map((t: any) => t.title)).toEqual(['mine']);
  });
});
```

### 5. Run integration tests serially (for now)

Parallel + truncate = race conditions. Easiest fix: run integration tests in a single thread.

```ts name=vitest.integration.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/*.integration.test.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
```

Update `package.json`:

```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

Unit tests stay fully parallel.

## Test it

```bash
docker compose up -d db-test
npm run test:integration
```

Re-run several times — every run should be green and take roughly the same amount of time. Confirm your **dev DB** has not been touched (`select count(*) from "User"` in the dev DB should be unchanged).

## Mini-task
Add a `seedAuth(app)` helper that registers + logs in a user and returns `{ user, token, request }` where `request` is a pre-authorized Supertest agent. Refactor at least two integration tests to use it.

## Glossary
- **Test database** — a separate Postgres just for the test suite.
- **Truncate** — empty all rows in a table; `RESTART IDENTITY CASCADE` resets sequences and respects FKs.
- **Factory / fixture** — helper that produces realistic test data with sensible defaults.
- **`tmpfs`** — Docker volume in RAM; orders-of-magnitude faster than disk for ephemeral test data.

## Resources
- [Prisma — Testing guide](https://www.prisma.io/docs/orm/prisma-client/testing)
- [Vitest — Pool options](https://vitest.dev/config/#pool)

## Checklist
- [ ] Separate Postgres on port 5433 (Docker `db-test` service)
- [ ] `DATABASE_URL_TEST` set; `setup.ts` rewires `DATABASE_URL`
- [ ] Migrations run automatically before the suite
- [ ] Tables truncated between tests
- [ ] At least one integration test uses a factory
- [ ] Dev DB untouched after a full integration run
