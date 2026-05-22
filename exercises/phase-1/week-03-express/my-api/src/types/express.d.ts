import type { JwtPayload } from '@auth/jwt';

import type { Task } from '@tasks/repository';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      task?: Task;
    }
  }
}
