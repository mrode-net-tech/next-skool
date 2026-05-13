import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z, type ZodSchema } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: 'validation_failed',
        details: z.flattenError(parsed.error).fieldErrors,
      });
    }
    req.body = parsed.data;
    next();
  };
}
