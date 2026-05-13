import { Request, Response } from 'express';

export function getHome(_req: Request, res: Response) {
  res.status(200).json({ status: 'ok', name: 'my-api' });
}
