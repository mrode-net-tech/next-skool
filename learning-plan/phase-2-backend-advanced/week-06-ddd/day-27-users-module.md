# Day 27 — Refactor users into a module

## Goal
Move all user-related code into `src/modules/users/` with the `domain / application / infrastructure` split. Keep tests green.

## Estimated time
~1.5 hours.

## Prerequisites
Day 26 (you understand the layer model).

## Where to put your code
In `my-api`.

## Explanation

We refactor in small steps and run tests after each one. The end state: all user code lives in one folder, the rest of the app imports only the public surface (`authRouter`, `UserDTO`).

## Step-by-step

### 1. Create the folder skeleton

```bash
mkdir -p src/modules/users/{domain,application,infrastructure/http}
```

### 2. Move the entity to `domain/`

```ts name=src/modules/users/domain/User.ts
export interface User {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
  createdAt: Date;
}

export interface UserDTO {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

export function toDTO(u: User): UserDTO {
  return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt };
}
```

> Notice we renamed `password` → `passwordHash` in the domain so the field name reflects what it actually is.

### 3. Define the repository interface

```ts name=src/modules/users/domain/UserRepository.ts
import type { User } from './User';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: Omit<User, 'createdAt'> & { createdAt?: Date }): Promise<User>;
}
```

### 4. Define domain errors

```ts name=src/modules/users/domain/errors.ts
export class EmailTakenError extends Error {
  readonly code = 'email_taken';
  constructor(email: string) { super(`Email already taken: ${email}`); }
}

export class InvalidCredentialsError extends Error {
  readonly code = 'invalid_credentials';
  constructor() { super('Invalid credentials'); }
}
```

### 5. Implement the Prisma repository

```ts name=src/modules/users/infrastructure/PrismaUserRepository.ts
import { prisma } from '../../../db/prisma';
import type { User } from '../domain/User';
import type { UserRepository } from '../domain/UserRepository';

function fromPrisma(row: {
  id: string; email: string; name: string | null;
  password: string; createdAt: Date;
}): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password,
    createdAt: row.createdAt,
  };
}

export class PrismaUserRepository implements UserRepository {
  async findById(id: string) {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? fromPrisma(row) : null;
  }
  async findByEmail(email: string) {
    const row = await prisma.user.findUnique({ where: { email } });
    return row ? fromPrisma(row) : null;
  }
  async save(user) {
    const row = await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id, email: user.email, name: user.name,
        password: user.passwordHash,
      },
      update: {
        email: user.email, name: user.name, password: user.passwordHash,
      },
    });
    return fromPrisma(row);
  }
}
```

### 6. Move the HTTP layer (without changing behaviour yet)

```ts name=src/modules/users/infrastructure/http/schemas.ts
import { z } from 'zod';

export const RegisterSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
  name:     z.string().optional(),
});

export const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});
```

```ts name=src/modules/users/infrastructure/http/authRouter.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { validateBody } from '../../../../middleware/validate';
import { signAccess } from '../../../../auth/jwt';
import { issueRefreshToken, consumeRefreshToken, revokeRefreshToken } from '../../../../auth/refresh';
import { PrismaUserRepository } from '../PrismaUserRepository';
import { RegisterSchema, LoginSchema } from './schemas';
import { EmailTakenError, InvalidCredentialsError } from '../../domain/errors';
import { toDTO } from '../../domain/User';

export const authRouter = Router();
const users = new PrismaUserRepository();

authRouter.post('/register', validateBody(RegisterSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (await users.findByEmail(email)) throw new EmailTakenError(email);

    const passwordHash = await bcrypt.hash(password, 10);
    const saved = await users.save({
      id: randomUUID(),
      email, name: name ?? null, passwordHash,
    });
    res.status(201).json(toDTO(saved));
  } catch (err) { next(err); }
});

authRouter.post('/login', validateBody(LoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await users.findByEmail(email);
    if (!user) throw new InvalidCredentialsError();

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new InvalidCredentialsError();

    const accessToken  = signAccess({ sub: user.id, email: user.email });
    const refreshToken = await issueRefreshToken(user.id);
    res.json({ accessToken, refreshToken });
  } catch (err) { next(err); }
});
```

### 7. Add a tiny error-to-HTTP translator

```ts name=src/middleware/errorHandler.ts
import type { ErrorRequestHandler } from 'express';
import { EmailTakenError, InvalidCredentialsError } from '../modules/users/domain/errors';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof EmailTakenError)        return res.status(409).json({ error: err.code });
  if (err instanceof InvalidCredentialsError) return res.status(401).json({ error: err.code });
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
};
```

### 8. Wire it up

```ts name=src/app.ts
import express from 'express';
import { tasksRouter } from './tasks/routes';
import { authRouter } from './modules/users/infrastructure/http/authRouter';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRouter);
  app.use('/tasks', tasksRouter);
  app.use(errorHandler);
  return app;
}
```

Delete the old `src/auth/routes.ts` content (move what's left to `users/` module). Keep `src/auth/jwt.ts` and `src/auth/refresh.ts` for now — they move to a `tokens` module in Week 7.

## Test it

Your existing Day 21–25 tests should pass unchanged:

```bash
npm test
```

Add one test that proves the entity translation works:

```ts name=src/modules/users/domain/User.test.ts
import { describe, it, expect } from 'vitest';
import { toDTO } from './User';

describe('User.toDTO', () => {
  it('omits passwordHash', () => {
    const dto = toDTO({
      id: '1', email: 'a@b.c', name: null,
      passwordHash: 'secret', createdAt: new Date(),
    });
    expect((dto as any).passwordHash).toBeUndefined();
    expect(dto.email).toBe('a@b.c');
  });
});
```

## Mini-task
Move `src/users/routes.ts` (the simple `POST /users` from Day 20) into `src/modules/users/infrastructure/http/usersRouter.ts`, using the same `PrismaUserRepository`. Mount it in `app.ts`. Remove the old folder.

## Glossary
- **Module** — a self-contained slice of the domain (`users/`, `tasks/`).
- **DTO (Data Transfer Object)** — plain object exposed to the outside world.
- **Mapper** (`fromPrisma`, `toDTO`) — function translating between layers.

## Resources
- [Khalil Stemmler — Repository Pattern](https://khalilstemmler.com/articles/typescript-domain-driven-design/repository-dto-mapper/)

## Checklist
- [ ] All user code lives under `src/modules/users/`
- [ ] `User` entity has `passwordHash`, not `password`
- [ ] `errorHandler` translates `EmailTakenError` → 409, `InvalidCredentialsError` → 401
- [ ] Day 21–25 tests still pass
