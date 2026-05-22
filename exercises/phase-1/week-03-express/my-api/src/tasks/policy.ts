import type { JwtPayload } from '@auth/jwt';

import { Task } from '@tasks/repository';

export const taskPolicy = {
  canAccess: (user: JwtPayload, task: Task) => task.userId === user.sub,
};
