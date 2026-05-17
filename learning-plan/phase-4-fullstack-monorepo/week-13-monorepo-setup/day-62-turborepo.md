# Day 62 — Turborepo

## Goal
Add Turborepo to `task-manager`, configure the task pipeline, and understand caching so `turbo build` only rebuilds what changed.

## Estimated time
~1.5 hours

## Prerequisites
Day 61 — `task-manager` pnpm workspace with `packages/types`.

## Where to put your code
In `task-manager/`.

## Explanation

**Turborepo** is a build system that understands the dependency graph between your workspace packages. When you run `turbo build`, it:
1. Reads each package's `package.json#scripts.build`.
2. Figures out which packages depend on which (from `workspace:*` deps).
3. Builds dependencies first, then dependents — in parallel where possible.
4. **Caches** every task's output. If inputs haven't changed, the cached output is replayed in milliseconds.

The cache is the key feature. Running `turbo build` a second time with no changes takes ~100ms regardless of how many packages you have — it just restores outputs from the cache.

The Laravel analogy: Turborepo is like running `php artisan optimize` — but instead of a single command that caches config, routes, and views, it's a pipeline orchestrator that caches the outputs of every build step across every package, and only re-runs the ones whose inputs changed.

## Step-by-step

### 1. Install Turborepo

```bash
# From task-manager root
pnpm add -Dw turbo
```

The `-w` flag installs to the root workspace.

### 2. `turbo.json`

```json name=turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "package.json", "tsconfig.json"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "**/*.test.ts", "**/*.test.tsx"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "inputs": ["src/**", "tsconfig.json"],
      "outputs": []
    },
    "lint": {
      "inputs": ["src/**", ".eslintrc*", "eslint.config.*"],
      "outputs": []
    }
  }
}
```

Key rules:
- **`"dependsOn": ["^build"]`** — the `^` means "run `build` in all dependencies first". So if `apps/web` depends on `packages/types`, `turbo build` builds `packages/types` first.
- **`"cache": false`** — `dev` should never be cached (it's a long-running watcher).
- **`"persistent": true`** — marks long-running tasks (dev servers); Turborepo knows not to wait for them to "finish".
- **`outputs`** — Turborepo caches these directories; restores them on cache hit.

### 3. Verify the pipeline

```bash
# Dry-run to see what would execute
pnpm turbo build --dry-run
```

Expected output shows the task graph: `packages/types#build` before `apps/api#build` and `apps/web#build`.

### 4. Remote caching (optional but powerful)

Turborepo can push cache to Vercel's cloud cache so CI and teammates share it:

```bash
pnpm turbo login
pnpm turbo link
```

After linking, `turbo build` in CI restores from the remote cache — even a fresh CI container skips rebuilding unchanged packages. For this course, local cache is sufficient.

### 5. Understanding `turbo.json` inputs

```json
"inputs": ["src/**", "package.json", "tsconfig.json"]
```

Turborepo hashes these files. If the hash matches a previous run, it's a cache hit. The hash includes environment variables too (useful to bust the cache when `NODE_ENV` changes).

Add environment variables to the hash:

```json name=turbo.json
{
  "globalEnv": ["NODE_ENV", "DATABASE_URL"]
}
```

### 6. Run all checks

Add a `packages/types/tsconfig.json` with `"noEmit": true` (types-only package, nothing to build). Then:

```bash
# From root
pnpm turbo typecheck
```

Expected: `packages/types` passes typecheck. Apps (empty for now) have no `typecheck` script yet, so they're skipped.

### 7. Cache demonstration

```bash
pnpm turbo build    # First run: actually builds
pnpm turbo build    # Second run: "FULL TURBO" — 100% cache hit
```

Change one file in `packages/types/src/index.ts` and run again — only `types` rebuilds.

## Test it

```bash
pnpm turbo typecheck --filter=@task-manager/types
```

`--filter` runs tasks only for the specified package. Useful when you only want to check one package without running everything.

## Mini-task
Add a `pnpm turbo lint` script. Create a root-level `prettier.config.js` and add a `format:check` script to root `package.json` that runs `prettier --check "**/*.{ts,tsx}"`.

## Glossary
- **Pipeline** — Turborepo's ordered task execution plan derived from `dependsOn`.
- **`^build`** — "run build in all workspace dependencies first" (topological order).
- **Cache hit** — task inputs unchanged; Turborepo restores outputs without running.
- **`--filter`** — Turborepo flag to scope tasks to specific packages.
- **Remote caching** — sharing the Turborepo cache across CI machines and team members.

## Resources
- [Turborepo docs](https://turbo.build/repo/docs)
- [Turborepo — Caching](https://turbo.build/repo/docs/crafting-your-repository/caching)
- [Turborepo — Running Tasks](https://turbo.build/repo/docs/crafting-your-repository/running-tasks)

## Checklist
- [ ] `turbo` installed at root workspace
- [ ] `turbo.json` with `build`, `dev`, `test`, `typecheck`, `lint` tasks
- [ ] `dependsOn: ["^build"]` ensures correct build order
- [ ] `pnpm turbo build --dry-run` shows correct task graph
- [ ] Second `pnpm turbo build` shows 100% cache hit
- [ ] `--filter` flag understood and tested
