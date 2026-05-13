import { Router } from 'express';

import {
  addTask,
  deleteTask,
  getTask,
  getTasks,
  markTaskDone,
} from '@controllers/tasks';
import { validateBody } from '@middleware/validator-handler';
import { createTaskSchema } from '@schemas/task';

const router = Router();

router.get('/tasks', getTasks);
router.get('/tasks/:id', getTask);
router.post('/tasks', validateBody(createTaskSchema), addTask);
router.delete('/tasks/:id', deleteTask);
router.patch('/tasks/:id/done', markTaskDone);

export default router;
