import { Router } from 'express';

import { requireAuth } from '@middleware/auth';
import { validateBody } from '@middleware/validate';

import * as controller from './controller';
import { loadTask } from './middleware';
import { createTaskSchema, updateTaskSchema } from './schemas';

export const tasksRouter = Router();

tasksRouter.use(requireAuth);
tasksRouter.get('/', controller.list);
tasksRouter.post('/', validateBody(createTaskSchema), controller.create);
tasksRouter.get('/:id', loadTask, controller.show);
tasksRouter.put('/:id', loadTask, validateBody(updateTaskSchema), controller.update);
tasksRouter.delete('/:id', loadTask, controller.remove);
tasksRouter.patch('/:id/done', loadTask, controller.markDone);
