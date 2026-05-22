import { Task, TaskRepository } from '@tasks/repository';

export class TaskStore implements TaskRepository {
  private tasks: Map<string, Task> = new Map<string, Task>();

  constructor(initial: Task[] = []) {
    initial.forEach((task) => this.tasks.set(task.id, task));
  }

  reset(): Promise<void> {
    this.tasks.clear();
    return Promise.resolve();
  }

  list(filter?: { done?: boolean; userId?: string }): Promise<Task[]> {
    const tasks = Array.from(this.tasks.values()).filter((task) => {
      return (
        (filter?.done === undefined || task.done === filter.done) &&
        (filter?.userId === undefined || task.userId === filter.userId)
      );
    });

    return Promise.resolve(tasks);
  }

  find(id: string): Promise<Task | null> {
    const task = this.tasks.get(id);

    if (!task) return Promise.resolve(null);

    return Promise.resolve(task);
  }

  save(task: Task): Promise<Task> {
    this.tasks.set(task.id, task);
    return Promise.resolve(task);
  }

  remove(id: string): Promise<boolean> {
    if (!this.tasks.has(id)) {
      return Promise.resolve(false);
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
    userId: 'ff6ae7a4-7d67-45cb-a154-c5b29fc8730c',
    title: 'Learn Express',
    done: false,
    priority: 1,
  },
  {
    id: '67b08005-4619-4441-a21b-08d0ddc90916',
    userId: 'ff6ae7a4-7d67-45cb-a154-c5b29fc8730c',
    title: 'Drink coffee',
    done: true,
    priority: 2,
  },
];

export const taskStore = new TaskStore(seedTasks);
