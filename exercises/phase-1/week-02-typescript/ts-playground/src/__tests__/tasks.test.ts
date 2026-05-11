import { describe, it, expect } from 'vitest';
import { group, titles, pending, highestPriority, allDone, type Task } from '../tasks';

const sample: Task[] = [
  { id: '1', title: 'A', done: false, priority: 2 },
  { id: '2', title: 'B', done: true, priority: 1 },
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

  it('groups tasks', () => {
    expect(group(sample)).toEqual({
      pending: [sample[0], sample[2]],
      done: [sample[1]],
    });
  });
});
