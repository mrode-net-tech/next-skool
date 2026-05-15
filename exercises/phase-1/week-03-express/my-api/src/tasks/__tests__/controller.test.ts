import { createUser } from '@test/users.factory';
import { StatusCodes } from 'http-status-codes';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '@app';

const app = createApp();

describe('tasks API', () => {
  let userId: string;

  beforeEach(async () => {
    const user = await createUser();
    userId = user.id;
  });

  it('lists empty initially', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body).toEqual([]);
  });

  it('creates and lists', async () => {
    const created = await request(app)
      .post('/tasks')
      .send({ user_id: userId, title: 'Buy milk', priority: 1 });
    expect(created.status).toBe(StatusCodes.CREATED);
    expect(created.body.title).toBe('Buy milk');

    const list = await request(app).get('/tasks');
    expect(list.body).toHaveLength(1);
  });

  it('creates and marks as done', async () => {
    const created = await request(app)
      .post('/tasks')
      .send({ user_id: userId, title: 'Buy milk', priority: 1 });

    const marked = await request(app).patch(`/tasks/${created.body.id}/done`);
    expect(marked.status).toBe(StatusCodes.NO_CONTENT);
  });

  it('creates and updates and marks as done', async () => {
    const created = await request(app)
      .post('/tasks')
      .send({ user_id: userId, title: 'Buy milk', priority: 1 });

    const updated = await request(app)
      .put(`/tasks/${created.body.id}`)
      .send({ title: 'Buy milk changed', priority: 2, done: true });
    expect(updated.status).toBe(StatusCodes.ACCEPTED);
    expect(updated.body.title).toBe('Buy milk changed');
    expect(updated.body.priority).toBe(2);
    expect(updated.body.done).toBe(true);
  });

  it('rejects invalid input', async () => {
    const res = await request(app).post('/tasks').send({ title: '' });
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it('deletes', async () => {
    const c = await request(app)
      .post('/tasks')
      .send({ user_id: userId, title: 'temp', priority: 2 });
    const d = await request(app).delete(`/tasks/${c.body.id}`);
    expect(d.status).toBe(StatusCodes.NO_CONTENT);
  });
});
