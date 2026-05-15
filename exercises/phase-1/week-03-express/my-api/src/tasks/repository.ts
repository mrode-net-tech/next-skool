export type Priority = 1 | 2 | 3;

export interface Task {
  id: string;
  userId: string;
  title: string;
  done: boolean;
  priority: Priority;
}

export interface TaskRepository {
  reset(): Promise<void>;
  list(filter?: { done?: boolean; userId?: string }): Promise<Task[]>;
  find(id: string): Promise<Task | null>;
  add(userId: string, title: string, priority: Priority): Promise<Task>;
  update(id: string, title: string, priority: Priority, done: boolean): Promise<Task>;
  remove(id: string): Promise<boolean>;
  markDone(id: string): Promise<Task>;
}
