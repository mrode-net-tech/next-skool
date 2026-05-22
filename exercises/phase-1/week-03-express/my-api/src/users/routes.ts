import { Router } from 'express';

import * as controller from './controller';

export const usersRouter = Router();

usersRouter.get('/:id/tasks', controller.tasks);
