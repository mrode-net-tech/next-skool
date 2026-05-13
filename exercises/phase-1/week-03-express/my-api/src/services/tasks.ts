import { randomUUID } from 'node:crypto';

export type Priority = 1 | 2 | 3;

export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: Priority;
}

const tasks: Task[] = [
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

export class TaskStore {
  private tasks: Map<string, Task> = new Map<string, Task>();

  constructor(tasks: Task[]) {
    tasks.forEach((task) => this.tasks.set(task.id, task));
  }

  list(filter?: { done?: boolean }): Task[] {
    const tasks = Array.from(this.tasks.values());

    if (!filter) {
      return tasks;
    }

    if (filter.done === undefined) {
      return tasks;
    }

    return tasks.filter((task) => task.done === filter.done);
  }

  find(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  add(title: string, priority: Priority): Task {
    const task: Task = {
      id: randomUUID(),
      title: title,
      done: false,
      priority: priority,
    };

    this.tasks.set(task.id, task);

    return task;
  }

  remove(id: string): void {
    const task: Task | undefined = this.tasks.get(id);

    if (!task) {
      throw new Error(`Task with id ${id} not found`);
    }

    this.tasks.delete(id);
  }

  markDone(id: string): Task {
    const task: Task | undefined = this.tasks.get(id);

    if (!task) {
      throw new Error(`Task with id ${id} not found`);
    }

    task.done = true;
    this.tasks.set(task.id, task);

    return task;
  }
}

export const taskStore = new TaskStore(tasks);
