# Day 107 — Lint + typecheck job

## Goal
Add a CI job that runs ESLint and TypeScript type checking on every push and pull request. After this day, broken types or lint violations block merges to `main` automatically — no manual review needed to catch these classes of error.

## Estimated time
~1.5 hours

## Prerequisites
Day 106 (GitHub Actions basics). ESLint and TypeScript configured in `ai-folio`.

## Where to put your code
In `ai-folio`, inside `.github/workflows/`.

## Explanation

**CI gates on PRs** work by setting branch protection rules: GitHub blocks merging if any required status check fails. Once `lint-typecheck` is a required check on `main`, nobody (including you) can merge broken TypeScript or lint violations. In Laravel terms, this is like Larastan/PHPStan blocking a deploy pipeline — the CI server enforces what your IDE only warns about.

**pnpm caching** is critical in CI. Without it, `pnpm install` downloads the entire dependency tree on every run (~30–90 seconds). With the official pnpm setup action and GitHub's cache store, only changed packages are downloaded. Cache key is derived from the lockfile hash: if `pnpm-lock.yaml` is unchanged, the full cache is restored in seconds.

**Separate jobs vs steps**: running lint and typecheck as separate jobs means they run in parallel (GitHub starts both runners simultaneously). Each fails independently — you see which one broke without waiting for the other. The trade-off is a cold cache mount per job. For a fast CI signal, parallel jobs are usually preferred.

## Step-by-step

### 1. Ensure lint and typecheck scripts exist

```json name=package.json
{
  "scripts": {
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  }
}
```

Verify locally:

```bash
pnpm lint
pnpm typecheck
```

Both must exit 0 before setting up CI — fix any pre-existing errors first.

### 2. Create the CI workflow

```yaml name=.github/workflows/ci.yml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: ['main']

jobs:
  lint:
    name: ESLint
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ESLint
        run: pnpm lint

  typecheck:
    name: TypeScript
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run type check
        run: pnpm typecheck
```

`actions/setup-node@v4` with `cache: 'pnpm'` automatically caches the pnpm store between runs using `pnpm-lock.yaml` as the cache key.

### 3. Reuse steps with a composite action (optional refactor)

Both jobs share identical setup steps. Extract them to avoid duplication:

```yaml name=.github/actions/setup-pnpm/action.yml
name: Setup pnpm
description: Checkout, setup pnpm, install dependencies

runs:
  using: composite
  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v4
      with:
        version: 9

    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'pnpm'

    - name: Install dependencies
      run: pnpm install --frozen-lockfile
      shell: bash
```

Use it in `ci.yml`:

```yaml name=.github/workflows/ci.yml
  lint:
    name: ESLint
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/setup-pnpm
      - run: pnpm lint
```

Note: composite actions in the same repository are referenced with a relative path (`uses: ./.github/actions/setup-pnpm`). The repository must be checked out first — but for local composite actions this step is implicit.

### 4. Enable branch protection on main

In GitHub: **Settings** → **Branches** → **Add rule** → branch name pattern: `main`:

- Check **Require status checks to pass before merging**
- Search for and add `ESLint` and `TypeScript`
- Check **Require branches to be up to date before merging**

Now no PR can merge to `main` unless both jobs are green.

### 5. Verify failure behaviour

Introduce a deliberate type error:

```ts name=src/app/page.tsx
// Add at the top of any component
const bad: number = 'this is not a number';
```

Commit and push to a branch. Open a PR to `main`. Watch the TypeScript job fail and block the merge button.

Revert the change, push again, confirm green.

## Test it

Push to a new branch, open a PR to `main`. Both jobs (`ESLint` and `TypeScript`) should appear as required checks. Both should pass within 2–3 minutes (first run with cold cache), under 1 minute on subsequent runs.

Check the cache hit rate:

In the Actions run → `Install dependencies` step look for: `Already up to date` (full cache hit) or downloaded package count (partial hit).

## Mini-task
Add a third job called `format-check` that runs `pnpm prettier --check .` (install Prettier if not already present). Make it required on `main`. This enforces consistent formatting across the team without any code-review comments.

## Glossary
- **Status check** — a pass/fail signal attached to a commit; GitHub branch protection can require them to pass before merging.
- **`pnpm/action-setup`** — official GitHub Action that installs a specific version of pnpm on the runner.
- **Cache key** — a hash string; if the same key exists in GitHub's cache store, the cached artifact is restored. A lockfile hash is the canonical cache key for dependencies.
- **Composite action** — a reusable collection of steps defined in an `action.yml` file; can be called from workflows with `uses:`.
- **Branch protection rule** — GitHub setting that enforces policies (required checks, reviews, etc.) on a branch before merging.

## Resources
- [GitHub Actions — caching dependencies](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [pnpm/action-setup](https://github.com/pnpm/action-setup)
- [GitHub — branch protection rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

## Checklist
- [ ] `pnpm lint` and `pnpm typecheck` run cleanly locally
- [ ] `.github/workflows/ci.yml` has `lint` and `typecheck` jobs running in parallel
- [ ] pnpm store cached via `actions/setup-node` `cache: 'pnpm'`
- [ ] Both jobs appear as status checks on PRs
- [ ] Branch protection requires both checks to pass before merging to `main`
- [ ] Deliberate type error correctly blocks a PR merge
