# Day 40 — Refactor tests for speed

## Goal
Make the suite faster, more parallel, and more deterministic. End Phase 2 with a green, fast `npm test`.

## Estimated time
~1.5 hours.

## Prerequisites
Days 36–39.

## Where to put your code
In `my-api`.

## Explanation

A slow test suite is a suite you stop running. Three knobs to turn:

1. **Parallelism** — unit tests in parallel, integration tests serialized (we did this Day 38).
2. **Hot paths** — bcrypt with `rounds=10` is ~80ms; tests that register 5 users spend half a second on hashing. Use a smaller `rounds` (or fake hasher) in tests.
3. **Determinism** — kill `Date.now()` randomness with `vi.useFakeTimers()`. Kill UUID randomness with seeded ids. Kill ordering issues (`expect(arr).toEqual([a,b])` vs `arr` order).

Laravel analogy: this is the cumulative effect of `RefreshDatabase` over `RefreshDatabaseFully`, `bcrypt rounds=4` in test config, and `Carbon::setTestNow(...)`.

## Step-by-step

### 1. Speed up bcrypt in tests

The hasher port already exists (Day 28/29). In tests, use either:

**a) Real bcrypt with low rounds:**

```ts name=src/test/setup.ts
process.env.BCRYPT_ROUNDS = '4'; // tests only
```

```ts name=src/shared/BcryptHasher.ts
import bcrypt from 'bcrypt';
const ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 10);

export class BcryptHasher implements Hasher {
  async hash(p: string)            { return bcrypt.hash(p, ROUNDS); }
  async compare(p: string, h: string) { return bcrypt.compare(p, h); }
}
```

**b) Or a fake hasher in unit tests** — already done.

Measure before/after:

```bash
time npm run test:unit
```

### 2. Freeze time

```ts name=src/auth/refresh.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('refresh token expiry', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z')); });
  afterEach(()  => { vi.useRealTimers(); });

  it('rejects an expired token', async () => {
    // create token at "now"
    const t = await createRefreshToken({ userId: 'u1' });
    // jump 31 days
    vi.setSystemTime(new Date('2026-02-01T00:00:00Z'));
    await expect(rotateRefreshToken(t.token)).rejects.toThrow();
  });
});
```

### 3. Deterministic ids

Wrap `cuid` / `crypto.randomUUID` behind a port (you can defer this to Phase 3 if it gets noisy):

```ts name=src/shared/IdGenerator.ts
export interface IdGenerator { next(): string; }

export class CryptoIdGenerator implements IdGenerator {
  next() { return crypto.randomUUID(); }
}

export class SequentialIdGenerator implements IdGenerator {
  private n = 0;
  next() { return `id_${++this.n}`; }
}
```

In unit tests, swap in the sequential one.

### 4. Order-independent assertions

```ts
// fragile:
expect(tasks.map(t => t.title)).toEqual(['A', 'B']);

// robust:
expect(tasks.map(t => t.title).sort()).toEqual(['A', 'B'].sort());
// or:
expect(new Set(tasks.map(t => t.title))).toEqual(new Set(['A', 'B']));
```

Or assert by `expect.arrayContaining(...)`.

### 5. Avoid one-test-per-side-effect

Bad — three tests that each register a user just to test list ordering:

```ts
it('lists tasks of user A', async () => { /* register A, create task, list */ });
it('lists tasks of user B', async () => { /* register B, create task, list */ });
it('does not leak across users', async () => { /* register both, ... */ });
```

Better — one test that asserts everything from a single arrangement:

```ts
it('lists only the requesting user\'s tasks', async () => {
  const a = await makeUser();
  const b = await makeUser();
  await makeTask(a.user.id, { title: 'mine' });
  await makeTask(b.user.id, { title: 'theirs' });

  const aRes = await v1(app).get('/tasks').set('Authorization', `Bearer ${signAccess({ sub: a.user.id, email: a.user.email })}`);
  const bRes = await v1(app).get('/tasks').set('Authorization', `Bearer ${signAccess({ sub: b.user.id, email: b.user.email })}`);

  expect(aRes.body.map((t:any)=>t.title)).toEqual(['mine']);
  expect(bRes.body.map((t:any)=>t.title)).toEqual(['theirs']);
});
```

### 6. Profile the suite

```bash
npx vitest run --reporter=verbose
```

Look for tests that take >100ms. Common culprits and fixes:

| Symptom | Fix |
|---|---|
| Slow integration suite | Lower bcrypt rounds; use `tmpfs` for `db-test`; truncate via raw SQL |
| Slow unit test | It's secretly an integration test — refactor to use a fake |
| Random failures | Replace `Date.now()` / random with stubs |
| `port already in use` | Don't `app.listen()` in tests; use Supertest's in-process handler |

### 7. Final green run

```bash
npm test
```

All three layers green, in seconds.

## Test it

Compare timing before/after a refactor:

```bash
time npm run test:unit
time npm run test:integration
time npm test
```

## Mini-task
Pick the slowest test in your suite (verbose reporter shows times). Make it 2× faster without losing coverage. Document what you changed in a comment.

## Glossary
- **Determinism** — same inputs → same result, every time. The opposite of flaky.
- **Fake clock** — `vi.useFakeTimers()` makes `Date.now()` controllable.
- **Test smell** — a property of a test that suggests refactoring (slow, duplicated arrangement, asserts implementation, etc.).

## Resources
- [Vitest — Fake timers](https://vitest.dev/api/vi.html#vi-usefaketimers)
- [Kent C. Dodds — Common Testing Mistakes](https://kentcdodds.com/blog/common-testing-mistakes)

## Checklist
- [ ] `BCRYPT_ROUNDS=4` in test env (or fake hasher in unit tests)
- [ ] At least one test uses `vi.useFakeTimers()`
- [ ] Order-independent assertions where appropriate
- [ ] Verbose run reviewed; no test >250ms without justification
- [ ] `npm test` is green and fast

---

## End of Phase 2 ✅

`my-api` is now a real backend project:

- Express + TypeScript + Prisma
- JWT auth with refresh tokens
- DDD-flavored modules with use cases, ports, DI
- Custom errors + global handler
- Pino structured logging
- Zod-validated env
- OpenAPI docs at `/docs`
- API versioning under `/api/v1`
- Three test layers, mocking, isolated test DB, coverage thresholds

You're ready for **Phase 3: React** — building `my-web`, the frontend that will consume this API.
