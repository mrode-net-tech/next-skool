# Day 63 — Move my-api into apps/api

## Goal
Migrate `my-api` into `apps/api` inside the monorepo, wire it to use `@task-manager/types`, update imports, and verify all tests still pass.

## Estimated time
~2 hours

## Prerequisites
Day 62 — Turborepo configured. `my-api` from Days 1–20 working with all tests green.

## Where to put your code
In `task-manager/apps/api/`.

## Explanation

Moving an existing project into a monorepo is mostly mechanical: copy files, update `package.json` name and scripts, fix import paths, add `workspace:*` deps for shared packages. The tricky part is that `my-api` had its own `node_modules` — inside the monorepo, pnpm hoists everything to the root `node_modules`. You may need to re-run `pnpm install` to hoist correctly.

After migration, `apps/api` should be self-contained: `pnpm --filter @task-manager/api dev` starts just the API. But it also participates in the monorepo pipeline: `turbo dev` starts all apps in parallel.

## Step-by-step

### 1. Copy `my-api` files into `apps/api`

```bash
# From task-manager root
cp -r ../my-api/src apps/api/
cp ../my-api/prisma apps/api/
cp ../my-api/.env apps/api/
cp ../my-api/tsconfig.json apps/api/
```

Do NOT copy `node_modules` or `package-lock.json`.

### 2. Create `apps/api/package.json`

```json name=apps/api/package.json
{
  "name": "@task-manager/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "@task-manager/types": "workspace:*",
    "cors": "^2.8.5",
    "express": "^4.18.0",
    "reflect-metadata": "^0.1.13",
    "tsyringe": "^4.8.0",
    "winston": "^3.11.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.0",
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/supertest": "^6.0.0",
    "prisma": "^5.0.0",
    "supertest": "^7.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

### 3. Update `tsconfig.json`

```json name=apps/api/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "paths": {
      "@task-manager/types": ["../../packages/types/src/index.ts"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

```json name=apps/api/tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "paths": {}
  }
}
```

The `tsconfig.build.json` removes `paths` overrides when building for production — at build time, `@task-manager/types` is resolved through pnpm symlinks, not the path alias.

### 4. Update type imports in `apps/api/src`

Replace the local `Task` type definitions with imports from the shared package:

```ts name=apps/api/src/tasks/domain/task.entity.ts
import type { Task } from '@task-manager/types';

// Re-export or use directly — Task interface now comes from the shared package
export type { Task };
```

Any file that previously defined or imported a local `Task` interface should now use `@task-manager/types`.

### 5. Install dependencies

```bash
# From task-manager root
pnpm install
```

pnpm resolves `"@task-manager/types": "workspace:*"` to the local package.

### 6. Verify the `.env` is correct

`apps/api/.env` should still point to the same Postgres instance:

```env name=apps/api/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tasks_db"
NODE_ENV=development
PORT=3000
```

### 7. Run the API

```bash
# From task-manager root
pnpm --filter @task-manager/api dev
```

Or from `apps/api`:
```bash
pnpm dev
```

Test endpoints:
```bash
curl http://localhost:3000/tasks
```

### 8. Run tests

```bash
pnpm --filter @task-manager/api test
```

All Vitest + Supertest tests from Phase 1–2 should still pass.

### 9. Add to Turborepo `build` output

`apps/api` compiles TypeScript to `dist/`. Turborepo already caches `dist/**` per `turbo.json`.

```bash
# From root
pnpm turbo build --filter=@task-manager/api
```

## Test it

```bash
# Full check from root
pnpm --filter @task-manager/api test
pnpm --filter @task-manager/api typecheck
```

Expected: all tests pass, no TypeScript errors.

```bash
curl -X POST http://localhost:3000/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Monorepo test","priority":2}'
```

## Mini-task
Add a `Dockerfile` in `apps/api` for later (Day 78):
```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm i -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
CMD ["node", "dist/index.js"]
```

## Glossary
- **`--filter`** — pnpm/Turborepo flag to scope commands to a specific workspace package.
- **`workspace:*`** — references local package at whatever version it currently is.
- **pnpm hoisting** — pnpm installs packages to root `node_modules` when possible; workspace packages symlinked.
- **`tsconfig.build.json`** — separate tsconfig for production compilation, without dev-only aliases.

## Resources
- [pnpm — Filtering](https://pnpm.io/filtering)
- [Turborepo — Migrating to a Monorepo](https://turbo.build/repo/docs/getting-started/existing-monorepo)

## Checklist
- [ ] `my-api` files copied to `apps/api/`
- [ ] `apps/api/package.json` with correct name `@task-manager/api`
- [ ] `@task-manager/types` added as `workspace:*` dep
- [ ] Type imports updated to use shared package
- [ ] `pnpm install` from root succeeds
- [ ] API starts: `pnpm --filter @task-manager/api dev`
- [ ] All Vitest tests pass
