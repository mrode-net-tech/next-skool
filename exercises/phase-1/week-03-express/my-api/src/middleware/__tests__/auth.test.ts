import { signAccess } from '@auth/jwt';
import { StatusCodes } from 'http-status-codes';
import request from 'supertest';
import { describe, it, expect } from 'vitest';

import { createApp } from '@app';

const app = createApp();

describe('auth middleware', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(res.body.error).toBe('missing_token');
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/tasks')
      .set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
    expect(res.body.error).toBe('invalid_token');
  });

  it('passes through with a valid token', async () => {
    const token = signAccess({ sub: 'user-1', email: 'a@example.com' });
    const res = await request(app)
      .get('/tasks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(StatusCodes.OK);
  });
});
