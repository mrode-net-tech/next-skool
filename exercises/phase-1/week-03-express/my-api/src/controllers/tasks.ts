import { Request, Response } from 'express';
import { taskStore } from '@services/tasks';

interface TaskQuery {
  done?: string;
}

export function getTasks(req: Request<{}, {}, {}, TaskQuery>, res: Response) {
  const filter =
    req.query.done === 'true'
      ? { done: true }
      : req.query.done === 'false'
        ? { done: false }
        : undefined;
  res.status(200).json(taskStore.list(filter));
}

export function getTask(req: Request<{ id: string }>, res: Response) {
  const t = taskStore.find(req.params.id);
  if (!t) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json(t);
}
