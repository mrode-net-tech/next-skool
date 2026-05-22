# Day 22 — POST /auth/login returning JWT

## Goal
Implement `POST /auth/login` that verifies the password and returns a signed **JWT** access token.

## Estimated time
~1 hour.

## Prerequisites
Day 21 (bcrypt register, `password` column exists).

## Where to put your code
In `my-api`.

## Explanation

A **JSON Web Token (JWT)** is a compact, URL-safe string of three base64-encoded parts: header, payload, and signature. The server signs the payload with a secret; any tampered payload makes the signature invalid. Because the signature is verifiable, the server does not need to look up a session in the database on every request.

Laravel analogy: `Auth::attempt(['email' => $email, 'password' => $password])` followed by `auth()->user()->createToken(...)` in Sanctum or Passport. Here we do the same steps manually with `bcrypt.compare` + `jwt.sign`.

Keep the access token **short-lived** (15 minutes is common). We add refresh tokens in Day 25.

## Step-by-step

### 1. Install jsonwebtoken

```bash
npm i jsonwebtoken
npm i -D @types/jsonwebtoken
```

### 2. Add JWT_SECRET to .env

```bash
# .env
JWT_SECRET=change_me_to_a_long_random_string_in_production
```

### 3. jwt helper

```ts name=src/auth/jwt.ts
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'dev_secret';

export type JwtPayload = { sub: string; email: string };

export function signAccess(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '15m' });
}

export function verifyAccess(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}
```

### 4. Add login route to auth/routes.ts

```ts name=src/auth/routes.ts
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { validateBody } from '../middleware/validate';
import { prisma } from '../db/prisma';
import { signAccess } from './jwt';

export const authRouter = Router();

const RegisterSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
  name:     z.string().optional(),
});

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/register', validateBody(RegisterSchema), async (req, res) => {
  const { email, password, name } = req.body;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'email_taken' });

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hash, name },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  res.status(201).json(user);
});

authRouter.post('/login', validateBody(LoginSchema), async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'invalid_credentials' });

  const token = signAccess({ sub: user.id, email: user.email });
  res.json({ token });
});
```

> **Security note:** always return the same error message (`invalid_credentials`) for both "user not found" and "wrong password". Distinct messages leak whether an email is registered.

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

async function registerAlice() {
  return request(app).post('/auth/register').send({
    email: 'alice@example.com', password: 'secret123',
  });
}

describe('POST /auth/login', () => {
  it('returns a token on valid credentials', async () => {
    await registerAlice();
    const res = await request(app).post('/auth/login').send({
      email: 'alice@example.com', password: 'secret123',
    });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.split('.').length).toBe(3); // JWT shape
  });

  it('returns 401 on wrong password', async () => {
    await registerAlice();
    const res = await request(app).post('/auth/login').send({
      email: 'alice@example.com', password: 'wrong',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'ghost@example.com', password: 'whatever',
    });
    expect(res.status).toBe(401);
  });
});
```

```bash
npm test
```

## Mini-task
Decode the returned token (without verifying) using `Buffer.from(token.split('.')[1], 'base64').toString()` and log it. Verify the `sub` field matches the user's `id`.

## Glossary
- **JWT** — JSON Web Token; base64(header).base64(payload).signature.
- **`sub`** — standard JWT claim for "subject" (typically the user ID).
- **`expiresIn`** — tells `jwt.sign` to add an `exp` claim; the token is invalid after that.

## Resources
- [jsonwebtoken npm](https://www.npmjs.com/package/jsonwebtoken)
- [JWT.io](https://jwt.io/)

## Checklist
- [x] `POST /auth/login` returns `{ token }` for valid credentials
- [x] Wrong password / unknown email both return 401
- [x] Token is a valid 3-part JWT string
- [x] `JWT_SECRET` comes from environment variable
