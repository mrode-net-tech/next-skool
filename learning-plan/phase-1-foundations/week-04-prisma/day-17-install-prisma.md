# Day 17 — Install Prisma

## Goal
Install **Prisma**, initialize it in `my-api`, and connect to your Postgres.

## Estimated time
~45 minutes.

## Where to put your code
In `my-api`.

## Explanation

**Prisma** = ORM + migration tool + type-safe client. Closest Laravel analogy: Eloquent + migrations, but the schema lives in a single `schema.prisma` file and the client is a fully typed API generated from it.

## Step-by-step

```bash
npm i -D prisma
npm i @prisma/client
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma`, `prisma.config.ts`, and adds `DATABASE_URL` to `.env`. In Prisma 7, the connection URL lives in `prisma.config.ts`; keep only the provider in `schema.prisma`:

```prisma name=prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}
```

Verify connectivity:
```bash
npx prisma db pull
# expected: "P4001 The introspected database was empty" — connection works.
```

Create a singleton client:

```ts name=src/db/prisma.ts
import { PrismaClient } from '@prisma/client';

export const prisma =
  (globalThis as any).__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  (globalThis as any).__prisma = prisma;
}
```

## Mini-task
Add a script `"db:studio": "prisma studio"` and run it (`npm run db:studio`) — it opens a GUI in the browser.

## Glossary
- **Prisma schema** — single source of truth for DB structure.
- **Prisma Client** — generated, type-safe DB API.
- **Prisma Studio** — GUI to browse data.

## Resources
- [Prisma docs](https://www.prisma.io/docs)
- [Prisma + Postgres quickstart](https://www.prisma.io/docs/getting-started/setup-prisma/start-from-scratch/relational-databases-typescript-postgresql)

## Checklist
- [x] `prisma init` ran successfully
- [x] `prisma db pull` connects
- [x] `prisma studio` opens
