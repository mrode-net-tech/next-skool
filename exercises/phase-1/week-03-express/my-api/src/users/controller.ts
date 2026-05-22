import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { taskService } from '@tasks/service';

export async function tasks(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const t = await taskService.list({ userId: req.params.id });
    if (!t) {
      res.status(StatusCodes.NOT_FOUND).json({ error: 'not found' });
      return;
    }
    res.json(t);
  } catch (err) {
    next(err);
  }
}
