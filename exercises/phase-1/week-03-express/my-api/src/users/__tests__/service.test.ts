import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';

import { userService } from '../service';

describe('userService', () => {
  it('creates a user', async () => {
    const user = await userService.create('Marek', 'marek@test.com', 'test');

    expect(user).toMatchObject({
      id: expect.any(String),
      name: 'Marek',
      email: 'marek@test.com',
    });

    expect(bcrypt.compareSync('test', user.password)).toBe(true);
  });
});
