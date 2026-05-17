# Day 92 — Auth.js setup (admin login)

## Goal
Add Auth.js v5 (next-auth) to protect the `/admin` routes. Implement a credentials provider (email + password) with bcrypt. Use the Auth.js Prisma adapter so sessions are stored in the database. Protect the admin area via `middleware.ts`.

## Estimated time
~2.5 hours

## Prerequisites
Day 91 (Server Actions understood, Prisma running with Auth.js schema tables).

## Where to put your code
In `ai-folio`.

## Explanation

**Auth.js v5** (the beta version of next-auth) is a full-stack authentication library for Next.js. It handles sessions, CSRF protection, and OAuth providers. For `ai-folio` you only need one admin user — yourself — so you use the **Credentials provider** (email + password) rather than OAuth.

**Database sessions** (not JWT): Auth.js creates a `Session` row in Postgres and stores a session token in an `httpOnly` cookie. On every request, `middleware.ts` checks the cookie, queries the `Session` table, and either allows or redirects. This is more like Laravel's `database` session driver than a stateless JWT.

**`auth.ts` is the single config file.** It exports `handlers` (Route Handler for `GET/POST /api/auth/*`), `auth` (the session getter — callable from Server Components, Server Actions, and middleware), `signIn`, and `signOut`.

In Laravel terms: Auth.js is like `php artisan make:auth` — it gives you session management, guards, and redirect-on-fail middleware — except it's one config file instead of scaffolded controllers.

The **Prisma adapter** syncs Auth.js's session lifecycle with your database. When a user logs in, Auth.js creates rows in `Session`, `Account`, and `User`. When they log out, it deletes the `Session` row.

## Step-by-step

### 1. Install packages

```bash
pnpm add next-auth@beta @auth/prisma-adapter bcryptjs
pnpm add -D @types/bcryptjs
```

### 2. Create the Auth.js config

```ts name=auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/src/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database' },
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(1),
          })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user?.password) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.password,
        );

        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
```

`auth.ts` lives at the **project root** (same level as `next.config.ts`), not inside `src/`.

### 3. Add the Route Handler for Auth.js

```ts name=src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/../auth';

export const { GET, POST } = handlers;
```

This single file handles all `/api/auth/*` endpoints: `/api/auth/signin`, `/api/auth/signout`, `/api/auth/session`, etc.

### 4. Protect admin routes with middleware

```ts name=middleware.ts
import { auth } from './auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default auth((req) => {
  const isAdminRoute = req.nextUrl.pathname.startsWith('/admin');
  const isLoginPage = req.nextUrl.pathname === '/admin/login';

  if (isAdminRoute && !isLoginPage && !req.auth) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }
});

export const config = {
  matcher: ['/admin/:path*'],
};
```

`middleware.ts` lives at the **project root**, not inside `src/`.

### 5. Create the admin user (seed script)

Run this once to create your admin account:

```ts name=scripts/create-admin.ts
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/db';

const email = process.env.ADMIN_EMAIL ?? 'admin@example.com';
const password = process.env.ADMIN_PASSWORD ?? 'changeme123';

const hash = await bcrypt.hash(password, 12);

await prisma.user.upsert({
  where: { email },
  update: { password: hash },
  create: { email, password: hash, name: 'Admin' },
});

console.log(`Admin user created: ${email}`);
await prisma.$disconnect();
```

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=strongpassword npx tsx scripts/create-admin.ts
```

### 6. Admin login page

```tsx name=src/app/admin/login/page.tsx
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/../auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function AdminLoginPage() {
  const session = await auth();
  if (session) redirect('/admin');

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold">Admin login</h1>

        <form
          action={async (formData) => {
            'use server';
            await signIn('credentials', {
              email: formData.get('email'),
              password: formData.get('password'),
              redirectTo: '/admin',
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full">Sign in</Button>
        </form>
      </div>
    </div>
  );
}
```

The `action` on the form is an inline Server Action — valid in a Server Component.

### 7. Sign-out button (Client Component)

```tsx name=src/components/admin/sign-out-button.tsx
'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => signOut({ callbackUrl: '/admin/login' })}
    >
      <LogOut size={14} className="mr-1" /> Sign out
    </Button>
  );
}
```

### 8. Auth.js environment variables

```bash name=.env.local
AUTH_SECRET=generate-with-openssl-rand-hex-32
AUTH_URL=http://localhost:3000
```

Generate a secret:

```bash
openssl rand -hex 32
```

## Test it

```bash
pnpm dev
```

1. Visit `http://localhost:3000/admin` → redirected to `/admin/login`.
2. Log in with the admin credentials from the seed script.
3. You land on `/admin` (stub page for now — Day 93 builds it).
4. Open DevTools → Application → Cookies. You should see `authjs.session-token` (httpOnly).
5. Visit `http://localhost:3000/api/auth/session` in the browser → returns your session as JSON.

## Mini-task
Add a `AUTH_TRUST_HOST=true` env var to `.env.local` if you get a "untrusted host" error locally. Read the Auth.js docs on why this is needed in development and what it means for production.

## Glossary
- **Auth.js v5** — next-auth v5 beta; unified config in `auth.ts`; exports `auth`, `handlers`, `signIn`, `signOut`.
- **Credentials provider** — email + password auth; requires manual `authorize` function to validate.
- **Prisma adapter** — links Auth.js session lifecycle to your `Session`, `User`, `Account` tables.
- **`strategy: 'database'`** — sessions stored as DB rows (not JWTs); more secure, requires DB round-trip on every request.
- **`middleware.ts`** — Next.js edge middleware; runs before every matched request; used to redirect unauthenticated users.

## Resources
- [Auth.js v5 — Getting started](https://authjs.dev/getting-started)
- [Auth.js — Credentials provider](https://authjs.dev/getting-started/authentication/credentials)
- [Auth.js — Prisma adapter](https://authjs.dev/getting-started/adapters/prisma)
- [Next.js — Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)

## Checklist
- [ ] `next-auth@beta`, `@auth/prisma-adapter`, `bcryptjs` installed
- [ ] `auth.ts` at project root with Credentials provider + Prisma adapter
- [ ] `src/app/api/auth/[...nextauth]/route.ts` exports `GET` and `POST` from handlers
- [ ] `middleware.ts` at project root redirects unauthenticated `/admin/*` to `/admin/login`
- [ ] Admin user created via seed script
- [ ] Login form works — session cookie set on success
- [ ] Visiting `/admin` without a session redirects to `/admin/login`
- [ ] `AUTH_SECRET` and `AUTH_URL` set in `.env.local`
