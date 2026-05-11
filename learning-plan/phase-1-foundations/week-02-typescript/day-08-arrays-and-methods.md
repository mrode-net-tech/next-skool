# Day 8 — Arrays and methods

## Goal
Fluently use array methods: `map`, `filter`, `reduce`, `find`, `some`, `every`.

## Estimated time
~1 hour.

## Where to put your code
`exercises/phase-1/week-02-typescript/ts-playground/`

## Explanation

These are like Laravel's Collection methods, available natively on every array. They return **new arrays** (or values) and don't mutate the original.

## Step-by-step

```ts name=src/tasks.ts
export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: 1 | 2 | 3;
}

export function titles(tasks: Task[]): string[] {
  return tasks.map((t) => t.title);
}

export function pending(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.done);
}

export function highestPriority(tasks: Task[]): Task | undefined {
  return tasks.reduce<Task | undefined>(
    (best, t) => (best === undefined || t.priority < best.priority ? t : best),
    undefined,
  );
}

export function allDone(tasks: Task[]): boolean {
  return tasks.length > 0 && tasks.every((t) => t.done);
}
```

```ts name=src/tasks.test.ts
import { describe, it, expect } from 'vitest';
import { titles, pending, highestPriority, allDone, type Task } from './tasks';

const sample: Task[] = [
  { id: '1', title: 'A', done: false, priority: 2 },
  { id: '2', title: 'B', done: true,  priority: 1 },
  { id: '3', title: 'C', done: false, priority: 3 },
];

describe('tasks', () => {
  it('lists titles', () => {
    expect(titles(sample)).toEqual(['A', 'B', 'C']);
  });

  it('returns pending tasks', () => {
    expect(pending(sample)).toHaveLength(2);
  });

  it('finds highest priority (lowest number)', () => {
    expect(highestPriority(sample)?.id).toBe('2');
  });

  it('reports allDone correctly', () => {
    expect(allDone(sample)).toBe(false);
    expect(allDone([{ id: '1', title: 'X', done: true, priority: 1 }])).toBe(true);
  });
});
```

## Mini-task
Write `groupByDone(tasks)` returning `{ done: Task[]; pending: Task[] }`. Test it.

## Glossary
- **map / filter / reduce** — transform / select / fold operations on arrays.
- **Generic** — a parameter for a type, e.g. `Array<T>`.

## Resources
- [MDN — Array methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)

## Checklist
- [x] You used `map`, `filter`, `reduce`, `every`
- [x] All tests pass
