import { randomUUID } from 'node:crypto';

import { Priority, Task, TaskRepository } from '@tasks/repository';

export class TaskStore implements TaskRepository {
  private tasks: Map<string, Task> = new Map<string, Task>();

  constructor(initial: Task[] = []) {
    initial.forEach((task) => this.tasks.set(task.id, task));
  }

  reset(): Promise<void> {
    this.tasks.clear();
    return Promise.resolve();
  }

  list(filter?: { done?: boolean }): Promise<Task[]> {
    const tasks = Array.from(this.tasks.values());
    if (!filter || filter.done === undefined) return Promise.resolve(tasks);
    return Promise.resolve(tasks.filter((task) => task.done === filter.done));
  }

  find(id: string): Promise<Task | null> {
    const task = this.tasks.get(id);

    if (!task) return Promise.resolve(null);

    return Promise.resolve(task);
  }

  add(title: string, priority: Priority): Promise<Task> {
    const task: Task = {
      id: randomUUID(),
      title,
      done: false,
      priority,
    };

    this.tasks.set(task.id, task);

    return Promise.resolve(task);
  }

  remove(id: string): Promise<boolean> {
    if (!this.tasks.has(id)) {
      throw new Error(`Task with id ${id} not found`);
    }
    this.tasks.delete(id);
    return Promise.resolve(true);
  }

  markDone(id: string): Promise<Task> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task with id ${id} not found`);
    }
    task.done = true;
    this.tasks.set(task.id, task);
    return Promise.resolve(task);
  }
}

const seedTasks: Task[] = [
  {
    id: '7b74b565-f386-4edc-9e40-77d1da68dbe',
    title: 'Learn Express',
    done: false,
    priority: 1,
  },
  {
    id: '67b08005-4619-4441-a21b-08d0ddc90916',
    title: 'Drink coffee',
    done: true,
    priority: 2,
  },
];

export const taskStore = new TaskStore(seedTasks);
