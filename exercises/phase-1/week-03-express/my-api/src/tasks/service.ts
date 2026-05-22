import { randomUUID } from 'node:crypto';

import { prismaTaskRepository as taskStore } from '@tasks/prisma.repository';
import { type Priority, Task } from '@tasks/repository';

// import { taskStore } from './store';

export const taskService = {
  list(filter: {
    userId: string;
    done?: boolean | undefined;
  }): Promise<Task[]> {
    return taskStore.list(filter);
  },

  find(id: string): Promise<Task | null> {
    return taskStore.find(id);
  },

  create(userId: string, title: string, priority: Priority): Promise<Task> {
    return taskStore.save({
      id: randomUUID(),
      userId: userId,
      title: title,
      priority: priority,
      done: false,
    });
  },

  update(
    id: string,
    userId: string,
    title: string,
    priority: Priority,
    done: boolean,
  ): Promise<Task> {
    return taskStore.save({
      id: id,
      userId: userId,
      title: title,
      priority: priority,
      done: done,
    });
  },

  remove(id: string): Promise<boolean> {
    return taskStore.remove(id);
  },

  markDone(id: string): Promise<Task> {
    return taskStore.markDone(id);
  },
};
