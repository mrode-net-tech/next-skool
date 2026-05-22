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
  list(filter: { userId: string; done?: boolean | undefined }): Promise<Task[]>;
  find(id: string): Promise<Task | null>;
  save(task: Task): Promise<Task>;
  remove(id: string): Promise<boolean>;
  markDone(id: string): Promise<Task>;
}
