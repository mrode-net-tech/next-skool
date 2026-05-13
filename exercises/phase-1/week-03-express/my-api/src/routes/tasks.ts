import { Router } from 'express';
import { getTask, getTasks } from '@controllers/tasks';

const router = Router();

router.get('/tasks', getTasks);
router.get('/tasks/:id', getTask);

export default router;
