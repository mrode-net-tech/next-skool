export type Priority = 1 | 2 | 3;

export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: Priority;
}

export interface TaskRepository {
  reset(): Promise<void>;
  list(filter?: { done?: boolean }): Promise<Task[]>;
  find(id: string): Promise<Task | null>;
  add(title: string, priority: Priority): Promise<Task>;
  remove(id: string): Promise<boolean>;
  markDone(id: string): Promise<Task>;
}
