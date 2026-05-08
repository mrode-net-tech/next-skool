# Day 29 — Dependency injection (tsyringe)

## Goal
Replace manual `new PrismaUserRepository()` wiring with a **tsyringe** container. Routes resolve use cases by token; tests swap implementations via `container.register`.

## Estimated time
~1 hour.

## Prerequisites
Day 28 (use cases exist and accept dependencies in their constructor).

## Where to put your code
In `my-api`.

## Explanation

Right now the router calls `new PrismaUserRepository()` and `new RegisterUser(users, hasher)` itself. That works, but every test that wants to swap the repository has to monkey-patch the router.

A **DI container** centralises this wiring. We register tokens (e.g. `'UserRepository'` → `PrismaUserRepository`) at startup; anywhere we need a `UserRepository` we resolve the token from the container. In tests we register a fake first, and the application picks it up.

[tsyringe](https://github.com/microsoft/tsyringe) is Microsoft's small reflection-based DI library. Laravel analogy: the `app()` service container.

## Step-by-step

### 1. Install tsyringe

```bash
npm i tsyringe reflect-metadata
```

Add `import 'reflect-metadata';` at the top of `src/app.ts` and `src/server.ts`. Enable decorators in `tsconfig.json`:

```json name=tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    /* ...your existing options... */
  }
}
```

### 2. Define DI tokens

Use string tokens for interfaces (decorators only work on classes).

```ts name=src/shared/tokens.ts
export const TOKENS = {
  UserRepository: 'UserRepository',
  Hasher:         'Hasher',
} as const;
```

### 3. Decorate the use cases

```ts name=src/modules/users/application/RegisterUser.ts
import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../../../shared/tokens';
import type { UserRepository } from '../domain/UserRepository';
import type { Hasher } from '../domain/Hasher';
import { EmailTakenError } from '../domain/errors';
import { toDTO, type UserDTO } from '../domain/User';
import { randomUUID } from 'node:crypto';

@injectable()
export class RegisterUser {
  constructor(
    @inject(TOKENS.UserRepository) private users: UserRepository,
    @inject(TOKENS.Hasher)         private hasher: Hasher,
  ) {}

  async execute(input: { email: string; password: string; name?: string }): Promise<UserDTO> {
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

Apply `@injectable()` to `LoginUser` the same way.

### 4. Configure the container

```ts name=src/shared/container.ts
import 'reflect-metadata';
import { container } from 'tsyringe';
import { TOKENS } from './tokens';
import { PrismaUserRepository } from '../modules/users/infrastructure/PrismaUserRepository';
import { BcryptHasher } from '../modules/users/infrastructure/BcryptHasher';

export function configureContainer() {
  container.registerSingleton(TOKENS.UserRepository, PrismaUserRepository);
  container.registerSingleton(TOKENS.Hasher,         BcryptHasher);
}

export { container };
```

Call `configureContainer()` once on startup:

```ts name=src/app.ts
import 'reflect-metadata';
import express from 'express';
import { configureContainer } from './shared/container';
import { authRouter } from './modules/users/infrastructure/http/authRouter';
import { tasksRouter } from './tasks/routes';
import { errorHandler } from './middleware/errorHandler';

configureContainer();

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

### 5. Resolve use cases inside the router

```ts name=src/modules/users/infrastructure/http/authRouter.ts
import { Router } from 'express';
import { container } from '../../../../shared/container';
import { validateBody } from '../../../../middleware/validate';
import { RegisterUser } from '../../application/RegisterUser';
import { LoginUser }    from '../../application/LoginUser';
import { RegisterSchema, LoginSchema } from './schemas';

export const authRouter = Router();

authRouter.post('/register', validateBody(RegisterSchema), async (req, res, next) => {
  try {
    const useCase = container.resolve(RegisterUser);
    res.status(201).json(await useCase.execute(req.body));
  } catch (e) { next(e); }
});

authRouter.post('/login', validateBody(LoginSchema), async (req, res, next) => {
  try {
    const useCase = container.resolve(LoginUser);
    res.json(await useCase.execute(req.body));
  } catch (e) { next(e); }
});
```

## Test it

### 1. Existing Supertest suite

```bash
npm test
```

If it fails with `Cannot find name 'reflect-metadata'`, double-check that you `import 'reflect-metadata'` at the top of `app.ts` AND in test setup.

### 2. Use the container in a use case test

```ts name=src/modules/users/application/RegisterUser.di.test.ts
import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { container } from 'tsyringe';
import { TOKENS } from '../../../shared/tokens';
import { RegisterUser } from './RegisterUser';
import type { UserRepository } from '../domain/UserRepository';
import type { Hasher } from '../domain/Hasher';
import type { User } from '../domain/User';

class InMemoryUserRepo implements UserRepository {
  rows: User[] = [];
  async findById(id: string)       { return this.rows.find(r => r.id === id) ?? null; }
  async findByEmail(email: string) { return this.rows.find(r => r.email === email) ?? null; }
  async save(u) {
    const row: User = { ...u, createdAt: new Date() };
    this.rows.push(row);
    return row;
  }
}

const fakeHasher: Hasher = {
  hash: async (p) => `H(${p})`,
  compare: async (p, h) => h === `H(${p})`,
};

describe('RegisterUser via container', () => {
  beforeEach(() => {
    container.clearInstances();
    container.registerInstance(TOKENS.UserRepository, new InMemoryUserRepo());
    container.registerInstance(TOKENS.Hasher, fakeHasher);
  });

  it('uses the registered fake repository', async () => {
    const useCase = container.resolve(RegisterUser);
    const dto = await useCase.execute({ email: 'di@example.com', password: 'secret123' });
    expect(dto.email).toBe('di@example.com');

    const repo = container.resolve<InMemoryUserRepo>(TOKENS.UserRepository);
    expect(repo.rows.length).toBe(1);
  });
});
```

## Mini-task
Add a `Logger` port to `shared/`, register a console implementation, inject it into `RegisterUser`, and log every successful registration. In the test, register a fake logger that records calls and assert it was called once.

## Glossary
- **DI container** — registry that resolves dependencies on demand.
- **Token** — string (or class) that identifies a registered dependency.
- **Singleton scope** — one instance per process (`registerSingleton`).
- **`reflect-metadata`** — runtime metadata polyfill required by tsyringe.

## Resources
- [tsyringe README](https://github.com/microsoft/tsyringe)
- [TypeScript decorators](https://www.typescriptlang.org/docs/handbook/decorators.html)

## Checklist
- [ ] `tsyringe` and `reflect-metadata` installed
- [ ] Decorators enabled in `tsconfig.json`
- [ ] `configureContainer()` called once in `app.ts`
- [ ] Routes resolve use cases via `container.resolve(...)`
- [ ] DI test swaps the repository with an in-memory fake
- [ ] Existing Supertest suite still green
