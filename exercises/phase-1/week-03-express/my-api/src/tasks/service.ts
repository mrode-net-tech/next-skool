import { type Priority, taskStore } from './store';

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

  remove(id: string) {
    return taskStore.remove(id);
  },

  markDone(id: string) {
    return taskStore.markDone(id);
  },
};
