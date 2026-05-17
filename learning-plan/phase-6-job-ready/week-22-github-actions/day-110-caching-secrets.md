# Day 110 — Caching + secrets

## Goal
Optimise the CI pipeline with granular caching strategies and review GitHub Actions security practices for secrets. After this day your CI runs are 2–3× faster on cache hits and secrets are handled correctly — no accidental log exposure, no overly-broad permissions.

## Estimated time
~1.5 hours

## Prerequisites
Day 109 (build + deploy job working). Full `ci.yml` with lint, typecheck, test, deploy jobs.

## Where to put your code
In `ai-folio`, inside `.github/workflows/`.

## Explanation

**Cache invalidation** in GitHub Actions works on cache keys. A key is a string; if it matches a previously stored cache, the artifact is restored. A miss falls back to `restore-keys` (a prefix list) — this gives a partial cache restore when the lockfile changes (you restore an old node_modules, then `pnpm install` only installs the delta). In Laravel terms, this is like a CDN with cache-control: exact match serves the full cache; prefix match serves a stale cache that gets updated inline.

**Secrets security** has three rules in Actions:
1. Never print secrets with `echo $SECRET` — GitHub masks known secret values in logs but this is a best-effort defence, not a guarantee.
2. Use `permissions:` to grant the minimum token scope needed per job.
3. Set `ACTIONS_STEP_DEBUG: false` (the default) — debug mode prints all env vars including secrets.

**`pull_request` vs `push` events and secrets:** Secrets are available in workflows triggered by `push` on your own repository. For `pull_request` events from forks, GitHub strips secret access (forks would otherwise be able to exfiltrate your keys). This is why the deploy job uses `if: github.event_name == 'push'` — it never runs for PRs, so it never needs fork-safe secret handling.

## Step-by-step

### 1. Understand the current cache setup

The `actions/setup-node` with `cache: 'pnpm'` creates a cache keyed on `pnpm-lock.yaml`. This covers the pnpm store. But the Docker layer cache (from Day 109) uses a separate `type=gha` backend.

Inspect cache usage:

**Actions tab** → any run → **Cache** section in the left sidebar (GitHub shows cache usage). Or use the `gh` CLI:

```bash
gh cache list --repo <owner>/ai-folio
```

### 2. Add restore-keys for pnpm

When `pnpm-lock.yaml` changes, the exact cache key misses. Without `restore-keys`, a full `pnpm install` runs. With them, a partial cache from the previous lockfile restores and only new packages download.

Replace `actions/setup-node` in every job with an explicit cache step:

```yaml name=.github/workflows/ci.yml
      - name: Get pnpm store directory
        id: pnpm-store
        run: echo "dir=$(pnpm store path)" >> $GITHUB_OUTPUT

      - uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-store.outputs.dir }}
          key: pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
          restore-keys: |
            pnpm-${{ runner.os }}-
```

Keep `actions/setup-node` but remove `cache: 'pnpm'` since you now manage the cache manually for more control.

### 3. Cache Next.js build output

The `pnpm build` step is the slowest CI step. Next.js has an incremental build cache in `.next/cache`. Cache it between runs:

```yaml name=.github/workflows/ci.yml
      - uses: actions/cache@v4
        with:
          path: .next/cache
          key: nextjs-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-${{ hashFiles('src/**/*.ts', 'src/**/*.tsx') }}
          restore-keys: |
            nextjs-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-
            nextjs-${{ runner.os }}-
```

Add this before the `pnpm build` step. On a warm cache, `pnpm build` skips unchanged pages and components — build time drops from ~60 seconds to ~15 seconds for typical changes.

### 4. Set minimal job permissions

GitHub Actions grants broad `GITHUB_TOKEN` permissions by default. Narrow them:

```yaml name=.github/workflows/ci.yml
# At the workflow level — default for all jobs
permissions:
  contents: read

jobs:
  lint:
    # inherits contents: read — no other permissions needed
    ...

  deploy:
    permissions:
      contents: read
      packages: write   # needed for GHCR push only
    ...
```

If an Action in the lint job is compromised, it cannot push to GHCR or create releases — it only has read access to the repository.

### 5. Audit secret usage

Review every `${{ secrets.* }}` reference in your workflow:

```bash
grep -r 'secrets\.' .github/workflows/
```

For each secret ask:
- Is it used in the right job? (e.g., `ANTHROPIC_API_KEY` should only be in `test` and `deploy`, not in `lint`)
- Is it printed anywhere with `echo`? (remove if so)
- Is it in a `run:` step that might fail and dump its environment? (add `|| true` carefully)

### 6. Use environment protection rules for production secrets

For the `FLY_API_TOKEN` and production `DATABASE_URL`, create a GitHub **Environment** named `production`:

**Settings** → **Environments** → **New environment** → `production` → **Required reviewers** (add yourself).

Move production secrets to the environment:

```yaml name=.github/workflows/ci.yml
  deploy:
    environment: production    # activates required reviewers gate
    ...
```

Now every deploy to production requires a manual approval in the GitHub UI. Reviewers get an email; they click Approve in the Actions run. No reviewer approval = no deploy.

## Test it

Make a small code change, push to `main`. In the Actions tab:

1. Check the cache hit rate on the `lint` and `typecheck` jobs (look for `Cache restored from key: pnpm-ubuntu-<hash>`)
2. On the second push (warm cache), compare total job time vs the first run
3. If you added environment protection: confirm the deploy job pauses at `Waiting for review` and only proceeds after you approve

```bash
gh cache list --repo <owner>/ai-folio
```

Expected: entries for `pnpm-ubuntu-*` and `nextjs-ubuntu-*` with sizes shown.

## Mini-task
Add a workflow that automatically deletes stale caches older than 7 days. Use the `actions/cache` API via the `gh` CLI in a scheduled workflow (`on: schedule: - cron: '0 2 * * 0'` — every Sunday at 2 AM UTC). This prevents GitHub's 10 GB cache limit from being exhausted by old lockfile-keyed entries.

## Glossary
- **Cache key** — exact string used to store and retrieve a cache artifact; a hash of the lockfile is the canonical key for dependencies.
- **`restore-keys`** — fallback prefix list; on a cache miss, GitHub restores the most recent cache whose key starts with the prefix.
- **`permissions:`** — narrows the `GITHUB_TOKEN` scope for a workflow or job; principle of least privilege.
- **GitHub Environment** — a deployment target with its own secrets, protection rules, and approval gates.
- **`hashFiles()`** — GitHub Actions expression that returns a SHA-256 hash of matched files; used to build cache keys.

## Resources
- [GitHub Actions — caching](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [GitHub Actions — security hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [GitHub Actions — environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)

## Checklist
- [ ] pnpm store cache uses `restore-keys` for partial hits on lockfile changes
- [ ] `.next/cache` cached between runs keyed on lockfile + source file hash
- [ ] `permissions: contents: read` set at workflow level
- [ ] `deploy` job has `packages: write` permission only
- [ ] No secrets printed via `echo` in any step
- [ ] `production` GitHub Environment created with required reviewer for deploy job
- [ ] Second CI run faster than first (cache hit confirmed in step logs)
