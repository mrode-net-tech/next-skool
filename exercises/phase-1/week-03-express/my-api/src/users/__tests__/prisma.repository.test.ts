import { describe, expect, it } from 'vitest';

import { prisma } from '../../db/prisma';
import { PrismaUserRepository } from '../prisma.repository';

describe('PrismaUserRepository', () => {
  const repository = new PrismaUserRepository();

  it('adds a user', async () => {
    const user = await repository.add('Marek', 'marek@test.com', 'test');

    expect(user).toMatchObject({
      id: expect.any(String),
      name: 'Marek',
      email: 'marek@test.com',
    });
  });

  it('resets users', async () => {
    await repository.add('Marek', 'marek@test.com', 'test');

    await repository.reset();

    await expect(prisma.user.count()).resolves.toBe(0);
  });
});
