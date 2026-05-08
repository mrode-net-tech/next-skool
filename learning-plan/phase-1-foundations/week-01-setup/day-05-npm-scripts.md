# Day 5 — npm scripts and watch mode

## Goal
Understand npm scripts, add **watch mode** for fast feedback, and add ESLint + Prettier.

## Estimated time
~1 hour.

## Where to put your code
`exercises/phase-1/week-01-setup/nauka-node/`

## Explanation
Like `composer scripts`, npm scripts let you alias common commands. **Watch mode** re-runs the program on every file save — think "hot reload for the terminal".

## Step-by-step

### 1. Watch mode
`tsx` ships with `--watch`:

```json
"scripts": {
  "dev":       "tsx src/index.ts",
  "dev:watch": "tsx watch src/index.ts",
  "build":     "tsc",
  "start":     "node dist/index.js"
}
```

Run `npm run dev:watch`, edit `src/index.ts`, save — it re-runs.

### 2. Linting
```bash
npm i -D eslint @eslint/js typescript-eslint prettier
```

Minimal flat config:

```js name=eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  }
];
```

```json name=.prettierrc.json
{ "singleQuote": true, "semi": true, "trailingComma": "all", "printWidth": 100 }
```

Add scripts:
```json
"scripts": {
  "lint":   "eslint .",
  "format": "prettier --write ."
}
```

### 3. Try it
```bash
npm run lint
npm run format
```

## Mini-task
Introduce an unused variable, run `npm run lint`, see the warning. Then prefix it with `_` to silence it.

## Glossary
- **Watch mode** — the runner re-executes on file changes.
- **ESLint** — linter for JS/TS.
- **Prettier** — opinionated code formatter.

## Resources
- [ESLint flat config](https://eslint.org/docs/latest/use/configure/configuration-files-new)
- [typescript-eslint](https://typescript-eslint.io/)
- [Prettier docs](https://prettier.io/docs/en/)

## Checklist
- [ ] `npm run dev:watch` re-runs on save
- [ ] `npm run lint` works
- [ ] `npm run format` works
