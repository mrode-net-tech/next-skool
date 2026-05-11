import { randomUUID } from 'node:crypto';

export type Priority = 1 | 2 | 3;

export interface Task {
  readonly id: string;
  readonly title: string;
  done: boolean;
  priority: Priority;
}

export class TaskStore {
  private tasks: Map<string, Task> = new Map<string, Task>();

  add(title: string, priority?: Priority): Task {
    const task: Task = {
      id: randomUUID(),
      title: title,
      done: false,
      priority: priority ?? 1,
    };

    this.tasks.set(task.id, task);

    return task;
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

  remove(id: string): void {
    this.tasks.delete(id);
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

  count(): number {
    return this.tasks.size;
  }

  async loadAsync(seed: Task[]): Promise<void> {
    await new Promise((r) => setTimeout(r, 5));
    seed.forEach((task: Task) => this.tasks.set(task.id, task));
  }

  topByPriority(): Task | undefined {
    return Array.from(this.tasks.values()).reduce<Task | undefined>(
      (best, task) => (best === undefined || task.priority > best.priority ? task : best),
      undefined,
    );
  }
}
