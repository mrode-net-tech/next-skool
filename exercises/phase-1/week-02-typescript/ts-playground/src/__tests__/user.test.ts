import {describe, it, expect, test} from 'vitest';
import {describeUser, isAdmin, type User} from '../user';

describe('describeUser', () => {
  it('uses email when displayName missing', () => {
    const user: User = { id: '1', email: 'a@b.c', role: 'user' };
    expect(describeUser(user)).toBe('a@b.c (user)');
  });

  it('prefers displayName when present', () => {
    const user: User = { id: '1', email: 'a@b.c', name: 'Ada', role: 'admin' };
    expect(describeUser(user)).toBe('Ada (admin)');
  });

  test.each([
    {
      label: 'regular user',
      user: { id: '1', role: 'user', email: 'user@example.com' } satisfies User,
      expected: false
    },
    {
      label: 'admin user',
      user: { id: '1', role: 'admin', email: 'user@example.com' } satisfies User,
      expected: true
    }
  ])('verifies user roles when present', ({ user, expected }) => {
    expect(isAdmin(user)).toBe(expected);
  })
});
