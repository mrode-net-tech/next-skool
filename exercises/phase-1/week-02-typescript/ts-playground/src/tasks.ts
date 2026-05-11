export type Priority = 1 | 2 | 3;

export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: Priority;
}

export interface GroupOfTasks {
  done: Task[],
  pending: Task[],
}

export function titles(tasks: Task[]): string[] {
  return tasks.map(task => task.title);
}

export function pending(tasks: Task[]): Task[] {
  return tasks.filter(task => ! task.done);
}

export function highestPriority(tasks: Task[]): Task | undefined {
  return tasks.reduce<Task | undefined>(
    (best, task) => (best === undefined || task.priority < best.priority ? task : best),
    undefined,
  );
}

export function allDone(tasks: Task[]): boolean {
  return tasks.every(task => task.done);
}

export function group(tasks: Task[]): GroupOfTasks {
  return {
    pending: tasks.filter(task => ! task.done),
    done: tasks.filter(task => task.done),
  }
}
