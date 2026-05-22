import { createUser } from '@test/users.factory';
import { StatusCodes } from 'http-status-codes';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '@app';

const app = createApp();

describe('auth API', () => {
  it('creates a user and returns 201 without password', async () => {
    const res = await request(app).post('/auth/register').send({
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
    const res = await request(app).post('/auth/register').send(data);
    expect(res.status).toBe(StatusCodes.CONFLICT);
  });

  it('returns 400 for a short password', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Alice',
      email: 'x@example.com',
      password: '123',
    });
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it('returns a token on valid credentials and user details', async () => {
    await createUser({ email: 'alice@example.com' });
    const res = await request(app).post('/auth/login').send({
      email: 'alice@example.com',
      password: 'test',
    });
    expect(res.status).toBe(StatusCodes.OK);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.split('.').length).toBe(3); // JWT shape

    const token = res.body.token;

    const me = await request(app)
      .get('/auth/me')
      .set({ Authorization: `Bearer ${token}` });
    expect(me.status).toBe(StatusCodes.OK);
    expect(me.body.email).toBe('alice@example.com');
    expect(me.body.password).toBeUndefined();
  });

  it('returns 401 on wrong password', async () => {
    await createUser({ email: 'alice@example.com' });
    const res = await request(app).post('/auth/login').send({
      email: 'alice@example.com',
      password: 'wrong',
    });
    expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'ghost@example.com',
      password: 'whatever',
    });
    expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
  });
});
