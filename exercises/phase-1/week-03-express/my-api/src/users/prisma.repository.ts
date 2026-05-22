import { randomUUID } from 'node:crypto';

import { type User as PrismaUser } from '@prisma/client';

import { prisma } from '../db/prisma';

import type { User, UserRepository } from './repository';

function toDomainUser(row: PrismaUser): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
  };
}

export class PrismaUserRepository implements UserRepository {
  async reset(): Promise<void> {
    await prisma.user.deleteMany();
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { email } });

    if (row) {
      return toDomainUser(row);
    }

    return null;
  }

  async add(name: string, email: string, password: string): Promise<User> {
    const row = await prisma.user.create({
      data: {
        id: randomUUID(),
        name: name,
        email: email,
        password: password,
      },
    });
    return toDomainUser(row);
  }
}

export const prismaUserRepository = new PrismaUserRepository();
