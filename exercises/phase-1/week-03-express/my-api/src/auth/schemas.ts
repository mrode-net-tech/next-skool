import { z } from 'zod';

export const registerUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'password must be at least 8 characters'),
  name: z.string().min(1),
});

export type RegisterUserBody = z.infer<typeof registerUserSchema>;

export const loginUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginUserBody = z.infer<typeof loginUserSchema>;

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(10),
});

export type RefreshTokenBody = z.infer<typeof refreshTokenSchema>;
