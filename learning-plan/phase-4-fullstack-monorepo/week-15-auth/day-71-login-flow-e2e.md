# Day 71 — Login flow end-to-end

## Goal
Add JWT authentication to `apps/api` (register + login endpoints), understand the full login flow from form submission to stored token, and wire up `apps/web` to send credentials and receive tokens.

## Estimated time
~2 hours

## Prerequisites
Day 70 — green pipeline across all packages. Day 20 — `User` model in Prisma.

## Where to put your code
In `task-manager/apps/api/` and `apps/web/`.

## Explanation

**JWT (JSON Web Token)** is a signed, self-contained token. The server creates it on login and signs it with a secret key. The client sends it in the `Authorization: Bearer <token>` header on every subsequent request. The server verifies the signature — no database lookup needed per request. Think of it as a signed session cookie, but stateless.

The flow: Register → hash password → store user → Login → verify password → sign JWT → return token → client stores token → client sends token → server verifies → grant access.

Day 72 covers where to store the token (httpOnly cookie vs localStorage). Day 71 just builds the server-side auth endpoints and the web login form.

**bcrypt** hashes passwords. Never store plaintext. bcrypt is deliberately slow (makes brute force expensive). `bcrypt.compare` is the safe comparison function — never compare hashes manually.

## Step-by-step

### 1. Install auth packages in `apps/api`

```bash
pnpm --filter @task-manager/api add bcrypt jsonwebtoken
pnpm --filter @task-manager/api add -D @types/bcrypt @types/jsonwebtoken
```

### 2. Auth config

```ts name=apps/api/src/shared/config.ts
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const config = EnvSchema.parse(process.env);
```

Add to `apps/api/.env`:
```env
JWT_SECRET=your-super-secret-key-at-least-32-characters-long
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
```

### 3. Auth service

```ts name=apps/api/src/auth/auth.service.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { config } from '../shared/config';
import type { AuthResponse, LoginInput, CreateUserInput } from '@task-manager/types';

export class AuthService {
  async register(input: CreateUserInput & { password: string }): Promise<AuthResponse> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw Object.assign(new Error('Email already in use'), { status: 409 });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: { email: input.email, name: input.name ?? null, passwordHash },
    });

    return this.buildAuthResponse(user);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }

    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: { id: string; email: string; name: string | null }): AuthResponse {
    const accessToken = jwt.sign({ sub: user.id }, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN,
    });
    const refreshToken = jwt.sign({ sub: user.id, type: 'refresh' }, config.JWT_SECRET, {
      expiresIn: config.REFRESH_TOKEN_EXPIRES_IN,
    });

    return {
      user: { id: user.id, email: user.email, name: user.name, createdAt: new Date().toISOString() },
      tokens: { accessToken, refreshToken },
    };
  }

  verifyAccessToken(token: string): { sub: string } {
    return jwt.verify(token, config.JWT_SECRET) as { sub: string };
  }
}

export const authService = new AuthService();
```

### 4. Update Prisma schema for `passwordHash`

```prisma name=apps/api/prisma/schema.prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String?
  passwordHash String
  createdAt    DateTime @default(now())
  tasks        Task[]
}
```

```bash
pnpm --filter @task-manager/api db:migrate
# Name: add_password_hash
```

### 5. Auth middleware

```ts name=apps/api/src/middleware/authenticate.ts
import type { Request, Response, NextFunction } from 'express';
import { authService } from '../auth/auth.service';
import { prisma } from '../db/prisma';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = authService.verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    (req as Request & { user: typeof user }).user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

### 6. Auth router

```ts name=apps/api/src/auth/auth.router.ts
import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { authService } from './auth.service';
import { LoginSchema } from '@task-manager/types';

export const authRouter = Router();

const RegisterSchema = LoginSchema.extend({
  name: z.string().trim().min(1).max(100).optional(),
});

authRouter.post('/register', validateBody(RegisterSchema), async (req, res) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

authRouter.post('/login', validateBody(LoginSchema), async (req, res) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});
```

Wire in `app.ts`:
```ts
import { authRouter } from './auth/auth.router';
app.use('/auth', authRouter);
```

Protect tasks routes with the middleware:
```ts
import { authenticate } from './middleware/authenticate';
app.use('/tasks', authenticate, tasksRouter);
```

### 7. Login form in `apps/web`

```tsx name=apps/web/src/pages/LoginPage.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { LoginSchema, type LoginInput } from '@task-manager/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function LoginPage() {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });

  async function onSubmit(data: LoginInput) {
    setApiError(null);
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json() as { error: string };
      setApiError(body.error);
      return;
    }

    const { tokens } = await res.json() as { tokens: { accessToken: string; refreshToken: string } };
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    navigate('/tasks');
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Sign in</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input {...register('email')} type="email" placeholder="you@example.com" error={errors.email?.message} />
        <Input {...register('password')} type="password" placeholder="Password" error={errors.password?.message} />
        {apiError && <p role="alert" className="text-sm text-red-600">{apiError}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
```

Day 72 discusses whether `localStorage` is the right storage choice.

## Test it

```bash
# Register a user
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Password123","name":"Test User"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Password123"}'

# Use token
curl http://localhost:3000/tasks \
  -H 'Authorization: Bearer <accessToken>'
```

## Mini-task
Add `POST /auth/me` endpoint that requires `authenticate` middleware and returns the current user object from `req.user`.

## Glossary
- **JWT** — signed token carrying claims (`sub`, `exp`); verified without DB lookup.
- **`bcrypt.hash`** — slow one-way hash for passwords; second arg is salt rounds (12 is safe).
- **`authenticate` middleware** — extracts + verifies JWT from `Authorization` header; attaches user to `req`.
- **`status` on Error** — convention for attaching HTTP status to thrown errors for error handlers.

## Resources
- [jsonwebtoken docs](https://github.com/auth0/node-jsonwebtoken)
- [bcrypt docs](https://github.com/kelektiv/node.bcrypt.js)
- [JWT.io — debugger](https://jwt.io/)

## Checklist
- [ ] `passwordHash` column added to Prisma `User` model
- [ ] `AuthService` with `register`, `login`, `verifyAccessToken`
- [ ] `POST /auth/register` and `POST /auth/login` endpoints working
- [ ] `authenticate` middleware protects `/tasks` routes
- [ ] Login form submits and stores token in localStorage
- [ ] curl login + use token in tasks request works
