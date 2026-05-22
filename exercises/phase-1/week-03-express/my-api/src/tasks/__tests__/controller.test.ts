import { signAccess } from '@auth/jwt';
import { createUser } from '@test/users.factory';
import { StatusCodes } from 'http-status-codes';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '@app';

const app = createApp();

describe('tasks API', () => {
  let userToken: string;

  beforeEach(async () => {
    const user = await createUser();
    userToken = signAccess({ sub: user.id, email: user.email });
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it('lists empty initially', async () => {
    const res = await request(app)
      .get('/tasks')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body).toEqual([]);
  });

  it('creates and lists', async () => {
    const created = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Buy milk', priority: 1 });
    expect(created.status).toBe(StatusCodes.CREATED);
    expect(created.body.title).toBe('Buy milk');

    const list = await request(app)
      .get('/tasks')
      .set('Authorization', `Bearer ${userToken}`);
    expect(list.body).toHaveLength(1);
  });

  it('creates and marks as done', async () => {
    const created = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Buy milk', priority: 1 });

    const marked = await request(app)
      .patch(`/tasks/${created.body.id}/done`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(marked.status).toBe(StatusCodes.NO_CONTENT);
  });

  it('creates and updates', async () => {
    const created = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Buy milk', priority: 1 });

    const updated = await request(app)
      .put(`/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Buy milk changed', priority: 2, done: true });
    expect(updated.status).toBe(StatusCodes.ACCEPTED);
    expect(updated.body.title).toBe('Buy milk changed');
    expect(updated.body.priority).toBe(2);
    expect(updated.body.done).toBe(true);
  });

  it('rejects invalid input', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: '' });
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it('deletes', async () => {
    const c = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'temp', priority: 2 });
    const d = await request(app)
      .delete(`/tasks/${c.body.id}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(d.status).toBe(StatusCodes.NO_CONTENT);
  });

  describe('cross-user isolation', () => {
    let otherToken: string;

    beforeEach(async () => {
      const other = await createUser();
      otherToken = signAccess({ sub: other.id, email: other.email });
    });

    it('GET /:id returns 403 for another user task', async () => {
      const created = await request(app)
        .post('/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Private task', priority: 1 });

      const res = await request(app)
        .get(`/tasks/${created.body.id}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('DELETE /:id returns 403 for another user task', async () => {
      const created = await request(app)
        .post('/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Private task', priority: 1 });

      const res = await request(app)
        .delete(`/tasks/${created.body.id}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('PATCH /:id/done returns 403 for another user task', async () => {
      const created = await request(app)
        .post('/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Private task', priority: 1 });

      const res = await request(app)
        .patch(`/tasks/${created.body.id}/done`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('user sees only their own tasks', async () => {
      await request(app)
        .post('/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'My task', priority: 1 });
      await request(app)
        .post('/tasks')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ title: 'Their task', priority: 1 });

      const res = await request(app)
        .get('/tasks')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('My task');
    });
  });
});
