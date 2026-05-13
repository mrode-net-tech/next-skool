import { Router } from 'express';

import { validateBody } from '@middleware/validate';

import * as controller from './controller';
import { createTaskSchema } from './schemas';

export const tasksRouter = Router();

tasksRouter.get('/', controller.list);
tasksRouter.get('/:id', controller.show);
tasksRouter.post('/', validateBody(createTaskSchema), controller.create);
tasksRouter.delete('/:id', controller.remove);
tasksRouter.patch('/:id/done', controller.markDone);
