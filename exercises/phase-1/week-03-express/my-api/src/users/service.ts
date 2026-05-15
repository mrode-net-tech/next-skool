import { prismaUserRepository as userStore } from '@users/prisma.repository';

import { User } from './repository';

export const userService = {
  create(name: string, email: string): Promise<User> {
    return userStore.add(name, email);
  },
};
