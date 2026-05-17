# Day 64 — Move my-web into apps/web

## Goal
Migrate `my-web` into `apps/web`, update it to import shared types from `@task-manager/types`, and verify the full dev stack starts from the monorepo root.

## Estimated time
~1.5 hours

## Prerequisites
Day 63 — `apps/api` migrated and working. Day 60 — `my-web` complete.

## Where to put your code
In `task-manager/apps/web/`.

## Explanation

Migrating the web app is structurally the same as Day 63 for the API, but with one important difference: Vite uses **esbuild** (not `tsc`) for module resolution, so the `paths` alias `@task-manager/types` needs to be declared in both `tsconfig.json` (for type-checking) and `vite.config.ts` (for bundling). This is a common gotcha — the TypeScript config and the bundler config are independent.

After migration, the local type duplication (`src/types/task.ts`) is deleted and replaced with the shared package import. This is the payoff from Day 61's setup.

## Step-by-step

### 1. Copy `my-web` files into `apps/web`

```bash
cp -r ../my-web/src apps/web/
cp ../my-web/index.html apps/web/
cp ../my-web/tsconfig.json apps/web/
cp ../my-web/tsconfig.node.json apps/web/
cp ../my-web/vite.config.ts apps/web/
cp ../my-web/tailwind.config.js apps/web/
cp ../my-web/postcss.config.js apps/web/
```

### 2. Create `apps/web/package.json`

```json name=apps/web/package.json
{
  "name": "@task-manager/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.0.0",
    "@radix-ui/react-dialog": "^1.0.0",
    "@radix-ui/react-label": "^2.0.0",
    "@radix-ui/react-select": "^2.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-query-devtools": "^5.0.0",
    "@task-manager/types": "workspace:*",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "lucide-react": "^0.400.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.0.0",
    "react-router-dom": "^6.0.0",
    "tailwind-merge": "^2.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "autoprefixer": "^10.0.0",
    "jsdom": "^25.0.0",
    "msw": "^2.0.0",
    "postcss": "^8.0.0",
    "tailwindcss": "^3.0.0",
    "tailwindcss-animate": "^1.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

### 3. Update `vite.config.ts` to resolve the shared package

```ts name=apps/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@task-manager/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
```

### 4. Update `tsconfig.json`

```json name=apps/web/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@task-manager/types": ["../../packages/types/src/index.ts"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 5. Delete the local types file and update imports

```bash
rm apps/web/src/types/task.ts
```

Find every file importing from `@/types/task` and replace with the shared package:

```ts
// Before
import type { Task } from '@/types/task';

// After
import type { Task } from '@task-manager/types';
```

Files to update (from Phase 3):
- `src/components/TaskCard.tsx`
- `src/components/TaskList.tsx`
- `src/components/NewTaskForm.tsx`
- `src/api/tasks.ts`
- `src/api/task.mutations.ts`
- `src/mocks/handlers.ts`
- Any test files

### 6. Install and start

```bash
# From task-manager root
pnpm install
```

### 7. Start both apps from the root

```bash
pnpm turbo dev
```

Turborepo starts both `apps/api` (port 3000) and `apps/web` (port 5173) in parallel using its TUI (terminal UI). Press `q` to stop all.

## Test it

```bash
pnpm --filter @task-manager/web test
pnpm --filter @task-manager/web typecheck
```

```bash
pnpm turbo dev
# Open http://localhost:5173 — task list loads from http://localhost:3000
```

## Mini-task
Run `pnpm turbo build` from the root. Turborepo should build `packages/types` first, then `apps/api` and `apps/web` in parallel. Verify `apps/web/dist/` contains the built assets.

## Glossary
- **Vite alias** — tells esbuild how to resolve module specifiers (needed separately from `tsconfig paths`).
- **`tsconfig paths`** — tells TypeScript how to resolve module specifiers for type-checking.
- **`turbo dev`** — starts all dev servers in the workspace in parallel; uses TUI for output.

## Resources
- [Vite — resolve.alias](https://vitejs.dev/config/shared-options.html#resolve-alias)
- [Turborepo — dev task](https://turbo.build/repo/docs/crafting-your-repository/running-tasks#persistent-tasks)

## Checklist
- [ ] `my-web` files copied to `apps/web/`
- [ ] `@task-manager/types` in `workspace:*` deps
- [ ] Vite alias resolves `@task-manager/types`
- [ ] `tsconfig.json` paths includes `@task-manager/types`
- [ ] Local `src/types/task.ts` deleted
- [ ] All imports updated to `@task-manager/types`
- [ ] `pnpm turbo dev` starts both apps
- [ ] All RTL tests pass
