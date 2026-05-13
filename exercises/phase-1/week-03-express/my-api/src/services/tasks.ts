export interface Task {
  id: string;
  title: string;
  done: boolean;
}

const tasks: Task[] = [
  { id: '7b74b565-f386-4edc-9e40-77d1da68dbe', title: 'Learn Express', done: false },
  { id: '67b08005-4619-4441-a21b-08d0ddc90916', title: 'Drink coffee', done: true },
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
}

export const taskStore = new TaskStore(tasks);
