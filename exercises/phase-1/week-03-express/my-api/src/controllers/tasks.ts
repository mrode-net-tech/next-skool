import { NextFunction, Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { StatusCodes } from 'http-status-codes';
import { taskStore } from '@services/tasks';

interface TaskQuery {
  done?: string;
}

export function getTasks(
  req: Request<ParamsDictionary, unknown, unknown, TaskQuery>,
  res: Response,
  next: NextFunction,
) {
  try {
    let filter: { done: boolean } | undefined;
    if (req.query.done === 'true') filter = { done: true };
    else if (req.query.done === 'false') filter = { done: false };
    res.status(StatusCodes.OK).json(taskStore.list(filter));
  } catch (err) {
    next(err);
  }
}

export function getTask(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const t = taskStore.find(req.params.id);
    if (!t) {
      res.status(StatusCodes.NOT_FOUND).json({ error: 'not found' });
      return;
    }
    res.json(t);
  } catch (err) {
    next(err);
  }
}

export function addTask(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { title } = req.body ?? {};
    if (typeof title !== 'string' || title.trim() === '') {
      res.status(StatusCodes.BAD_REQUEST).json({ error: 'title required' });
      return;
    }
    const t = taskStore.add(title.trim());
    res.status(StatusCodes.CREATED).json(t);
  } catch (err) {
    next(err);
  }
}

export function deleteTask(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    taskStore.remove(req.params.id);
    res.status(StatusCodes.NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
}

export function markTaskDone(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    taskStore.markDone(req.params.id);
    res.status(StatusCodes.NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
}
