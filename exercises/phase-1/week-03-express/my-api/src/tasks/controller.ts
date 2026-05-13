import { NextFunction, Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { StatusCodes } from 'http-status-codes';

import { type CreateTaskBody, UpdateTaskBody } from './schemas';
import { taskService } from './service';

interface TaskQuery {
  done?: string;
}

export async function list(
  req: Request<ParamsDictionary, unknown, unknown, TaskQuery>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    let filter: { done: boolean } | undefined;
    if (req.query.done === 'true') filter = { done: true };
    else if (req.query.done === 'false') filter = { done: false };
    res.status(StatusCodes.OK).json(await taskService.list(filter));
  } catch (err) {
    next(err);
  }
}

export async function show(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const t = await taskService.find(req.params.id);
    if (!t) {
      res.status(StatusCodes.NOT_FOUND).json({ error: 'not found' });
      return;
    }
    res.json(t);
  } catch (err) {
    next(err);
  }
}

export async function create(
  req: Request<ParamsDictionary, unknown, CreateTaskBody>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const t = await taskService.create(req.body.title, req.body.priority);
    res.status(StatusCodes.CREATED).json(t);
  } catch (err) {
    next(err);
  }
}

export async function update(
  req: Request<{ id: string }, unknown, UpdateTaskBody>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const t = await taskService.update(
      req.params.id,
      req.body.title,
      req.body.priority,
      req.body.done,
    );
    res.status(StatusCodes.ACCEPTED).json(t);
  } catch (err) {
    next(err);
  }
}

export async function remove(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const removed = await taskService.remove(req.params.id);
    if (!removed) {
      res.status(StatusCodes.NOT_FOUND).json({ error: 'not found' });
      return;
    }

    res.status(StatusCodes.NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
}

export async function markDone(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await taskService.markDone(req.params.id);
    res.status(StatusCodes.NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
}
