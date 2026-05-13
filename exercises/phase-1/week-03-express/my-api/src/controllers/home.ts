import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export function getHome(_req: Request, res: Response) {
  res.status(StatusCodes.OK).json({ status: 'ok', name: 'my-api' });
}
