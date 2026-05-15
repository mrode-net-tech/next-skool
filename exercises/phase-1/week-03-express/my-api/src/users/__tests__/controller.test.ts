import { createTask } from '@test/tasks.factory';
import { createUser } from '@test/users.factory';
import { StatusCodes } from 'http-status-codes';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '@app';

const app = createApp();

describe('users API', () => {
  it('creates user', async () => {
    const payload = {
      name: 'Marek',
      email: 'test@test.com',
    };

    const created = await request(app).post('/users').send(payload);

    expect(created.status).toBe(StatusCodes.CREATED);
    expect(created.body).toMatchObject(payload);
    expect(created.body.id).toEqual(expect.any(String));
  });

  it('list user tasks', async () => {
    const user = await createUser();
    const task = await createTask(user.id);

    const list = await request(app).get('/tasks');

    expect(list.status).toBe(StatusCodes.OK);
    expect(list.body).toHaveLength(1);
    expect(list.body).toEqual([
      expect.objectContaining({
        id: task.id,
        userId: user.id,
        title: task.title,
        done: task.done,
        priority: task.priority,
      }),
    ]);
  });
});
