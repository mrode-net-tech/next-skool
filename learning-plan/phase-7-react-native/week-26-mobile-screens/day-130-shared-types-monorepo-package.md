# Day 130 — Shared types monorepo package

## Goal
Extract the shared tRPC types into a proper `packages/trpc-client` package in a pnpm workspace. After this day the `AppRouter` type is a versioned, independently importable package — not a relative cross-project import. Both `ai-folio` and `ai-folio-mobile` depend on this package.

## Estimated time
~2 hours

## Prerequisites
Day 129 (all mobile screens working). Day 61–62 (pnpm workspaces + Turborepo concepts from Phase 4).

## Where to put your code
New: `packages/trpc-client/`. Edits in `ai-folio/` and `ai-folio-mobile/`.

## Explanation

**Why move from relative imports to a package?** The direct `import type { AppRouter } from '../../ai-folio/src/...'` path worked for development but is fragile: it assumes both repos are siblings on the filesystem, it breaks in CI (different checkout paths), and it gives consumers no control over versioning. A monorepo package (`@ai-folio/trpc-client`) is importable by name, version-controllable, and can be published to npm if needed.

**What goes in the package:** only the `AppRouter` type export and the tRPC client factory. No Prisma models, no server-side code, no Auth.js — those stay in `ai-folio`. The package is thin: one type export + a factory function that constructs the typed tRPC client given a URL.

**pnpm workspace protocol:** `"@ai-folio/trpc-client": "workspace:*"` in a `package.json` tells pnpm to link the local package instead of fetching from npm. `workspace:*` means "any version from the workspace". This is the same pattern you used in Phase 4's `task-manager` monorepo.

## Step-by-step

### 1. Create the workspace root

If `ai-folio` and `ai-folio-mobile` are already siblings, create a workspace root above them:

```
ai-folio-workspace/
  pnpm-workspace.yaml
  package.json
  packages/
    trpc-client/
  apps/
    ai-folio/         ← symlink or move
    ai-folio-mobile/  ← symlink or move
```

If restructuring is too disruptive now, keep them as siblings and add `pnpm-workspace.yaml` at the common parent:

```yaml name=pnpm-workspace.yaml
packages:
  - 'ai-folio'
  - 'ai-folio-mobile'
  - 'packages/*'
```

```json name=package.json
{
  "name": "ai-folio-workspace",
  "private": true,
  "engines": { "node": ">=20" }
}
```

### 2. Create the trpc-client package

```bash
mkdir -p packages/trpc-client/src
```

```json name=packages/trpc-client/package.json
{
  "name": "@ai-folio/trpc-client",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "peerDependencies": {
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "@tanstack/react-query": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

```json name=packages/trpc-client/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "dist",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### 3. Write the package source

The package exports the `AppRouter` type and a factory. It does NOT import any server code:

```ts name=packages/trpc-client/src/index.ts
// Type-only re-export from the ai-folio project
// This import is resolved at workspace install time, not bundled
export type { AppRouter } from '../../ai-folio/src/lib/trpc/router';

import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../ai-folio/src/lib/trpc/router';

export const createTRPCClient = (baseUrl: string) => {
  const trpc = createTRPCReact<AppRouter>();

  const client = trpc.createClient({
    links: [
      httpBatchLink({
        url: `${baseUrl}/api/trpc`,
        headers: async () => {
          // Token injection hook — caller provides getToken
          return {};
        },
      }),
    ],
  });

  return { trpc, client };
};

// Factory with token injection support
export const createTRPCClientWithAuth = (
  baseUrl: string,
  getToken: () => Promise<string | null>
) => {
  const trpc = createTRPCReact<AppRouter>();

  const client = trpc.createClient({
    links: [
      httpBatchLink({
        url: `${baseUrl}/api/trpc`,
        headers: async () => {
          const token = await getToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });

  return { trpc, client };
};
```

### 4. Add the package to both apps

```json name=ai-folio/package.json
{
  "dependencies": {
    "@ai-folio/trpc-client": "workspace:*"
  }
}
```

```json name=ai-folio-mobile/package.json
{
  "dependencies": {
    "@ai-folio/trpc-client": "workspace:*"
  }
}
```

Run `pnpm install` from the workspace root to link packages.

### 5. Update ai-folio-mobile to use the package

```ts name=ai-folio-mobile/src/lib/trpc.ts
import { createTRPCClientWithAuth } from '@ai-folio/trpc-client';
import { QueryClient } from '@tanstack/react-query';
import { authStore } from './auth';
import { API_URL } from './config';

export { trpc } from '@ai-folio/trpc-client';  // re-export for convenience

const { trpc, client: trpcClient } = createTRPCClientWithAuth(
  API_URL,
  () => authStore.getToken()
);

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 2 } },
});

export { trpcClient };
```

All `import { trpc }` statements in screens now come from `@ai-folio/trpc-client` — fully typed, no relative cross-project paths.

### 6. Build the package

```bash
cd packages/trpc-client
pnpm build
```

The `dist/` directory contains compiled JavaScript and type declarations. Both apps import from `dist/`.

In development, run `pnpm dev` in the `trpc-client` package to watch for changes.

## Test it

```bash
# From workspace root
pnpm install

# Build the package
cd packages/trpc-client && pnpm build && cd ../..

# Run mobile app — should import AppRouter from the package now
cd ai-folio-mobile && npx expo start
```

Open the Conversations screen — data loads as before. In VS Code, hover over a tRPC call and verify the type is `AppRouter` from `@ai-folio/trpc-client`, not a relative import.

```bash
# TypeScript check across all workspaces
cd ai-folio-mobile && npx tsc --noEmit
cd ai-folio && npx tsc --noEmit
cd packages/trpc-client && npx tsc --noEmit
```

All three should pass.

## Mini-task
Add `Turborepo` to the workspace root (Day 62 showed how). Create a `turbo.json` with a `build` pipeline that builds `packages/trpc-client` before building `ai-folio` and `ai-folio-mobile`. This ensures the types are always compiled before the apps that depend on them.

## Glossary
- **pnpm workspace protocol** — `workspace:*` in a `package.json` dependency; resolves to the local package in the monorepo instead of fetching from npm.
- **`peerDependencies`** — dependencies the package needs but expects the consumer to provide; avoids duplicate copies of React, tRPC, etc.
- **`exports` field** — modern `package.json` field that controls what consumers can import from the package; more precise than `main`.
- **Type-only export** — `export type { AppRouter }` exports only the TypeScript type; no JavaScript code is included in the bundle.
- **`workspace:*`** — pnpm workspace version specifier; matches any version of the local package.

## Resources
- [pnpm — workspaces](https://pnpm.io/workspaces)
- [tRPC — monorepo setup](https://trpc.io/docs/client/nextjs/setup#optional-use-server-side-helpers)
- [Turborepo — getting started](https://turbo.build/repo/docs/getting-started/create-new)

## Checklist
- [ ] `pnpm-workspace.yaml` defined at repository root
- [ ] `packages/trpc-client/` package created with correct `package.json` and `tsconfig.json`
- [ ] `AppRouter` type exported from the package
- [ ] `createTRPCClientWithAuth` factory accepts `baseUrl` and `getToken`
- [ ] Both `ai-folio` and `ai-folio-mobile` depend on `@ai-folio/trpc-client: workspace:*`
- [ ] `pnpm install` links packages; relative cross-project imports removed
- [ ] All three TypeScript projects pass `tsc --noEmit`
