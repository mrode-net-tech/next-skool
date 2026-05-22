import { Router } from 'express';

import { requireAuth } from '@middleware/auth';
import { validateBody } from '@middleware/validate';

import * as controller from './controller';
import {
  loginUserSchema,
  refreshTokenSchema,
  registerUserSchema,
} from './schemas';

export const authRouter = Router();

authRouter.post(
  '/register',
  validateBody(registerUserSchema),
  controller.register,
);

authRouter.post('/login', validateBody(loginUserSchema), controller.login);
authRouter.post('/logout', validateBody(refreshTokenSchema), controller.logout);
authRouter.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  controller.refresh,
);

authRouter.use(requireAuth);
authRouter.get('/me', controller.me);
