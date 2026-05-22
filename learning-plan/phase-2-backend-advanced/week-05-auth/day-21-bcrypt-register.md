# Day 21 — bcrypt + POST /auth/register

## Goal
Add a `password` field to the `User` model and expose `POST /auth/register` that stores a bcrypt-hashed password.

## Estimated time
~1 hour.

## Prerequisites
Days 17–20 (Prisma schema, `User` model, migration workflow).

## Where to put your code
In `my-api`.

## Explanation

Storing plain-text passwords is a serious security bug. **bcrypt** is a slow hashing algorithm designed for passwords: it applies many rounds of a one-way function so that brute-force attacks are expensive. The resulting hash looks like `$2b$10$...` and encodes the salt and cost factor inside it.

Laravel analogy: `Hash::make($password)` calls bcrypt under the hood. `bcryptjs` (or `bcrypt`) in Node does the same thing — the hashes are even compatible.

We never return `password` in API responses. We'll use Prisma's `select` to strip it out, and later the DDD layer will enforce this in the domain entity.

## Step-by-step

### 1. Add `password` to the Prisma schema

```prisma name=prisma/schema.prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String
  createdAt DateTime @default(now())
  tasks     Task[]
}
```

```bash
npx prisma migrate dev --name add_password_to_user
```

### 2. Install bcryptjs

```bash
npm i bcryptjs
npm i -D @types/bcryptjs
```

### 3. Auth router

```ts name=src/auth/routes.ts
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { validateBody } from '../middleware/validate';
import { prisma } from '../db/prisma';

export const authRouter = Router();

const RegisterSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8, 'password must be at least 8 characters'),
  name:     z.string().optional(),
});

authRouter.post('/register', validateBody(RegisterSchema), async (req, res) => {
  const { email, password, name } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'email_taken' });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hash, name },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  res.status(201).json(user);
});
```

### 4. Wire it in app.ts

```ts name=src/app.ts
import express from 'express';
import { tasksRouter } from './tasks/routes';
import { usersRouter } from './users/routes';
import { authRouter } from './auth/routes';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/tasks', tasksRouter);
  return app;
}
```

## Test it

```ts name=src/auth/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../db/prisma';

const app = createApp();

beforeEach(async () => {
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
});

describe('POST /auth/register', () => {
  it('creates a user and returns 201 without password', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('alice@example.com');
    expect(res.body.password).toBeUndefined();
  });

  it('returns 409 when email is already taken', async () => {
    const data = { email: 'bob@example.com', password: 'secret123' };
    await request(app).post('/auth/register').send(data);
    const res = await request(app).post('/auth/register').send(data);
    expect(res.status).toBe(409);
  });

  it('returns 400 for a short password', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'x@example.com',
      password: '123',
    });
    expect(res.status).toBe(400);
  });
});
```

```bash
npm test
```

## Mini-task
Add a `POST /auth/register` test that verifies the stored hash is NOT the plain password: query the DB with Prisma and check `bcrypt.compareSync(plain, storedHash)` is `true`.

## Glossary
- **bcrypt** — slow, salted password-hashing algorithm designed to resist brute-force.
- **cost factor** — the `10` in `bcrypt.hash(pw, 10)`: higher = slower hash = harder to brute-force.
- **`select`** — Prisma field to choose which columns to return, used here to omit `password`.

## Resources
- [bcryptjs npm](https://www.npmjs.com/package/bcryptjs)
- [Prisma — select fields](https://www.prisma.io/docs/orm/prisma-client/queries/select-fields)

## Checklist
- [x] `password` column added via migration
- [x] `POST /auth/register` returns 201 without exposing `password`
- [x] Duplicate email returns 409
- [x] Short password returns 400
