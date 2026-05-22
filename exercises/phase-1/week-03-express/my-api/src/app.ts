import { authRouter } from '@auth/routes';
import { usersRouter } from '@users/routes';
import express from 'express';
import { StatusCodes } from 'http-status-codes';

import { errorHandler } from '@middleware/error-handler';
import { tasksRouter } from '@tasks/routes';

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) =>
    res.status(StatusCodes.OK).json({ status: 'ok' }),
  );
  app.use('/auth', authRouter);
  app.use('/tasks', tasksRouter);
  app.use('/users', usersRouter);

  app.use(errorHandler);

  return app;
}
