import { Prisma, type User } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { prisma } from '../db/prisma';

export async function createUser(
  overrides: Partial<Prisma.UserUncheckedCreateInput> = {},
): Promise<User> {
  const hash = await bcrypt.hash('test', 10);

  return prisma.user.create({
    data: {
      email: `user-${crypto.randomUUID()}@test.com`,
      name: 'Test User',
      password: hash,
      ...overrides,
    },
  });
}
