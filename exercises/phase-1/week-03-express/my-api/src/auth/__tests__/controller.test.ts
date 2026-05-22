import { createUser } from '@test/users.factory';
import { StatusCodes } from 'http-status-codes';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '@app';

import { prisma } from '../../db/prisma';

const app = createApp();

async function loginAs(email: string, password = 'test') {
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body as { accessToken: string; refreshToken: string };
}

describe('auth API', () => {
  describe('POST /auth/register', () => {
    it('creates user and returns 201 without password', async () => {
      const res = await request(app).post('/auth/register').send({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'secret123',
      });
      expect(res.status).toBe(StatusCodes.CREATED);
      expect(res.body.email).toBe('alice@example.com');
      expect(res.body.password).toBeUndefined();
    });

    it('returns 409 when email already taken', async () => {
      await createUser({ email: 'bob@example.com' });
      const res = await request(app).post('/auth/register').send({
        name: 'Bob',
        email: 'bob@example.com',
        password: 'secret123',
      });
      expect(res.status).toBe(StatusCodes.CONFLICT);
    });

    it('returns 400 for short password', async () => {
      const res = await request(app).post('/auth/register').send({
        name: 'Alice',
        email: 'x@example.com',
        password: '123',
      });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await createUser({ email: 'alice@example.com' });
    });

    it('returns accessToken and refreshToken on valid credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'alice@example.com', password: 'test' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.accessToken.split('.').length).toBe(3); // JWT shape
      expect(typeof res.body.refreshToken).toBe('string');
    });

    it('returns 401 on wrong password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'alice@example.com', password: 'wrong' });
      expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('returns 401 for unknown email', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'ghost@example.com', password: 'test' });
      expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('GET /auth/me', () => {
    it('returns user profile for valid token', async () => {
      const user = await createUser({ email: 'alice@example.com' });
      const { accessToken } = await loginAs('alice@example.com');

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.email).toBe('alice@example.com');
      expect(res.body.id).toBe(user.id);
      expect(res.body.password).toBeUndefined();
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues new accessToken for valid refresh token', async () => {
      await createUser({ email: 'alice@example.com' });
      const { refreshToken } = await loginAs('alice@example.com');

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken });
      expect(res.status).toBe(StatusCodes.OK);
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.accessToken.split('.').length).toBe(3);
    });

    it('returns 401 for unknown refresh token', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({ refresh_token: 'definitely-not-a-real-token-xxxxxxxxxx' });
      expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('returns 401 and deletes expired refresh token', async () => {
      const user = await createUser({ email: 'alice@example.com' });
      const expiredToken = 'expired-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      await prisma.refreshToken.create({
        data: {
          token: expiredToken,
          user_id: user.id,
          expires_at: new Date(Date.now() - 1000),
        },
      });

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refresh_token: expiredToken });
      expect(res.status).toBe(StatusCodes.UNAUTHORIZED);

      const row = await prisma.refreshToken.findUnique({
        where: { token: expiredToken },
      });
      expect(row).toBeNull();
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 204 and revokes refresh token', async () => {
      await createUser({ email: 'alice@example.com' });
      const { refreshToken } = await loginAs('alice@example.com');

      const out = await request(app)
        .post('/auth/logout')
        .send({ refresh_token: refreshToken });
      expect(out.status).toBe(StatusCodes.NO_CONTENT);

      const reuse = await request(app)
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken });
      expect(reuse.status).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('returns 204 even for unknown token (idempotent)', async () => {
      const res = await request(app).post('/auth/logout').send({
        refresh_token: 'unknown-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      });
      expect(res.status).toBe(StatusCodes.NO_CONTENT);
    });
  });
});
