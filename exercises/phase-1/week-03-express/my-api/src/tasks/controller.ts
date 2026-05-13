import { NextFunction, Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { StatusCodes } from 'http-status-codes';

import { type CreateTaskBody } from './schemas';
import { taskService } from './service';

interface TaskQuery {
  done?: string;
}

export function list(
  req: Request<ParamsDictionary, unknown, unknown, TaskQuery>,
  res: Response,
  next: NextFunction,
): void {
  try {
    let filter: { done: boolean } | undefined;
    if (req.query.done === 'true') filter = { done: true };
    else if (req.query.done === 'false') filter = { done: false };
    res.status(StatusCodes.OK).json(taskService.list(filter));
  } catch (err) {
    next(err);
  }
}

export function show(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): void {
  try {
    const t = taskService.find(req.params.id);
    if (!t) {
      res.status(StatusCodes.NOT_FOUND).json({ error: 'not found' });
      return;
    }
    res.json(t);
  } catch (err) {
    next(err);
  }
}

export function create(
  req: Request<ParamsDictionary, unknown, CreateTaskBody>,
  res: Response,
  next: NextFunction,
): void {
  try {
    const t = taskService.create(req.body.title, req.body.priority);
    res.status(StatusCodes.CREATED).json(t);
  } catch (err) {
    next(err);
  }
}

export function remove(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): void {
  try {
    taskService.remove(req.params.id);
    res.status(StatusCodes.NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
}

export function markDone(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): void {
  try {
    taskService.markDone(req.params.id);
    res.status(StatusCodes.NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
}
