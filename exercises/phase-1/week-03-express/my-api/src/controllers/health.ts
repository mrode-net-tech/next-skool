import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export function getHealth(_req: Request, res: Response) {
  res.status(StatusCodes.OK).json({ status: 'ok', uptime: process.uptime() });
}
