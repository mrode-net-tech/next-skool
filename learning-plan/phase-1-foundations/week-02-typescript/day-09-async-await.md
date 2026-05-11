# Day 9 — async / await

## Goal
Understand Promises and `async/await`. Test async functions with Vitest.

## Estimated time
~1 hour.

## Where to put your code
`exercises/phase-1/week-02-typescript/ts-playground/`

## Explanation

- A **Promise** is a value that will be available later (or fail).
- `async` makes a function return a Promise.
- `await` pauses inside an `async` function until the Promise resolves.
- This is **the** thing that trips Laravel devs up the most. Take it slow.

## Step-by-step

```ts name=src/sleep.ts
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchGreeting(name: string): Promise<string> {
  await sleep(10);
  if (!name) throw new Error('name required');
  return `Hello, ${name}!`;
}
```

```ts name=src/sleep.test.ts
import { describe, it, expect } from 'vitest';
import { fetchGreeting } from './sleep';

describe('fetchGreeting', () => {
  it('returns the greeting after a delay', async () => {
    await expect(fetchGreeting('Marcin')).resolves.toBe('Hello, Marcin!');
  });

  it('rejects on empty name', async () => {
    await expect(fetchGreeting('')).rejects.toThrow('name required');
  });
});
```

### Parallel vs sequential
```ts
// sequential — takes ~30ms
await sleep(10);
await sleep(10);
await sleep(10);

// parallel — takes ~10ms
await Promise.all([sleep(10), sleep(10), sleep(10)]);
```

## Mini-task
Write `fetchGreetings(names: string[])` that returns greetings **in parallel** with `Promise.all`. Add a test.

## Glossary
- **Promise** — a future value.
- **async function** — always returns a Promise.
- **await** — unwraps a Promise inside an async function.
- **Promise.all** — wait for many Promises in parallel.

## Resources
- [MDN — Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises)
- [MDN — async / await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await)

## Checklist
- [x] You used `async/await`
- [x] You tested both resolve and reject
- [x] You used `Promise.all` once
