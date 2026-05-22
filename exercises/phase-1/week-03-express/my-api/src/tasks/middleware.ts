import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { taskPolicy } from './policy';
import { taskService } from './service';

export async function loadTask(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const t = await taskService.find(req.params.id);
  if (!t) {
    res.status(StatusCodes.NOT_FOUND).json({ error: 'not found' });
    return;
  }
  if (!taskPolicy.canAccess(req.user!, t)) {
    res.status(StatusCodes.FORBIDDEN).json({ error: 'forbidden' });
    return;
  }
  req.task = t;
  next();
}
