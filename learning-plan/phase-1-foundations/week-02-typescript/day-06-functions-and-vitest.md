# Day 6 — Functions and types + first Vitest test

## Goal
Learn typed functions in TS and write your first **Vitest** test.

## Estimated time
~1 hour.

## Where to put your code
`exercises/phase-1/week-02-typescript/ts-playground/`

## Explanation

- Function types: parameters and return type.
- Optional / default parameters.
- **Vitest** is a fast Jest-compatible test runner. Like PHPUnit, but for JS/TS — with watch mode and zero config.

## Step-by-step

```bash
mkdir -p exercises/phase-1/week-02-typescript/ts-playground
cd exercises/phase-1/week-02-typescript/ts-playground
npm init -y
npm i -D typescript tsx vitest @types/node
npx tsc --init
```

Use the same `tsconfig.json` baseline from Day 4.

Add to `package.json`:
```json
"scripts": {
  "test":       "vitest run",
  "test:watch": "vitest"
}
```

Create `src/math.ts`:

```ts name=src/math.ts
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b = 1): number {
  return a * b;
}
```

Create the first test:

```ts name=src/math.test.ts
import { describe, it, expect } from 'vitest';
import { add, multiply } from './math';

describe('math', () => {
  it('adds two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('multiplies, defaulting second arg to 1', () => {
    expect(multiply(7)).toBe(7);
    expect(multiply(7, 3)).toBe(21);
  });
});
```

Run:
```bash
npm test
npm run test:watch
```

## Mini-task
Add `subtract(a, b)` and `divide(a, b)`. Make `divide` throw on `b === 0`. Add tests for both, including the throw case (`expect(() => divide(1, 0)).toThrow()`).

## Glossary
- **Vitest** — fast modern test runner with Jest-compatible API.
- **describe / it / expect** — the standard test structure (group / case / assertion).

## Resources
- [Vitest docs](https://vitest.dev/)
- [TS — Functions](https://www.typescriptlang.org/docs/handbook/2/functions.html)

## Checklist
- [ ] `npm test` shows passing tests
- [ ] You wrote at least 4 assertions
- [ ] You tested an error case with `toThrow`
