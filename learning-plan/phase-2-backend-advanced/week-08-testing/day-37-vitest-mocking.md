# Day 37 — Mocking with Vitest

## Goal
Learn `vi.fn()`, `vi.spyOn()`, `vi.mock()`. Replace external collaborators (mailer, third-party HTTP) with mocks so tests stay fast and deterministic.

## Estimated time
~1.5 hours.

## Prerequisites
Day 36.

## Where to put your code
In `my-api`.

## Explanation

A **mock** is a stand-in object recording calls and returning canned answers. Vitest provides three primitives:

| API | When to use |
|---|---|
| `vi.fn()` | Build a fresh mock function from scratch. |
| `vi.spyOn(obj, 'method')` | Wrap an existing method to observe (and optionally replace) it. |
| `vi.mock('module')` | Replace an **entire module** with mocks (auto-hoisted to the top of the file). |

Two principles you'll repeat for the rest of your career:

1. **Mock at the boundary.** Mock things you don't own (HTTP, mailer, S3). Don't mock your own internal classes — refactor and use the InMemory pattern instead.
2. **Verify behavior, not implementation.** Assert *that* the mailer was called with the right args, not the order of internal helpers.

Laravel analogy: this is `Mail::fake()` / `Http::fake()` / `Bus::fake()` from the `Illuminate\Support\Facades` testing helpers.

## Step-by-step

### 1. `vi.fn()` — basic mock

```ts name=src/shared/mocks-tour.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('vi.fn()', () => {
  it('records calls and returns canned values', () => {
    const greet = vi.fn((name: string) => `Hello ${name}`);
    expect(greet('Alice')).toBe('Hello Alice');
    expect(greet).toHaveBeenCalledWith('Alice');
    expect(greet).toHaveBeenCalledTimes(1);
  });

  it('mockReturnValue / mockResolvedValue', () => {
    const fn = vi.fn().mockReturnValue(42);
    expect(fn()).toBe(42);

    const asyncFn = vi.fn().mockResolvedValue('ok');
    return expect(asyncFn()).resolves.toBe('ok');
  });
});
```

### 2. Add a real boundary to mock — a Mailer port

```ts name=src/shared/Mailer.ts
export interface Mailer {
  sendWelcome(to: string, name: string | null): Promise<void>;
}
```

```ts name=src/shared/SmtpMailer.ts
import { injectable } from 'tsyringe';
import { Mailer } from './Mailer';
import { logger } from './logger';

@injectable()
export class SmtpMailer implements Mailer {
  async sendWelcome(to: string, name: string | null): Promise<void> {
    // pretend this calls SendGrid/SES/Postmark
    logger.info({ to, name }, 'sent welcome email');
  }
}
```

Register in DI and inject into `RegisterUser`:

```ts name=src/shared/tokens.ts
export const TOKENS = {
  // ...
  Mailer: 'Mailer',
} as const;
```

```ts name=src/shared/container.ts
import { container } from 'tsyringe';
import { TOKENS } from './tokens';
import { SmtpMailer } from './SmtpMailer';

export function configureContainer() {
  // ... existing
  container.register(TOKENS.Mailer, { useClass: SmtpMailer });
}
```

```ts name=src/modules/users/application/RegisterUser.ts
@injectable()
export class RegisterUser {
  constructor(
    @inject(TOKENS.UserRepository) private repo: UserRepository,
    @inject(TOKENS.Hasher)         private hasher: Hasher,
    @inject(TOKENS.Mailer)         private mailer: Mailer,
  ) {}

  async execute(input: RegisterInput): Promise<UserDTO> {
    // ... existing
    const saved = await this.repo.save(user);
    await this.mailer.sendWelcome(saved.email, saved.name); // ← new
    return toDTO(saved);
  }
}
```

### 3. Unit-test with a `vi.fn()` mailer

