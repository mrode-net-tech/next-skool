export type Role = 'admin' | 'user';

export interface User {
  readonly id: string;
  readonly role: Role;
  email: string;
  name?: string;
}

export function describeUser(user: User): string {
  const name = user.name ?? user.email;
  return `${name} (${user.role})`;
}

export function isAdmin(user: User): boolean {
  return user.role === 'admin';
}
