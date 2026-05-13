import { Router } from 'express';
import { getHealth } from '@controllers/health';

const router = Router();

router.get('/health', getHealth);

export default router;
