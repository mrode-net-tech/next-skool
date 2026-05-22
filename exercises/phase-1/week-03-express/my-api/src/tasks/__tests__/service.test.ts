import { createTask } from '@test/tasks.factory';
import { createUser } from '@test/users.factory';
import { describe, expect, it } from 'vitest';

import { taskService } from '../service';

describe('taskService', () => {
  it('creates a task', async () => {
    const user = await createUser();

    const task = await taskService.create(user.id, 'Buy milk', 1);

    expect(task).toMatchObject({
      id: expect.any(String),
      userId: user.id,
      title: 'Buy milk',
      done: false,
      priority: 1,
    });
  });

  it('lists tasks', async () => {
    const user = await createUser();
    const task = await createTask(user.id, { done: true });

    const tasks = await taskService.list({ done: true, userId: user.id });

    expect(tasks).toEqual([
      expect.objectContaining({
        id: task.id,
        userId: user.id,
      }),
    ]);
  });

  it('finds a task', async () => {
    const user = await createUser();
    const created = await createTask(user.id);

    const task = await taskService.find(created.id);

    expect(task).toMatchObject({
      id: created.id,
      userId: user.id,
      title: created.title,
    });
  });

  it('updates a task', async () => {
    const user = await createUser();
    const created = await createTask(user.id);

    const updated = await taskService.update(
      created.id,
      user.id,
      'Changed',
      3,
      true,
    );

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
    const task = await createTask(user.id);

    await expect(taskService.remove(task.id)).resolves.toBe(true);
  });

  it('marks a task as done', async () => {
    const user = await createUser();
    const task = await createTask(user.id, { done: false });

    const marked = await taskService.markDone(task.id);

    expect(marked.done).toBe(true);
  });
});
