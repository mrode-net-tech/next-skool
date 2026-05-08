# Day 4 — Add TypeScript

## Goal
Add TypeScript to `nauka-node`, run a `.ts` file with `tsx`, and build with `tsc`.

## Estimated time
~1 hour.

## Where to put your code
`exercises/phase-1/week-01-setup/nauka-node/`

## Explanation
- **TypeScript** = JavaScript + a type system.
- `tsc` (the TypeScript compiler) turns `.ts` into `.js`.
- `tsx` runs `.ts` directly in dev (no separate build step).

## Step-by-step

```bash
cd exercises/phase-1/week-01-setup/nauka-node
npm i -D typescript tsx @types/node
npx tsc --init
```

Edit `tsconfig.json` to a sensible baseline:

```json name=tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

Rename `src/index.js` → `src/index.ts`. Add a typed function:

```ts name=src/index.ts
function greet(name: string): string {
  return `Hello, ${name}!`;
}

console.log(greet('Marcin'));
```

Add scripts to `package.json`:

```json
"scripts": {
  "dev":   "tsx src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

Run:
```bash
npm run dev      # runs ts directly
npm run build    # outputs to dist/
npm start        # runs the compiled JS
```

## Mini-task
Make `greet` accept an optional `greeting: string` parameter (default `'Hello'`). Verify both calls work.

## Glossary
- **`tsc`** — TypeScript compiler.
- **`tsx`** — "TypeScript execute". Runs TS files without an explicit build.
- **`@types/*`** — type definitions for libraries that aren't TS-native.

## Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [tsconfig reference](https://www.typescriptlang.org/tsconfig)
- [tsx](https://github.com/privatenumber/tsx)

## Checklist
- [ ] `npm run dev` runs the `.ts` file
- [ ] `npm run build` produces `dist/`
- [ ] `strict: true` enabled
