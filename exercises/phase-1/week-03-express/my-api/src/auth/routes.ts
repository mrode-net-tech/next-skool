import { Router } from 'express';

import { validateBody } from '@middleware/validate';

import * as controller from './controller';
import { loginUserSchema, registerUserSchema } from './schemas';

export const authRouter = Router();

authRouter.post(
  '/register',
  validateBody(registerUserSchema),
  controller.register,
);

authRouter.post('/login', validateBody(loginUserSchema), controller.login);
