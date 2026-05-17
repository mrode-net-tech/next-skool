# Day 70 — ESLint + TS config packages (polish)

## Goal
Harden the `packages/config-eslint` and `packages/config-tsconfig` packages, add Prettier integration, enforce no cross-boundary imports, and ensure every workspace package passes the full lint + typecheck pipeline.

## Estimated time
~1.5 hours

## Prerequisites
Day 65 — config packages created. Day 69 — all packages in place.

## Where to put your code
In `task-manager/packages/config-eslint/` and `packages/config-tsconfig/`.

## Explanation

Today you harden what was set up on Day 65. The goal: run `pnpm turbo lint typecheck` from the root and get zero errors across all five packages (`types`, `api-client`, `config-eslint`, `config-tsconfig`) and both apps. This is the "green pipeline" gate before moving to auth in Week 15.

**Import boundary enforcement**: `@task-manager/types` must not import from `apps/api` or `apps/web`. `apps/web` must not import from `apps/api`'s src directly (only through HTTP/shared packages). ESLint's `no-restricted-imports` rule can enforce this.

**Prettier** is a formatter — it makes `eslint --fix` focus only on logic issues, not style. Add it once at the root level and let Turborepo run it across all packages.

## Step-by-step

### 1. Prettier config at root

```json name=.prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2
}
```

```ignore name=.prettierignore
node_modules
dist
.turbo
*.md
pnpm-lock.yaml
```

Add format scripts to root `package.json`:
```json
{
  "scripts": {
    "format": "prettier --write \"**/*.{ts,tsx,js,json}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,json}\""
  }
}
```

### 2. Strengthen `packages/config-eslint`

```js name=packages/config-eslint/index.js
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: true },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs['recommended'].rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.js', '*.cjs'],
  },
];
```

`consistent-type-imports` enforces `import type { Foo }` instead of `import { Foo }` for type-only imports — prevents importing runtime values where only types are needed, which can cause circular dependency issues.

`no-floating-promises` catches `async` calls that aren't awaited:
```ts
// ❌ caught by no-floating-promises
deleteTask(id); // forgot await

// ✓ correct
await deleteTask(id);
// or
void deleteTask(id); // intentional fire-and-forget
```

### 3. Enforce import boundaries

Add to `packages/config-eslint/index.js`:

```js
{
  files: ['packages/types/src/**'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['apps/*'],
        message: 'packages/types must not import from apps/',
      }],
    }],
  },
},
{
  files: ['apps/web/src/**'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['apps/api/src/*'],
        message: 'apps/web must not import directly from apps/api src — use HTTP or shared packages.',
      }],
    }],
  },
},
```

### 4. Add `tsconfig.json` strictness fields

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
    "forceConsistentCasingInFileNames": true,
    "exactOptionalPropertyTypes": false,
    "noUncheckedIndexedAccess": true
  }
}
```

`noUncheckedIndexedAccess`: `arr[0]` now has type `T | undefined` — forces you to guard array access. This catches a common class of runtime errors:

```ts
// Before noUncheckedIndexedAccess
const first = tasks[0]; // type: Task — wrong if array is empty
first.title;             // crash if tasks is empty

// After
const first = tasks[0]; // type: Task | undefined
first?.title;           // safe
```

### 5. Fix any new errors

Running `pnpm turbo typecheck` after enabling `noUncheckedIndexedAccess` will likely surface a few issues. Common fixes:

```ts
// Pattern: use at() with nullish coalescing
const nextCursor = items.at(-1)?.id ?? null;

// Pattern: guard before access
const first = items[0];
if (first) { /* use first */ }

// Pattern: non-null assertion (only when logically guaranteed)
const id = items[0]!.id; // use only when you know array is non-empty
```

### 6. Final pipeline run

```bash
# Full CI simulation from root
pnpm format:check
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
pnpm turbo build
```

All five should pass. Fix any issues before moving to Week 15 (auth).

### 7. Add `.editorconfig` for cross-editor consistency

```ini name=.editorconfig
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

## Test it

```bash
pnpm turbo lint typecheck
```

Zero errors across all packages and apps.

## Mini-task
Add `@typescript-eslint/prefer-nullish-coalescing` rule to `packages/config-eslint/index.js`. This enforces `??` over `||` for nullish checks — a subtle but important safety difference (`'' || 'default'` replaces empty string; `'' ?? 'default'` does not).

## Glossary
- **`consistent-type-imports`** — enforces `import type` for type-only imports; prevents accidental runtime imports.
- **`no-floating-promises`** — catches unawaited async calls that could silently fail.
- **`noUncheckedIndexedAccess`** — makes array/object index access return `T | undefined`.
- **`.editorconfig`** — cross-editor config for indentation, line endings, etc.
- **Import boundary** — rule preventing packages from importing across their defined scope.

## Resources
- [typescript-eslint — Rules](https://typescript-eslint.io/rules/)
- [Prettier docs](https://prettier.io/docs/en/)
- [TSConfig — noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig#noUncheckedIndexedAccess)

## Checklist
- [ ] Prettier config + `.prettierignore` at root
- [ ] `format:check` script added
- [ ] `consistent-type-imports` rule enforced
- [ ] `no-floating-promises` rule enforced
- [ ] Import boundary rules prevent cross-app imports
- [ ] `noUncheckedIndexedAccess` enabled in base tsconfig
- [ ] All array access guarded with `?.` or conditional checks
- [ ] Full pipeline `pnpm turbo lint typecheck test build` passes green
