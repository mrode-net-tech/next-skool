# Day 10 — Recap exercise

## Goal
Combine the week's concepts in one mini-project: a typed in-memory **task store** with full tests.

## Estimated time
~1 hour.

## Where to put your code
`exercises/phase-1/week-02-typescript/ts-playground/`

## Explanation

No new concepts — just glue everything together: types, functions, arrays, async, tests. This is your first chance to feel "I can build this in TypeScript."

## Step-by-step

Build a `TaskStore` class with these methods (all typed, all tested):

- `add(title: string, priority?: 1 | 2 | 3): Task`
- `markDone(id: string): Task`
- `remove(id: string): void`
- `list(filter?: { done?: boolean }): Task[]`
- `count(): number`
- `loadAsync(seed: Task[]): Promise<void>` — simulates a delay then bulk-loads tasks.

```ts name=src/task-store.ts
import { randomUUID } from 'node:crypto';

export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: 1 | 2 | 3;
}

export class TaskStore {
  private tasks: Task[] = [];

  add(title: string, priority: 1 | 2 | 3 = 2): Task {
    if (!title.trim()) throw new Error('title required');
    const t: Task = { id: randomUUID(), title, done: false, priority };
    this.tasks.push(t);
    return t;
  }

  markDone(id: string): Task {
    const t = this.tasks.find((t) => t.id === id);
    if (!t) throw new Error('not found');
    t.done = true;
    return t;
  }

  remove(id: string): void {
    this.tasks = this.tasks.filter((t) => t.id !== id);
  }

  list(filter?: { done?: boolean }): Task[] {
    if (filter?.done === undefined) return [...this.tasks];
    return this.tasks.filter((t) => t.done === filter.done);
  }

  count(): number {
    return this.tasks.length;
  }

  async loadAsync(seed: Task[]): Promise<void> {
    await new Promise((r) => setTimeout(r, 5));
    this.tasks = [...seed];
  }
}
```

Write at least **6 tests** in `src/task-store.test.ts` covering: add, validation, markDone, not-found, list with and without filter, async load.

## Mini-task
Add `topByPriority(): Task | undefined` reusing the `reduce` pattern from Day 8 — with a test.

## Glossary
No new terms today.

## Resources
- [TS — Classes](https://www.typescriptlang.org/docs/handbook/2/classes.html)
- [Vitest — expect](https://vitest.dev/api/expect.html)

## Checklist
- [x] At least 6 passing tests
- [x] You used a class, types, async, and array methods
- [x] Code committed and pushed
