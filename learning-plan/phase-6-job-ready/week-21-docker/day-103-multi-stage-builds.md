# Day 103 — Multi-stage builds

## Goal
Refactor the single-stage Dockerfile from Day 101 into a multi-stage build. After this day the final Docker image contains only the compiled Next.js output — not `node_modules`, not build tools — cutting image size by 60–70%.

## Estimated time
~1.5 hours

## Prerequisites
Day 101 (single-stage Dockerfile working). Day 102 (docker-compose context helpful).

## Where to put your code
In `ai-folio`.

## Explanation

**Multi-stage builds** let you use multiple `FROM` statements in one Dockerfile. Each `FROM` starts a new stage with a fresh filesystem. You `COPY --from=<stage>` specific artefacts into the final stage, discarding everything else. In Laravel terms: build stage compiles assets and runs `composer install`; runner stage gets only `public/`, `vendor/`, and `bootstrap/` — not your dev dependencies or the node build process.

The pattern for Next.js standalone has three stages:
1. **deps** — install all dependencies (including devDependencies needed for build).
2. **builder** — compile the app with `next build`.
3. **runner** — copy only the standalone output; no `node_modules`, no source, no build tools.

The `runner` stage is the only stage that ships as the final image. Its size is determined only by what you explicitly copy into it.

**Why `node:20-alpine`?** Alpine Linux is a minimal distro (~5 MB base). Combined with standalone output the `runner` stage often lands under 150 MB versus 600+ MB for a naive single-stage build.

## Step-by-step

### 1. Replace the Dockerfile

```dockerfile name=Dockerfile
# ─── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ─── Stage 2: build the Next.js app ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next build reads NEXT_PUBLIC_* vars at build time — pass them as build args if needed
RUN pnpm build

# ─── Stage 3: production runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Run as non-root for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs
USER nextjs

# Copy only what Next.js standalone needs to run
COPY --from=builder --chown=nextjs:nodejs /app/public               ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone      ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static          ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

The three stages are named (`AS deps`, `AS builder`, `AS runner`) so `COPY --from=` can reference them by name. Names are clearer than stage indices.

### 2. Understand what gets copied into runner

```bash
# After build, inspect what standalone contains
docker run --rm ai-folio:local sh -c "ls -la"
```

You will see `server.js`, `node_modules/` (a minimal set — only what Next.js requires at runtime, not build tools), and `.next/`. Compare the runner's `node_modules` to the builder's full set — they differ significantly.

### 3. Rebuild and compare sizes

```bash
docker build -t ai-folio:local .
docker image ls | grep ai-folio
```

Compare against the single-stage size from Day 101. The multi-stage image should be substantially smaller.

### 4. Pass build-time env vars (NEXT_PUBLIC_*)

`NEXT_PUBLIC_*` variables are inlined into the JavaScript bundle at build time, not at runtime. Pass them via `ARG`:

```dockerfile name=Dockerfile
# (add inside the builder stage, before RUN pnpm build)
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
```

Then supply them during `docker build`:

```bash
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=https://ai-folio.fly.dev \
  -t ai-folio:prod .
```

Runtime env vars (`ANTHROPIC_API_KEY`, `DATABASE_URL`, etc.) do not need build args — they are read by Node at startup from the environment.

### 5. Verify non-root user

```bash
docker run --rm ai-folio:local whoami
```

Expected: `nextjs`. Running as root inside a container is a security risk — if the process is compromised, an attacker has root on the container filesystem. The `adduser` / `USER` instructions drop privileges before `CMD`.

### 6. Update docker-compose target

In `docker-compose.yml` the `app.build.target` already points to `runner`:

```yaml name=docker-compose.yml
  app:
    build:
      context: .
      target: runner
```

docker-compose only builds up to the named stage and uses that as the image, so `deps` and `builder` intermediate layers are not run when you use `target: runner` — docker-compose resolves the full build graph and builds all stages needed.

## Test it

```bash
docker build -t ai-folio:local .
docker run --rm ai-folio:local whoami           # → nextjs
docker run --rm ai-folio:local node --version   # → v20.x.x
docker image ls ai-folio:local                  # check size
```

Run the full app:

```bash
docker run --rm -p 3000:3000 \
  -e ANTHROPIC_API_KEY=placeholder \
  -e DATABASE_URL=postgresql://dummy/dummy \
  -e NEXTAUTH_SECRET=testsecret \
  -e NEXTAUTH_URL=http://localhost:3000 \
  ai-folio:local
```

Homepage loads. No errors in the terminal.

## Mini-task
Add a fourth intermediate stage named `test` between `builder` and `runner`. In it run `pnpm test --run` (or `pnpm typecheck`). The `runner` stage still copies from `builder`. Build with `--target runner` — Docker only executes stages up to the one you target, but if `test` is in the dependency graph of `runner`, it will run. Experiment with `--target test` to see the test output in CI.

## Glossary
- **Multi-stage build** — Dockerfile with multiple `FROM` statements; only the final stage ships as the image.
- **`COPY --from=<stage>`** — copies files from a named intermediate stage into the current stage.
- **`AS <name>`** — names a stage so it can be referenced in `COPY --from=` or `--target`.
- **`--target <stage>`** — tells `docker build` to stop at a specific stage.
- **Non-root user** — best practice: add a system user and `USER <name>` before `CMD` to drop root privileges.

## Resources
- [Docker — Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Next.js — Dockerfile with multi-stage](https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile)
- [Docker security — non-root user](https://docs.docker.com/develop/security-best-practices/)

## Checklist
- [ ] Dockerfile has three named stages: `deps`, `builder`, `runner`
- [ ] `runner` stage copies only standalone output — no full `node_modules`
- [ ] `USER nextjs` in `runner` stage (non-root)
- [ ] Multi-stage image is smaller than Day 101 single-stage image
- [ ] `NEXT_PUBLIC_*` vars handled via `ARG` in `builder` stage
- [ ] Full app runs from multi-stage image
