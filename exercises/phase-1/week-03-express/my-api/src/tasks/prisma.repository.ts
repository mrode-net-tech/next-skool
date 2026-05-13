import { Prisma, type Task as PrismaTask } from '@prisma/client';

import { prisma } from '../db/prisma';

import type { Priority, Task, TaskRepository } from './repository';

function toDomainTask(row: PrismaTask): Task {
  return {
    id: row.id,
    title: row.title,
    done: row.done,
    priority: row.priority as Priority,
  };
}

export class PrismaTaskRepository implements TaskRepository {
  async reset(): Promise<void> {
    await prisma.task.deleteMany();
  }

  async list(filter?: { done?: boolean }): Promise<Task[]> {
    const rows = await prisma.task.findMany({
      orderBy: { created_at: 'desc' },
      where: filter?.done === undefined ? undefined : { done: filter.done },
    });
    return rows.map(toDomainTask);
  }

  async find(id: string): Promise<Task | null> {
    const row = await prisma.task.findUnique({ where: { id } });
    return row ? toDomainTask(row) : null;
  }

  async add(title: string, priority: Priority): Promise<Task> {
    const row = await prisma.task.create({
      data: { title, priority },
    });
    return toDomainTask(row);
  }

  async update(
    id: string,
    title: string,
    priority: Priority,
    done: boolean,
  ): Promise<Task> {
    const row = await prisma.task.update({
      where: { id },
      data: { title, priority, done },
    });
    return toDomainTask(row);
  }

  async remove(id: string): Promise<boolean> {
    try {
      await prisma.task.delete({ where: { id } });
      return true;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return false;
      }
      throw err;
    }
  }

  async markDone(id: string): Promise<Task> {
    const row = await prisma.task.update({
      where: { id },
      data: { done: true },
    });
    return toDomainTask(row);
  }
}

export const prismaTaskRepository = new PrismaTaskRepository();
