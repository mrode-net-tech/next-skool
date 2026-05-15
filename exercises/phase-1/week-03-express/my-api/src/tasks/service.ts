import { prismaTaskRepository as taskStore } from '@tasks/prisma.repository';
import { type Priority, Task } from '@tasks/repository';

// import { taskStore } from './store';

export const taskService = {
  list(filter?: { done?: boolean; userId?: string }): Promise<Task[]> {
    return taskStore.list(filter);
  },

  find(id: string): Promise<Task | null> {
    return taskStore.find(id);
  },

  create(userId: string, title: string, priority: Priority): Promise<Task> {
    return taskStore.add(userId, title, priority);
  },

  update(
    id: string,
    title: string,
    priority: Priority,
    done: boolean,
  ): Promise<Task> {
    return taskStore.update(id, title, priority, done);
  },

  remove(id: string): Promise<boolean> {
    return taskStore.remove(id);
  },

  markDone(id: string): Promise<Task> {
    return taskStore.markDone(id);
  },
};
