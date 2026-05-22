import { Router } from 'express';

import { validateBody } from '@middleware/validate';

import * as controller from './controller';
import { registerUserSchema } from './schemas';

export const usersRouter = Router();

usersRouter.post(
  '/register',
  validateBody(registerUserSchema),
  controller.register,
);
usersRouter.get('/:id/tasks', controller.tasks);
