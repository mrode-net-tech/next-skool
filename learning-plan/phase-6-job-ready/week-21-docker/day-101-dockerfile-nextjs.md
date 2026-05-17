# Day 101 — Dockerfile (Next.js)

## Goal
Write a working Dockerfile for `ai-folio`. After this day you can build and run the app inside a Docker container. You understand Dockerfile instructions, layer caching, and why the `standalone` output mode matters for production images.

## Estimated time
~1.5 hours

## Prerequisites
Day 100 (ai-folio MVP complete). Docker Desktop or Docker Engine installed locally.

## Where to put your code
In `ai-folio`.

## Explanation

**Docker** packages your app and its runtime into a portable image. Every environment — laptop, CI runner, production server — runs the same binaries. In Laravel terms, Docker replaces "works on my machine" and the Forge/Envoyer provisioning step: you ship one image instead of configuring PHP and nginx on each machine separately.

**Next.js standalone output** (`output: 'standalone'` in `next.config.ts`) tells `next build` to emit a self-contained Node server at `.next/standalone/server.js`. It copies only the required files — no `node_modules`, no unused packages — resulting in a lean runtime image.

**Dockerfile instructions** execute top-to-bottom; each creates a filesystem layer that Docker caches. Changing a layer invalidates all layers below it. This is why `COPY package.json` comes before `COPY . .` — package installs change rarely, source changes often. Only the source copy and build layers re-execute on each code change.

## Step-by-step

### 1. Enable standalone output

```ts name=next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

### 2. Create the Dockerfile

```dockerfile name=Dockerfile
FROM node:20-alpine
WORKDIR /app

# Enable pnpm via corepack (ships with Node 20)
RUN corepack enable pnpm

# Copy manifests first — this layer is cached when only src changes
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# Runtime configuration
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", ".next/standalone/server.js"]
```

This is a single-stage image: all layers including `node_modules` end up in the final image. Day 103 refactors this to multi-stage to shrink the size significantly.

### 3. Create .dockerignore

```text name=.dockerignore
node_modules
.next
.git
*.md
.env*
.vscode
coverage
```

Without `.dockerignore`, Docker sends `node_modules` (hundreds of MB) to the daemon on every `docker build`. With it, the build context contains only source files.

### 4. Build the image

```bash
docker build -t ai-folio:local .
```

First build is slow — dependency install and Next.js compile each take time. On subsequent runs where only source changes, Docker reuses the `pnpm install` cache layer and jumps straight to `pnpm build`.

### 5. Run the container

```bash
docker run -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e DATABASE_URL=postgresql://user:pass@host/db \
  -e NEXTAUTH_SECRET=some-long-secret \
  -e NEXTAUTH_URL=http://localhost:3000 \
  ai-folio:local
```

Environment variables are injected at runtime — never baked into the image. The same image runs in every environment; only the env vars differ.

### 6. Inspect the image

```bash
docker image ls ai-folio:local
docker image history ai-folio:local
```

`ls` shows total size. `history` shows each layer's size contribution. The `RUN pnpm install` layer is the largest — Day 103 removes it from the final image.

## Test it

```bash
docker build -t ai-folio:local .
docker run --rm -p 3000:3000 \
  -e ANTHROPIC_API_KEY=placeholder \
  -e DATABASE_URL=postgresql://dummy/dummy \
  -e NEXTAUTH_SECRET=testsecret \
  -e NEXTAUTH_URL=http://localhost:3000 \
  ai-folio:local
```

Open `http://localhost:3000`. Portfolio homepage loads from inside Docker. Terminal logs `Ready on http://localhost:3000`.

## Mini-task
Edit `next.config.ts` to add `reactStrictMode: true` alongside `output: 'standalone'`. Rebuild. Notice Docker reuses the `pnpm install` cache layer because `package.json` did not change — only the layers after `COPY . .` re-execute.

## Glossary
- **Docker image** — read-only snapshot; the blueprint for containers.
- **Docker container** — running instance of an image; isolated process.
- **Layer** — filesystem delta produced by one Dockerfile instruction; cached independently.
- **Standalone output** — Next.js build mode that emits a self-contained Node HTTP server.
- **EXPOSE** — documents which port the container listens on; does not publish it to the host without `-p`.

## Resources
- [Next.js — Docker deployment](https://nextjs.org/docs/app/building-your-application/deploying#docker-image)
- [Docker — Dockerfile reference](https://docs.docker.com/reference/dockerfile/)
- [node:alpine on Docker Hub](https://hub.docker.com/_/node)

## Checklist
- [ ] `output: 'standalone'` in `next.config.ts`
- [ ] `Dockerfile` builds without errors
- [ ] `.dockerignore` excludes `node_modules`, `.next`, `.env*`
- [ ] Container starts and serves homepage on port 3000
- [ ] Env vars passed at runtime, no secrets in the Dockerfile
