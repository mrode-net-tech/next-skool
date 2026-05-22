import { LoginUserBody, RegisterUserBody } from '@auth/schemas';
import { User } from '@users/repository';
import { userService } from '@users/service';
import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { StatusCodes } from 'http-status-codes';

import { signAccess } from '../jwt';

function transformUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

export async function register(
  req: Request<ParamsDictionary, unknown, RegisterUserBody>,
  res: Response,
): Promise<void> {
  const { email, password, name } = req.body;

  const existing = await userService.findByEmail(email);

  if (existing) {
    res.status(StatusCodes.CONFLICT).json({ error: 'email_taken' });
  } else {
    const user = await userService.create(name, email, password);

    res.status(StatusCodes.CREATED).json(transformUser(user));
  }
}

export async function login(
  req: Request<ParamsDictionary, unknown, LoginUserBody>,
  res: Response,
): Promise<void> {
  const { email, password } = req.body;

  const user = await userService.findByEmail(email);
  if (!user) {
    res.status(StatusCodes.UNAUTHORIZED).json({ error: 'invalid_credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(StatusCodes.UNAUTHORIZED).json({ error: 'invalid_credentials' });
    return;
  }

  const token = signAccess({ sub: user.id, email: user.email });
  res.json({ token });
}
