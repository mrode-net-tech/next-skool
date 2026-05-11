import { describe, it, expect } from 'vitest';
import { Priority, Task, TaskStore } from '../store';
import { randomUUID } from 'node:crypto';

describe('store', () => {
  it('adds a new task with default priority', async () => {
    const task = new TaskStore().add('task 1');

    expect(task.id).toEqual(expect.any(String));
    expect(task.title).toBe<string>('task 1');
    expect(task.priority).toBe<Priority>(1);
    expect(task.done).toBe<boolean>(false);
  });

  it('adds a new task with priority', async () => {
    const task = new TaskStore().add('task 1', 2);

    expect(task.id).toEqual(expect.any(String));
    expect(task.title).toBe<string>('task 1');
    expect(task.priority).toBe<Priority>(2);
    expect(task.done).toBe<boolean>(false);
  });

  it('marks task as done', async () => {
    const store = new TaskStore();
    const task = store.add('task 1');

    expect(store.markDone(task.id)).toEqual<Task>({
      id: task.id,
      title: task.title,
      priority: task.priority,
      done: true,
    });
  });

  it('doesnt mark task as done', async () => {
    const store = new TaskStore();
    const id = randomUUID();

    expect(() => store.markDone(id)).toThrow(`Task with id ${id} not found`);
  });

  it('removes task', async () => {
    const store = new TaskStore();
    const task = store.add('task 1');

    expect(store.count()).toBe<number>(1);

    store.remove(task.id);

    expect(store.count()).toBe<number>(0);
  });

  it('lists tasks', async () => {
    const store = new TaskStore();
    const task = store.add('task 1');

    expect(store.list()).toEqual<Task[]>([task]);
    expect(store.list({ done: true })).toEqual<Task[]>([]);
    expect(store.list({ done: false })).toEqual<Task[]>([task]);
  });

  it('loads async', async () => {
    const store = new TaskStore();
    const task1: Task = {
      id: randomUUID(),
      title: 'task 1',
      done: true,
      priority: 1,
    };
    const task2: Task = {
      id: randomUUID(),
      title: 'task2',
      done: false,
      priority: 2,
    };
    await store.loadAsync([task1, task2]);
    expect(store.list()).toEqual<Task[]>([task1, task2]);
  });

  it('finds highest priority (lowest number)', () => {
    const store = new TaskStore();
    store.add('task 1', 1);
    store.add('task 2', 2);
    const task3 = store.add('task 3', 3);

    expect(store.topByPriority()?.id).toBe(task3.id);
  });
});
