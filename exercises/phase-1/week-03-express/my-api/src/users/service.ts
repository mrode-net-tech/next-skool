import { prismaUserRepository as userStore } from '@users/prisma.repository';
import bcrypt from 'bcryptjs';

import { User } from './repository';

export const userService = {
  async findById(id: string): Promise<User> {
    return userStore.findById(id);
  },

  async findByEmail(email: string): Promise<User | null> {
    return userStore.findByEmail(email);
  },

  async create(name: string, email: string, password: string): Promise<User> {
    const hash = await bcrypt.hash(password, 10);
    return userStore.add(name, email, hash);
  },
};
