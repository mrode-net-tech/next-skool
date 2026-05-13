import { z } from 'zod';

import { type Priority } from '@services/tasks';

const PRIORITIES = [1, 2, 3] as const satisfies Priority[];

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  priority: z.union([
    z.literal(PRIORITIES[0]),
    z.literal(PRIORITIES[1]),
    z.literal(PRIORITIES[2]),
  ]),
});

export type CreateTaskBody = z.infer<typeof createTaskSchema>;
