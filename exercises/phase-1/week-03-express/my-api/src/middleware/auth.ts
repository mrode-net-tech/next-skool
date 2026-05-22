import { verifyAccess } from '@auth/jwt';
import type { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: 'missing_token' });
  }

  const token = header.slice(7); // strip "Bearer "
  try {
    req.user = verifyAccess(token);
    next();
  } catch {
    res.status(StatusCodes.UNAUTHORIZED).json({ error: 'invalid_token' });
  }
}
