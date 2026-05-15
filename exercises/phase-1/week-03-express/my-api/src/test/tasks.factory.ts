import { Prisma, type Task } from '@prisma/client';

import { prisma } from '../db/prisma';

export async function createTask(
  userId: string,
  overrides: Partial<Prisma.TaskUncheckedCreateInput> = {},
): Promise<Task> {
  return prisma.task.create({
    data: {
      title: `task-${crypto.randomUUID()}`,
      done: false,
      priority: 2,
      user_id: userId,
      ...overrides,
    },
  });
}
