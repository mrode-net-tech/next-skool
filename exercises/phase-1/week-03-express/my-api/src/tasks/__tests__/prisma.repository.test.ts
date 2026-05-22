import { randomUUID } from 'node:crypto';

import { createTask } from '@test/tasks.factory';
import { createUser } from '@test/users.factory';
import { describe, expect, it } from 'vitest';

import { prisma } from '../../db/prisma';
import { PrismaTaskRepository } from '../prisma.repository';

describe('PrismaTaskRepository', () => {
  const repository = new PrismaTaskRepository();

  it('adds a task', async () => {
    const user = await createUser();

    const task = await repository.save({
      id: randomUUID(),
      userId: user.id,
      title: 'Buy milk',
      done: false,
      priority: 1,
    });

    expect(task).toMatchObject({
      id: expect.any(String),
      userId: user.id,
      title: 'Buy milk',
      done: false,
      priority: 1,
    });
  });

  it('lists tasks with filters', async () => {
    const user = await createUser();
    const otherUser = await createUser();
    const matchingTask = await createTask(user.id, {
      title: 'Matching task',
      done: true,
      priority: 1,
    });
    await createTask(user.id, { done: false });
    await createTask(otherUser.id, { done: true });

    const tasks = await repository.list({ done: true, userId: user.id });

    expect(tasks).toEqual([
      expect.objectContaining({
        id: matchingTask.id,
        userId: user.id,
        title: 'Matching task',
        done: true,
        priority: 1,
      }),
    ]);
  });

  it('finds a task by id', async () => {
    const user = await createUser();
    const created = await createTask(user.id);

    const task = await repository.find(created.id);

    expect(task).toMatchObject({
      id: created.id,
      userId: user.id,
      title: created.title,
    });
  });

  it('returns null when task does not exist', async () => {
    await expect(repository.find('missing-task-id')).resolves.toBeNull();
  });

  it('updates a task', async () => {
    const user = await createUser();
    const created = await createTask(user.id);

    const updated = await repository.save({
      id: created.id,
      userId: user.id,
      title: 'Changed',
      done: true,
      priority: 3,
    });

    expect(updated).toMatchObject({
      id: created.id,
      userId: user.id,
      title: 'Changed',
      done: true,
      priority: 3,
    });
  });

  it('removes a task', async () => {
    const user = await createUser();
    const created = await createTask(user.id);

    await expect(repository.remove(created.id)).resolves.toBe(true);
    await expect(repository.remove(created.id)).resolves.toBe(false);
  });

  it('marks a task as done', async () => {
    const user = await createUser();
    const created = await createTask(user.id, { done: false });

    const task = await repository.markDone(created.id);

    expect(task.done).toBe(true);
  });

  it('resets tasks', async () => {
    const user = await createUser();
    await createTask(user.id);

    await repository.reset();

    await expect(prisma.task.count()).resolves.toBe(0);
  });
});
