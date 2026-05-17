# Day 65 — Shared scripts + ESLint config package

## Goal
Create `packages/config-eslint` and `packages/config-tsconfig` so every app shares the same lint rules and TypeScript settings without duplicating config.

## Estimated time
~1.5 hours

## Prerequisites
Day 64 — both apps inside the monorepo. ESLint installed in at least one app.

## Where to put your code
In `task-manager/packages/config-eslint/` and `packages/config-tsconfig/`.

## Explanation

Every workspace app currently has its own `tsconfig.json` and ESLint config — mostly duplicated. As the monorepo grows, keeping them in sync manually is error-prone. The solution: **config packages** that export shared config, extended by each app.

This pattern is idiomatic in Turborepo-based monorepos. `packages/config-tsconfig` exports base `tsconfig.json` files; `packages/config-eslint` exports ESLint flat config objects. Apps `extend` or spread them, then only override what differs.

The Laravel analogy: it's like extracting shared `config/` files into a Composer package that all services `require` — except you control the package source and never publish it.

## Step-by-step

### 1. `packages/config-tsconfig`

```json name=packages/config-tsconfig/package.json
{
  "name": "@task-manager/config-tsconfig",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./base": "./base.json",
    "./react": "./react.json",
    "./node": "./node.json"
  }
}
```

```json name=packages/config-tsconfig/base.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2020",
    "strict": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

```json name=packages/config-tsconfig/react.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "useDefineForClassFields": true
  }
}
```

```json name=packages/config-tsconfig/node.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### 2. Update `apps/web/tsconfig.json` to extend shared config

```json name=apps/web/tsconfig.json
{
  "extends": "@task-manager/config-tsconfig/react",
  "compilerOptions": {
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

Add the config package as a devDependency in `apps/web/package.json`:
```json
"devDependencies": {
  "@task-manager/config-tsconfig": "workspace:*"
}
```

### 3. Update `apps/api/tsconfig.json`

```json name=apps/api/tsconfig.json
{
  "extends": "@task-manager/config-tsconfig/node",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@task-manager/types": ["../../packages/types/src/index.ts"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### 4. `packages/config-eslint`

Install ESLint at root:

```bash
pnpm add -Dw eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

```json name=packages/config-eslint/package.json
{
  "name": "@task-manager/config-eslint",
  "version": "0.0.0",
  "private": true,
  "main": "index.js",
  "exports": {
    ".": "./index.js",
    "./react": "./react.js"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^9.0.0"
  }
}
```

```js name=packages/config-eslint/index.js
/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        project: true,
      },
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
    },
    rules: {
      ...require('@typescript-eslint/eslint-plugin').configs['recommended'].rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
```

```js name=packages/config-eslint/react.js
const base = require('./index.js');

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  ...base,
  {
    files: ['**/*.tsx'],
    rules: {
      'react/prop-types': 'off',
    },
  },
];
```

### 5. Use shared ESLint config in `apps/web`

```js name=apps/web/eslint.config.js
const config = require('@task-manager/config-eslint/react');
const reactHooks = require('eslint-plugin-react-hooks');
const reactRefresh = require('eslint-plugin-react-refresh');

module.exports = [
  ...config,
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
];
```

### 6. Run lint across all packages

```bash
# From root
pnpm turbo lint
```

Fix any reported issues before moving on.

### 7. Root-level scripts summary

After today, `task-manager/package.json` scripts work across everything:

| Script | Does |
|---|---|
| `pnpm turbo dev` | Start all dev servers |
| `pnpm turbo build` | Build all (types first, then apps in parallel) |
| `pnpm turbo test` | Run all tests |
| `pnpm turbo typecheck` | Type-check all |
| `pnpm turbo lint` | Lint all |
| `pnpm format` | Prettier across all files |

## Test it

```bash
# Full pipeline from root
pnpm turbo typecheck && pnpm turbo lint && pnpm turbo test
```

All three should pass green.

## Mini-task
Add a `turbo.json` `check` task that runs `typecheck` + `lint` in parallel for a single package. Use it: `pnpm turbo check --filter=@task-manager/web`.

## Glossary
- **Config package** — a workspace package whose sole purpose is exporting shared configuration.
- **`extends`** — tsconfig key to inherit settings from another file; overrides are merged.
- **ESLint flat config** — modern ESLint v9 format; an array of config objects exported from `eslint.config.js`.

## Resources
- [Turborepo — Sharing Config](https://turbo.build/repo/docs/crafting-your-repository/structuring-a-repository#sharing-config-files)
- [TypeScript — Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)

## Checklist
- [ ] `packages/config-tsconfig` exports `base`, `react`, `node` configs
- [ ] `packages/config-eslint` exports `base` and `react` configs
- [ ] Both `apps/api` and `apps/web` extend shared tsconfig
- [ ] `apps/web` uses shared ESLint config
- [ ] `pnpm turbo typecheck` passes for all packages
- [ ] `pnpm turbo lint` passes for all packages
- [ ] `pnpm turbo test` passes for all packages
