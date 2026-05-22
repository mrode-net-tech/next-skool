import { randomBytes } from 'node:crypto';

import { prisma } from '../db/prisma';

const REFRESH_TTL_DAYS = 30;

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(48).toString('hex');
  const expiresAt = new Date(
    Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  await prisma.refreshToken.create({
    data: {
      token: token,
      user_id: userId,
      expires_at: expiresAt,
    },
  });
  return token;
}

export async function consumeRefreshToken(token: string) {
  const row = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!row) return null;
  if (row.expires_at < new Date()) {
    await prisma.refreshToken.delete({ where: { id: row.id } });
    return null;
  }
  return row;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token } });
}
