# Day 104 — Image size optimization

## Goal
Reduce the `ai-folio` Docker image size using build cache mounts, precise `.dockerignore` rules, and layer analysis tools. After this day you know where image bloat comes from and how to measure and reduce it systematically.

## Estimated time
~1.5 hours

## Prerequisites
Day 103 (multi-stage Dockerfile working).

## Where to put your code
In `ai-folio`.

## Explanation

**Why image size matters:** Smaller images transfer faster from registry to host (faster CI deployments), start faster (less to decompress), and have a smaller attack surface (fewer packages = fewer CVEs). The difference between a 600 MB and a 150 MB image is noticeable in a CD pipeline that deploys on every push.

**Where size comes from in Next.js images:** The biggest contributors are (1) `node_modules` from `pnpm install`, (2) the Next.js build cache in `.next/cache`, and (3) base image size. Multi-stage builds (Day 103) solve (1). Build cache mounts solve (2). Picking `alpine` over the full Debian node image solves (3).

**`--mount=type=cache`** is a BuildKit feature that mounts a host-side cache directory into a `RUN` step. The directory is not included in the layer — it is only visible during that build step. pnpm's content-addressable store lives in `~/.local/share/pnpm/store` inside the container; caching it means subsequent builds download zero packages if the lockfile hasn't changed.

In Laravel terms, this is like caching the Composer `~/.composer/cache` directory in CI so `composer install` hits the local cache instead of the internet.

## Step-by-step

### 1. Analyse the current image with dive

`dive` is a CLI tool that visualises Docker layers and shows which files each layer adds.

```bash
# Install dive (Linux)
wget https://github.com/wagoodman/dive/releases/download/v0.12.0/dive_0.12.0_linux_amd64.deb
sudo dpkg -i dive_0.12.0_linux_amd64.deb

# Analyse the image
dive ai-folio:local
```

Use arrow keys to navigate layers. Look for `node_modules` and `.next/cache` — they are the largest contributors. The runner stage should not contain either.

### 2. Add a BuildKit cache mount for pnpm

Replace the `pnpm install` command in both `deps` and `builder` stages:

```dockerfile name=Dockerfile
# ─── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Stage 2: build the Next.js app ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN --mount=type=cache,id=next-cache,target=/app/.next/cache \
    pnpm build

# ─── Stage 3: production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs
USER nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public          ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

The cache mount `id=pnpm-store` is shared across builds. On a clean code change (lockfile unchanged), `pnpm install` completes in seconds because packages are already in the local store.

Enable BuildKit for docker build:

```bash
DOCKER_BUILDKIT=1 docker build -t ai-folio:local .
```

With Docker Desktop (or Docker Engine 23+), BuildKit is enabled by default.

### 3. Tighten .dockerignore

Every file sent to the build context costs time. Audit what is currently included:

```bash
# See what docker would send (dry run)
docker build --no-cache --progress=plain . 2>&1 | grep 'transferring context'
```

Extend `.dockerignore`:

```text name=.dockerignore
node_modules
.next
.git
.github
*.md
!README.md
.env*
.vscode
coverage
__tests__
*.test.ts
*.spec.ts
Dockerfile*
docker-compose*
.dockerignore
```

Excluding test files does not affect the build (they are not imported by production code) but they do add to the context transfer.

### 4. Pin the base image digest

Using `node:20-alpine` always pulls the latest `20-alpine` tag — which can change. Pin to a digest for reproducibility:

```bash
docker pull node:20-alpine
docker inspect node:20-alpine --format '{{index .RepoDigests 0}}'
# Example: node@sha256:abc123...
```

Update the Dockerfile:

```dockerfile name=Dockerfile
FROM node:20-alpine@sha256:<the-digest-here> AS deps
```

This guarantees every build uses the exact same base image, even if the tag is updated upstream.

### 5. Measure the result

```bash
DOCKER_BUILDKIT=1 docker build -t ai-folio:local .
docker image ls ai-folio:local

# Full breakdown
docker image history ai-folio:local --no-trunc
```

Typical result for a Next.js standalone app:
- Single-stage (Day 101): ~550 MB
- Multi-stage without cache mounts: ~160 MB
- Multi-stage with cache mounts: same final size, but rebuild time drops from ~60s to ~10s

Cache mounts improve build time; they do not change final image size. Final size is controlled by what you `COPY` into the runner stage.

## Test it

```bash
# Clean build (no cache)
DOCKER_BUILDKIT=1 docker build --no-cache -t ai-folio:local .
docker image ls ai-folio:local

# Second build (cache hit)
time DOCKER_BUILDKIT=1 docker build -t ai-folio:local .
```

The second build should finish in under 15 seconds if the lockfile has not changed. `docker image ls` should show a size under 200 MB.

## Mini-task
Run `docker scout quickview ai-folio:local` (requires Docker Desktop with Scout enabled) or `trivy image ai-folio:local` (install `trivy` separately) to scan the image for known CVEs. Note any HIGH or CRITICAL vulnerabilities and check if upgrading the base image to a newer patch version resolves them.

## Glossary
- **`--mount=type=cache`** — BuildKit feature that mounts a host-side cache directory into a `RUN` step without including it in the layer.
- **`dive`** — CLI tool for inspecting Docker image layers and identifying size contributors.
- **Build context** — files sent from the host to the Docker daemon at build time; controlled by `.dockerignore`.
- **Image digest** — content-addressable SHA256 hash of an image; pinning it ensures reproducible builds.
- **BuildKit** — modern Docker build backend; required for cache mounts and other advanced features.

## Resources
- [Docker — Build cache mounts](https://docs.docker.com/build/cache/optimize/#use-cache-mounts)
- [dive — GitHub](https://github.com/wagoodman/dive)
- [Docker Scout](https://docs.docker.com/scout/)
- [pnpm — Docker integration](https://pnpm.io/docker)

## Checklist
- [ ] `--mount=type=cache` added to `pnpm install` and `pnpm build` steps
- [ ] BuildKit enabled (`DOCKER_BUILDKIT=1` or Docker Engine 23+)
- [ ] `.dockerignore` excludes test files, Dockerfile, compose files
- [ ] Final runner image is under 200 MB
- [ ] Second build completes significantly faster than first (cache hit)
- [ ] (Optional) Base image pinned to digest
