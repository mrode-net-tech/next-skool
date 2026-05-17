# Day 61 — pnpm workspaces

## Goal
Create the `task-manager` monorepo with pnpm workspaces, understand the workspace protocol, and set up the folder structure that will host both apps and shared packages.

## Estimated time
~1.5 hours

## Prerequisites
`pnpm` installed globally (`npm i -g pnpm`). Days 1–20 (`my-api`) and Days 41–60 (`my-web`) complete.

## Where to put your code
New top-level directory: `task-manager/` (sibling of `my-api` and `my-web`).

## Explanation

A **monorepo** is a single git repository containing multiple packages and applications. Benefits: shared code without npm publishing, atomic commits across app and package changes, single CI pipeline. The tools that make it practical are a **workspace-aware package manager** (pnpm, yarn, npm) and a **build orchestrator** (Turborepo, Day 62).

**pnpm workspaces** link packages together using `workspace:*` instead of npm registry lookups. When `apps/web` declares `"@task-manager/types": "workspace:*"` as a dependency, pnpm symlinks `packages/types` from the local filesystem. No publishing step needed.

pnpm's **content-addressable store** means each version of each package is stored once on disk and hard-linked into `node_modules`. This makes `pnpm install` in a monorepo with 10 apps much faster and lighter than running `npm install` in each app individually.

The Laravel analogy: a monorepo is like a Lumen microservice setup where all services live in one repo and share a `composer.json`-registered local package path — but it's standard practice in the JS ecosystem, not a custom workaround.

## Step-by-step

### 1. Create the monorepo skeleton

```bash
mkdir task-manager && cd task-manager
mkdir -p apps/api apps/web packages/types packages/config-eslint packages/config-tsconfig
```

### 2. Root `package.json`

```json name=package.json
{
  "name": "task-manager",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "format": "prettier --write \"**/*.{ts,tsx,md}\""
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "prettier": "^3.0.0"
  },
  "engines": {
    "node": ">=18",
    "pnpm": ">=9"
  },
  "packageManager": "pnpm@9.0.0"
}
```

### 3. `pnpm-workspace.yaml`

```yaml name=pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

This tells pnpm to treat every directory under `apps/` and `packages/` as a workspace package.

### 4. Root `.gitignore`

```gitignore name=.gitignore
node_modules
dist
.turbo
*.log
.env
.env.local
```

### 5. `packages/types` — first shared package

```json name=packages/types/package.json
{
  "name": "@task-manager/types",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

```ts name=packages/types/src/index.ts
export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: 1 | 2 | 3;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}
```

```json name=packages/types/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

### 6. Install and link

```bash
# From the task-manager root
pnpm install
```

pnpm reads `pnpm-workspace.yaml`, discovers all packages, and creates a single `node_modules` at the root with symlinks for each workspace package.

### 7. Verify workspace linking

```bash
# List all workspace packages
pnpm ls --depth=-1
```

Expected output:
```
task-manager/
├── apps/api (empty yet)
├── apps/web (empty yet)
└── packages/types
```

### 8. The workspace protocol

To add `@task-manager/types` as a dependency in any app:

```bash
# From apps/api
pnpm add @task-manager/types --workspace
```

This adds `"@task-manager/types": "workspace:*"` to `apps/api/package.json`. The `workspace:*` protocol means "use whatever version is in the workspace — always up to date, no npm lookup".

When publishing to npm (not needed for this project), pnpm replaces `workspace:*` with the actual version number automatically.

## Test it

```bash
# From the root
pnpm install
pnpm ls --depth=-1

# Should see packages/types listed
```

```bash
# Typecheck the types package
cd packages/types
pnpm typecheck
```

## Mini-task
Add a `packages/config-tsconfig` package with a shared `base.json` tsconfig that all apps will extend. The base should have `"strict": true`, `"target": "ES2020"`, `"moduleResolution": "bundler"`.

## Glossary
- **Monorepo** — one git repo containing multiple packages and apps.
- **pnpm workspace** — a package managed by pnpm that can reference other local packages.
- **`workspace:*`** — protocol telling pnpm to use the local workspace version, not npm registry.
- **Content-addressable store** — pnpm's global cache; each package version stored once, hard-linked.
- **`pnpm ls`** — lists all workspace packages and their dependencies.

## Resources
- [pnpm — Workspaces](https://pnpm.io/workspaces)
- [pnpm — workspace: protocol](https://pnpm.io/workspaces#workspace-protocol-workspace)

## Checklist
- [ ] `task-manager/` directory created with correct subfolder structure
- [ ] `pnpm-workspace.yaml` lists `apps/*` and `packages/*`
- [ ] `packages/types` has `Task`, `User`, `PaginatedResponse` interfaces
- [ ] `pnpm install` at root succeeds
- [ ] `pnpm ls` shows all workspace packages
- [ ] Mini-task `config-tsconfig` package created
