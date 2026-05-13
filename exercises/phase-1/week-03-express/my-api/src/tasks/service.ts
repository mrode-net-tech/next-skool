import { prismaTaskRepository as taskStore } from '@tasks/prisma.repository';
import { type Priority } from '@tasks/repository';

// import { taskStore } from './store';

export const taskService = {
  list(filter?: { done?: boolean }) {
    return taskStore.list(filter);
  },

  find(id: string) {
    return taskStore.find(id);
  },

  create(title: string, priority: Priority) {
    return taskStore.add(title, priority);
  },

  update(id: string, title: string, priority: Priority, done: boolean) {
    return taskStore.update(id, title, priority, done);
  },

  remove(id: string) {
    return taskStore.remove(id);
  },

  markDone(id: string) {
    return taskStore.markDone(id);
  },
};
