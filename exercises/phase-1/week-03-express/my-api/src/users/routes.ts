import { Router } from 'express';

import { validateBody } from '@middleware/validate';

import * as controller from './controller';
import { createUserSchema } from './schemas';

export const usersRouter = Router();

usersRouter.post('/', validateBody(createUserSchema), controller.create);
usersRouter.get('/:id/tasks', controller.tasks);
