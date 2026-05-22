import { User } from '@users/repository';
import { RegisterUserBody } from '@users/schemas';
import { NextFunction, Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { StatusCodes } from 'http-status-codes';

import { taskService } from '@tasks/service';

import { userService } from './service';

function transformUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

export async function register(
  req: Request<ParamsDictionary, unknown, RegisterUserBody>,
  res: Response,
): Promise<void> {
  const { email, password, name } = req.body;

  const existing = await userService.findByEmail(email);

  if (existing) {
    res.status(StatusCodes.CONFLICT).json({ error: 'email_taken' });
  } else {
    const user = await userService.create(name, email, password);

    res.status(StatusCodes.CREATED).json(transformUser(user));
  }
}

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
