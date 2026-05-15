import 'dotenv/config';

import { execSync } from 'node:child_process';

import { beforeAll, beforeEach } from 'vitest';

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

beforeAll(() => {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST },
  });
});

beforeEach(async () => {
  const { prisma } = await import('../db/prisma.js');
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
});
