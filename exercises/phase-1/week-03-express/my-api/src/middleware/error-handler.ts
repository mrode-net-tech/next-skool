import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error(err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(StatusCodes.CONFLICT).json({
        error: 'unique_constraint_failed',
        message: 'A record with this value already exists.',
      });
      return;
    }

    if (err.code === 'P2003') {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'foreign_key_constraint_failed',
        message: 'Related record does not exist.',
      });
      return;
    }

    if (err.code === 'P2025') {
      res.status(StatusCodes.NOT_FOUND).json({
        error: 'not_found',
        message: 'Record not found.',
      });
      return;
    }
  }

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: 'internal_server_error',
  });
}
