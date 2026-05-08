# Day 25 — Refresh tokens + full Supertest suite

## Goal
Add a refresh-token flow so users can get a new access token without re-entering their password. Cover the full auth lifecycle with Supertest.

## Estimated time
~1.5 hours.

## Prerequisites
Days 21–24 (register, login, JWT, auth middleware, protected routes).

## Where to put your code
In `my-api`.

## Explanation

The **access token** from Day 22 is short-lived (15 min) so a stolen token is dangerous only briefly. But forcing the user to log in every 15 minutes is awful UX. The fix is a **refresh token**:

- Long-lived (e.g. 30 days), opaque, stored server-side (in DB).
- Issued at login alongside the access token.
- The client sends it to `POST /auth/refresh` to get a new short-lived access token.
- On `POST /auth/logout` the server deletes it from the DB.
- Because it lives in the DB, the server can revoke it at any time.

Laravel analogy: Sanctum's `personal_access_tokens` table — same idea, just with one row per device/session.

## Step-by-step

### 1. Add a `RefreshToken` model

```prisma name=prisma/schema.prisma
model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  name          String?
  password      String
  createdAt     DateTime       @default(now())
  tasks         Task[]
  refreshTokens RefreshToken[]
}
```

```bash
npx prisma migrate dev --name add_refresh_tokens
```

### 2. Helper to mint refresh tokens

```ts name=src/auth/refresh.ts
import { randomBytes } from 'node:crypto';
import { prisma } from '../db/prisma';

const REFRESH_TTL_DAYS = 30;

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
  return token;
}

export async function consumeRefreshToken(token: string) {
  const row = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!row) return null;
  if (row.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: row.id } });
    return null;
  }
  return row;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token } });
}
```

### 3. Update `/auth/login`, add `/auth/refresh` and `/auth/logout`

```ts name=src/auth/routes.ts
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { validateBody } from '../middleware/validate';
import { prisma } from '../db/prisma';
import { signAccess } from './jwt';
import { issueRefreshToken, consumeRefreshToken, revokeRefreshToken } from './refresh';

export const authRouter = Router();

// ... RegisterSchema, LoginSchema, register handler from Day 22 ...

const RefreshSchema = z.object({ refreshToken: z.string().min(10) });

authRouter.post('/login', validateBody(LoginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'invalid_credentials' });

  const accessToken  = signAccess({ sub: user.id, email: user.email });
  const refreshToken = await issueRefreshToken(user.id);
  res.json({ accessToken, refreshToken });
});

authRouter.post('/refresh', validateBody(RefreshSchema), async (req, res) => {
  const row = await consumeRefreshToken(req.body.refreshToken);
  if (!row) return res.status(401).json({ error: 'invalid_refresh_token' });

  const accessToken = signAccess({ sub: row.user.id, email: row.user.email });
  res.json({ accessToken });
});

authRouter.post('/logout', validateBody(RefreshSchema), async (req, res) => {
  await revokeRefreshToken(req.body.refreshToken);
  res.status(204).send();
});
```

> **Note:** `/login` now returns `{ accessToken, refreshToken }` instead of `{ token }`. Update any older test that relied on the old shape.

## Test it

```ts name=src/auth/refresh.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../db/prisma';

const app = createApp();

beforeEach(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
});

async function loginAlice() {
  await request(app).post('/auth/register').send({
    email: 'alice@example.com', password: 'secret123',
  });
  const res = await request(app).post('/auth/login').send({
    email: 'alice@example.com', password: 'secret123',
  });
  return res.body as { accessToken: string; refreshToken: string };
}

describe('refresh-token flow', () => {
  it('login returns both an access and a refresh token', async () => {
    const { accessToken, refreshToken } = await loginAlice();
    expect(typeof accessToken).toBe('string');
    expect(typeof refreshToken).toBe('string');
  });

  it('refresh issues a new access token', async () => {
    const { refreshToken } = await loginAlice();
    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('logout revokes the refresh token', async () => {
    const { refreshToken } = await loginAlice();
    const out = await request(app).post('/auth/logout').send({ refreshToken });
    expect(out.status).toBe(204);

    const reuse = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(reuse.status).toBe(401);
  });

  it('rejects an unknown refresh token', async () => {
    const res = await request(app).post('/auth/refresh').send({
      refreshToken: 'definitely-not-a-real-token',
    });
    expect(res.status).toBe(401);
  });
});
```

```bash
npm test
```

## Mini-task
Add a manual expiry test: insert a `RefreshToken` row directly via Prisma with `expiresAt` in the past, then call `/auth/refresh` with it. Expect 401 and assert the row was deleted by `consumeRefreshToken`.

## Glossary
- **Access token** — short-lived JWT sent in the `Authorization` header.
- **Refresh token** — long-lived opaque string, stored server-side, exchanged for fresh access tokens.
- **Token rotation** — issuing a new refresh token on every refresh; we keep it simple here and reuse the same one.

## Resources
- [OWASP — JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Auth0 — Refresh Tokens](https://auth0.com/docs/secure/tokens/refresh-tokens)

## Checklist
- [ ] `RefreshToken` table created via migration
- [ ] `/auth/login` returns `{ accessToken, refreshToken }`
- [ ] `/auth/refresh` issues a new access token
- [ ] `/auth/logout` revokes the refresh token (subsequent refresh returns 401)
- [ ] All four refresh-flow tests pass
