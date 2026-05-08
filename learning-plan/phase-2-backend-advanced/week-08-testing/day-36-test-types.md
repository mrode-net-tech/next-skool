# Day 36 — Unit vs integration vs e2e

## Goal
Understand the three test layers, when to use each, and reorganize `my-api`'s `*.test.ts` files into `unit/`, `integration/`, `e2e/` folders so you can run them selectively.

## Estimated time
~1 hour.

## Prerequisites
Phase 2 Weeks 5–7 complete; you already have a mix of tests written.

## Where to put your code
In `my-api`.

## Explanation

The "test pyramid":

```
         ▲
       /e2e\          few   — slow, real browser/HTTP, end-to-end flow
      /------\
     /  int   \       some  — real DB, real Express, real Prisma
    /----------\
   /   unit     \     many  — pure functions / classes, no I/O
  /--------------\
```

| Layer | What it tests | Speed | Examples in `my-api` |
|---|---|---|---|
| **Unit** | One class or pure function in isolation | <1ms each | `Email.test.ts`, `RegisterUser.test.ts` (with fake repo) |
| **Integration** | Several modules together with real DB | tens of ms | `tasks.test.ts` (Supertest + real Prisma) |
| **E2E** | Full system: spawn server, call HTTP, hit real DB | hundreds of ms | one happy-path login → create task → list |

Rule of thumb: write a **unit test** unless something forces you up the pyramid. Each layer gives more confidence but is slower and more brittle.

Laravel analogy:
- Unit ≈ tests in `tests/Unit/` that don't extend `TestCase`.
- Integration ≈ tests with `RefreshDatabase`.
- E2E ≈ Dusk browser tests.

## Step-by-step

### 1. Tag/group folders

```
src/
  modules/
    users/
      domain/
        Email.test.ts                ← unit
      application/
        RegisterUser.test.ts         ← unit (uses InMemoryUserRepository)
      infrastructure/http/
        auth.integration.test.ts     ← integration (Supertest + Prisma)
  e2e/
    login-create-task.e2e.test.ts    ← e2e
```

Convention: file extension communicates the layer.

### 2. Vitest config — separate test scopes

```ts name=vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/*.test.ts'],
    pool: 'forks', // safer with Prisma
  },
});
```

Add scripts:

```json name=package.json
{
  "scripts": {
    "test":             "vitest run",
    "test:watch":       "vitest",
    "test:unit":        "vitest run --exclude '**/*.{integration,e2e}.test.ts'",
    "test:integration": "vitest run '**/*.integration.test.ts'",
    "test:e2e":         "vitest run '**/*.e2e.test.ts'"
  }
}
```

### 3. Example unit test (no DB)

```ts name=src/modules/users/application/RegisterUser.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { RegisterUser } from './RegisterUser';
import type { UserRepository } from '../domain/UserRepository';
import type { Hasher } from '../../../shared/Hasher';

class InMemoryUserRepository implements UserRepository {
  private store = new Map<string, any>();
  async findByEmail(email: string) { return this.store.get(email) ?? null; }
  async save(u: any) { this.store.set(u.email, u); return u; }
}

const fakeHasher: Hasher = {
  async hash(p)      { return `hashed:${p}`; },
  async compare(p,h) { return h === `hashed:${p}`; },
};

describe('RegisterUser (unit)', () => {
  let repo: InMemoryUserRepository;
  let useCase: RegisterUser;

  beforeEach(() => {
    repo = new InMemoryUserRepository();
    useCase = new RegisterUser(repo, fakeHasher);
  });

  it('creates a new user', async () => {
    const u = await useCase.execute({ email: 'a@b.c', password: 'secret123' });
    expect(u.email).toBe('a@b.c');
  });

  it('rejects duplicate emails', async () => {
    await useCase.execute({ email: 'a@b.c', password: 'secret123' });
    await expect(
      useCase.execute({ email: 'a@b.c', password: 'secret123' }),
    ).rejects.toThrow(/email/i);
  });
});
```

No Prisma. No HTTP. Runs in milliseconds.

### 4. Example integration test (real DB)

```ts name=src/modules/tasks/infrastructure/http/tasks.integration.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../../../../app';
import { v1 } from '../../../../test/api';

const app = createApp();
let token: string;

beforeAll(async () => {
  await v1(app).post('/auth/register').send({ email: 't@x.io', password: 'pass1234' });
  const res = await v1(app).post('/auth/login').send({ email: 't@x.io', password: 'pass1234' });
  token = res.body.accessToken;
});

describe('Tasks API (integration)', () => {
  it('creates and lists a task', async () => {
    const create = await v1(app).post('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Buy milk' });
    expect(create.status).toBe(201);

    const list = await v1(app).get('/tasks').set('Authorization', `Bearer ${token}`);
    expect(list.body).toHaveLength(1);
  });
});
```

### 5. Example e2e test (full flow)

```ts name=src/e2e/login-create-task.e2e.test.ts
import { describe, it, expect } from 'vitest';
import { createApp } from '../app';
import { v1 } from '../test/api';

describe('E2E — register → login → create → list', () => {
  it('runs the whole flow', async () => {
    const app = createApp();
    const email = `e2e_${Date.now()}@x.io`;

    await v1(app).post('/auth/register').send({ email, password: 'pass1234' });
    const login = await v1(app).post('/auth/login').send({ email, password: 'pass1234' });
    expect(login.status).toBe(200);

    const token = login.body.accessToken;
    const create = await v1(app).post('/tasks')
      .set('Authorization', `Bearer ${token}`).send({ title: 'Hello' });
    expect(create.status).toBe(201);

    const list = await v1(app).get('/tasks').set('Authorization', `Bearer ${token}`);
    expect(list.body.map((t: any) => t.title)).toContain('Hello');
  });
});
```

## Test it

```bash
npm run test:unit          # fast, frequent
npm run test:integration   # before commit
npm run test:e2e           # before push / in CI
npm test                   # everything
```

Time the runs; unit tests should finish in <2s on a small project.

## Mini-task
Pick three of your existing tests and re-classify them: rename to `.integration.test.ts` if they use Prisma, leave as `.test.ts` if they're pure. Verify `npm run test:unit` no longer touches the database.

## Glossary
- **Test pyramid** — many cheap unit tests, some integration, few e2e.
- **In-memory implementation** (`InMemoryUserRepository`) — a fake of a port used in unit tests.
- **Integration test** — exercises real collaborators (DB, HTTP) but stays inside the process.
- **E2E test** — exercises the system as a black box from outside.

## Resources
- [Martin Fowler — Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- [Vitest CLI](https://vitest.dev/guide/cli.html)

## Checklist
- [ ] Tests renamed by layer (`*.test.ts` / `*.integration.test.ts` / `*.e2e.test.ts`)
- [ ] `npm run test:unit` passes without DB
- [ ] `npm run test:integration` passes with DB
- [ ] `npm run test:e2e` runs the happy path
