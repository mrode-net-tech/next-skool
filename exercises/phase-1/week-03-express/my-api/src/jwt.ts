import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'dev_secret';

export type JwtPayload = { sub: string; email: string };

export function signAccess(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '15m' });
}

export function verifyAccess(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}
