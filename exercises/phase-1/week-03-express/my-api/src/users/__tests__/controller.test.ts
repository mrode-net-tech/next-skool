import { createTask } from '@test/tasks.factory';
import { createUser } from '@test/users.factory';
import { StatusCodes } from 'http-status-codes';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '@app';

const app = createApp();

describe('users API', () => {
  it('creates a user and returns 201 without password', async () => {
    const res = await request(app).post('/users/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(StatusCodes.CREATED);
    expect(res.body.email).toBe('alice@example.com');
    expect(res.body.password).toBeUndefined();
  });

  it('returns 409 when email is already taken', async () => {
    await createUser({ email: 'bob@example.com' });
    const data = {
      name: 'Bob',
      email: 'bob@example.com',
      password: 'secret123',
    };
    const res = await request(app).post('/users/register').send(data);
    expect(res.status).toBe(StatusCodes.CONFLICT);
  });

  it('returns 400 for a short password', async () => {
    const res = await request(app).post('/users/register').send({
      name: 'Alice',
      email: 'x@example.com',
      password: '123',
    });
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
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