```ts name=src/modules/users/application/RegisterUser.mailer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterUser } from './RegisterUser';
import type { UserRepository } from '../domain/UserRepository';
import type { Hasher } from '../../../shared/Hasher';
import type { Mailer } from '../../../shared/Mailer';

class InMemoryUserRepository implements UserRepository {
  private store = new Map<string, any>();
  async findByEmail(e: string) { return this.store.get(e) ?? null; }
  async save(u: any) { this.store.set(u.email, u); return u; }
}

const fakeHasher: Hasher = {
  async hash(p) { return `h:${p}`; },
  async compare(p,h) { return h === `h:${p}`; },
};

describe('RegisterUser sends welcome email', () => {
  let mailer: Mailer;
  let useCase: RegisterUser;

  beforeEach(() => {
    mailer = { sendWelcome: vi.fn().mockResolvedValue(undefined) };
    useCase = new RegisterUser(new InMemoryUserRepository(), fakeHasher, mailer);
  });

  it('calls mailer.sendWelcome with the new email', async () => {
    await useCase.execute({ email: 'a@b.c', password: 'secret123', name: 'Alice' });
    expect(mailer.sendWelcome).toHaveBeenCalledWith('a@b.c', 'Alice');
    expect(mailer.sendWelcome).toHaveBeenCalledTimes(1);
  });
});
```

### 4. `vi.spyOn` — observe an existing method

```ts name=src/shared/SmtpMailer.test.ts
import { describe, it, expect, vi } from 'vitest';
import { SmtpMailer } from './SmtpMailer';
import { logger } from './logger';

describe('SmtpMailer', () => {
  it('logs that it sent the email', async () => {
    const spy = vi.spyOn(logger, 'info').mockImplementation(() => undefined as any);
    await new SmtpMailer().sendWelcome('x@y.z', null);
    expect(spy).toHaveBeenCalledWith({ to: 'x@y.z', name: null }, 'sent welcome email');
    spy.mockRestore();
  });
});
```

### 5. `vi.mock('module')` — replace an entire module

When you call third-party HTTP libraries, mock the module:

```ts name=src/shared/StripeClient.ts
import Stripe from 'stripe';
import { env } from './env';

const stripe = new Stripe(env.JWT_SECRET); // pretend STRIPE_KEY exists

export async function chargeCustomer(amount: number) {
  const c = await stripe.charges.create({ amount, currency: 'eur', source: 'tok_visa' });
  return c.id;
}
```

```ts name=src/shared/StripeClient.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      charges: { create: vi.fn().mockResolvedValue({ id: 'ch_test_123' }) },
    })),
  };
});

import { chargeCustomer } from './StripeClient';

describe('chargeCustomer', () => {
  it('returns the charge id', async () => {
    const id = await chargeCustomer(500);
    expect(id).toBe('ch_test_123');
  });
});
```

> `vi.mock` is **hoisted** to the top of the file. Always call it at module scope, never inside `it()`.

### 6. Reset between tests

```ts name=src/test/setup.ts
import { afterEach, vi } from 'vitest';
import { prisma } from '../db/prisma';

afterEach(() => {
  vi.clearAllMocks();   // forget recorded calls
  // vi.resetAllMocks(); // also strip mockImplementations — use rarely
});
```

## Test it

```bash
npm run test:unit
```

All the new mock tests should pass without touching the database or network.

## Mini-task
Refactor `RegisterUser` to inject a `TokenGenerator` port (`generate(): string`). Mock it in tests with `vi.fn().mockReturnValue('predictable_token')`. Assert the token shows up in the saved user.

## Glossary
- **Mock** — recordable / programmable replacement for a real collaborator.
- **Spy** — wrapper around an existing method that records calls (optionally also replaces).
- **Hoisting** — Vitest moves `vi.mock(...)` above `import` so the mock is in place before the module is loaded.
- **Boundary** — a port between your code and an external system; the right place to mock.

## Resources
- [Vitest — Mock functions](https://vitest.dev/api/mock.html)
- [Vitest — `vi.mock`](https://vitest.dev/api/vi.html#vi-mock)

## Checklist
- [ ] `vi.fn()` used for at least one collaborator
- [ ] `vi.spyOn` used to observe a real method
- [ ] `vi.mock('stripe')` example runs green
- [ ] `vi.clearAllMocks()` runs in `afterEach`
- [ ] `RegisterUser` mailer test passes
