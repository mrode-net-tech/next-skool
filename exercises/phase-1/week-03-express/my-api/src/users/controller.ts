import { NextFunction, Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { StatusCodes } from 'http-status-codes';

import { taskService } from '@tasks/service';

import { type CreateUserBody } from './schemas';
import { userService } from './service';

export async function create(
  req: Request<ParamsDictionary, unknown, CreateUserBody>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const t = await userService.create(req.body.name, req.body.email);
    res.status(StatusCodes.CREATED).json(t);
  } catch (err) {
    next(err);
  }
}

export async function tasks(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const t = await taskService.list({userId: req.params.id});
    if (!t) {
      res.status(StatusCodes.NOT_FOUND).json({ error: 'not found' });
      return;
    }
    res.json(t);
  } catch (err) {
    next(err);
  }
}
