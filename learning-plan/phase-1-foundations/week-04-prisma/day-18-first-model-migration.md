# Day 18 — First model + migration

## Goal
Define the `Task` model in Prisma, run your first **migration**, regenerate the client.

## Estimated time
~45 minutes.

## Where to put your code
In `my-api`.

## Explanation

A **migration** in Prisma is a versioned SQL file Prisma generates from your schema diff. Closest Laravel analogy: `php artisan make:migration` + `migrate`, but you don't write SQL by hand — Prisma diffs the schema and creates the SQL for you.

## Step-by-step

```prisma name=prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

model Task {
  id        String   @id @default(cuid())
  title     String
  done      Boolean  @default(false)
  priority  Int      @default(2)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Run the first migration:
```bash
npx prisma migrate dev --name init
```

This:
1. creates `prisma/migrations/<timestamp>_init/migration.sql`
2. applies it to the dev DB
3. regenerates `@prisma/client`

## Mini-task
Add a `description String?` (nullable) field, run `npx prisma migrate dev --name task_description`, inspect the generated SQL.

## Glossary
- **Migration** — versioned schema change file.
- **`@id`, `@default`, `@updatedAt`** — Prisma attributes for fields.
- **`cuid`** — collision-resistant unique ID.

## Resources
- [Prisma — Migrate](https://www.prisma.io/docs/orm/prisma-migrate)
- [Prisma schema reference](https://www.prisma.io/docs/orm/prisma-schema)

## Checklist
- [x] Migration created in `prisma/migrations/`
- [x] DB has a `Task` table (verify in Studio)
- [x] You added a second migration
