import { authRouter } from '@auth/routes';
import { usersRouter } from '@users/routes';
import express from 'express';
import { StatusCodes } from 'http-status-codes';

import { errorHandler } from '@middleware/error-handler';
import { tasksRouter } from '@tasks/routes';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(errorHandler);

  app.get('/health', (_req, res) =>
    res.status(StatusCodes.OK).json({ status: 'ok' }),
  );
  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/tasks', tasksRouter);

  return app;
}
