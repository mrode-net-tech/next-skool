# Day 28 — Use case classes

## Goal
Pull `register` and `login` logic out of the route handlers into `RegisterUser` and `LoginUser` use case classes.

## Estimated time
~1 hour.

## Prerequisites
Day 27 (users module exists).

## Where to put your code
In `my-api`.

## Explanation

A **use case** is a class with one public method, `execute`. It receives its dependencies via the constructor — the route handler instantiates it (Day 28) or the DI container resolves it (Day 29).

The benefits show up in tests: a use case test does not need Express, Supertest, or even Prisma. You instantiate it with an in-memory fake repository and assert on the returned DTO.

Laravel analogy: this is exactly the **Action class** pattern (`RegisterUserAction`).

## Step-by-step

### 1. Define a `Hasher` port (so we can fake bcrypt in tests)

```ts name=src/modules/users/domain/Hasher.ts
export interface Hasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}
```

```ts name=src/modules/users/infrastructure/BcryptHasher.ts
import bcrypt from 'bcryptjs';
import type { Hasher } from '../domain/Hasher';

export class BcryptHasher implements Hasher {
  hash(plain: string)   { return bcrypt.hash(plain, 10); }
  compare(plain: string, hash: string) { return bcrypt.compare(plain, hash); }
}
```

### 2. The `RegisterUser` use case

```ts name=src/modules/users/application/RegisterUser.ts
import { randomUUID } from 'node:crypto';
import type { UserRepository } from '../domain/UserRepository';
import type { Hasher } from '../domain/Hasher';
import { EmailTakenError } from '../domain/errors';
import { toDTO, type UserDTO } from '../domain/User';

export interface RegisterUserInput {
  email: string;
  password: string;
  name?: string;
}

export class RegisterUser {
  constructor(private users: UserRepository, private hasher: Hasher) {}

  async execute(input: RegisterUserInput): Promise<UserDTO> {
    if (await this.users.findByEmail(input.email)) {
      throw new EmailTakenError(input.email);
    }
    const passwordHash = await this.hasher.hash(input.password);
    const saved = await this.users.save({
      id: randomUUID(),
      email: input.email,
      name: input.name ?? null,
      passwordHash,
    });
    return toDTO(saved);
  }
}
```

### 3. The `LoginUser` use case

```ts name=src/modules/users/application/LoginUser.ts
import type { UserRepository } from '../domain/UserRepository';
import type { Hasher } from '../domain/Hasher';
import { InvalidCredentialsError } from '../domain/errors';
import { signAccess } from '../../../auth/jwt';
import { issueRefreshToken } from '../../../auth/refresh';

export interface LoginUserInput  { email: string; password: string }
export interface LoginUserOutput { accessToken: string; refreshToken: string }

export class LoginUser {
  constructor(private users: UserRepository, private hasher: Hasher) {}

  async execute(input: LoginUserInput): Promise<LoginUserOutput> {
    const user = await this.users.findByEmail(input.email);
    if (!user) throw new InvalidCredentialsError();

    const valid = await this.hasher.compare(input.password, user.passwordHash);
    if (!valid) throw new InvalidCredentialsError();

    const accessToken  = signAccess({ sub: user.id, email: user.email });
    const refreshToken = await issueRefreshToken(user.id);
    return { accessToken, refreshToken };
  }
}
```

### 4. Slim the router down

```ts name=src/modules/users/infrastructure/http/authRouter.ts
import { Router } from 'express';
import { validateBody } from '../../../../middleware/validate';
import { PrismaUserRepository } from '../PrismaUserRepository';
import { BcryptHasher } from '../BcryptHasher';
import { RegisterUser } from '../../application/RegisterUser';
import { LoginUser }    from '../../application/LoginUser';
import { RegisterSchema, LoginSchema } from './schemas';

export const authRouter = Router();

const users  = new PrismaUserRepository();
const hasher = new BcryptHasher();
const register = new RegisterUser(users, hasher);
const login    = new LoginUser(users, hasher);

authRouter.post('/register', validateBody(RegisterSchema), async (req, res, next) => {
  try   { res.status(201).json(await register.execute(req.body)); }
  catch (e) { next(e); }
});

authRouter.post('/login', validateBody(LoginSchema), async (req, res, next) => {
  try   { res.json(await login.execute(req.body)); }
  catch (e) { next(e); }
});
```

The handler now does three things: validate, call use case, respond. No business logic.

## Test it

### 1. Unit test the use case (no DB, no HTTP)

```ts name=src/modules/users/application/RegisterUser.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { RegisterUser } from './RegisterUser';
import { EmailTakenError } from '../domain/errors';
import type { UserRepository } from '../domain/UserRepository';
import type { User } from '../domain/User';
import type { Hasher } from '../domain/Hasher';

class InMemoryUserRepository implements UserRepository {
  private rows: User[] = [];
  async findById(id: string)        { return this.rows.find(r => r.id === id) ?? null; }
  async findByEmail(email: string)  { return this.rows.find(r => r.email === email) ?? null; }
  async save(u) {
    const row: User = { ...u, createdAt: u.createdAt ?? new Date() };
    this.rows.push(row);
    return row;
  }
}

const fakeHasher: Hasher = {
  hash: async (p) => `H(${p})`,
  compare: async (p, h) => h === `H(${p})`,
};

describe('RegisterUser', () => {
  let users: InMemoryUserRepository;
  let useCase: RegisterUser;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    useCase = new RegisterUser(users, fakeHasher);
  });

  it('returns a DTO without the hash', async () => {
    const dto = await useCase.execute({ email: 'a@b.c', password: 'secret123' });
    expect(dto.email).toBe('a@b.c');
    expect((dto as any).passwordHash).toBeUndefined();
  });

  it('throws EmailTakenError when email exists', async () => {
    await useCase.execute({ email: 'a@b.c', password: 'secret123' });
    await expect(useCase.execute({ email: 'a@b.c', password: 'other' }))
      .rejects.toBeInstanceOf(EmailTakenError);
  });
});
```

These tests run in milliseconds because they never touch Postgres.

### 2. Existing Supertest suite still passes

```bash
npm test
```

## Mini-task
Add `LoginUser.test.ts` with three tests: success, wrong password (`InvalidCredentialsError`), unknown user. Use the same `InMemoryUserRepository` and `fakeHasher`.

## Glossary
- **Port** (`Hasher` interface) — abstract dependency a use case needs.
- **Adapter** (`BcryptHasher`) — concrete implementation of a port.
- **Hexagonal architecture** — synonym for ports-and-adapters; this is what we are building.

## Resources
- [Alistair Cockburn — Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)

## Checklist
- [ ] `RegisterUser` and `LoginUser` use case classes exist
- [ ] `Hasher` port + `BcryptHasher` adapter exist
- [ ] `authRouter` no longer imports bcrypt directly
- [ ] Unit tests for `RegisterUser` pass without a DB
- [ ] Supertest suite still green
