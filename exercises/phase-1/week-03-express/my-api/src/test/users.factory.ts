import { Prisma, type User } from '@prisma/client';

import { prisma } from '../db/prisma';

export async function createUser(
  overrides: Partial<Prisma.UserUncheckedCreateInput> = {},
): Promise<User> {
  return prisma.user.create({
    data: {
      email: `user-${crypto.randomUUID()}@test.com`,
      name: 'Test User',
      ...overrides,
    },
  });
}
