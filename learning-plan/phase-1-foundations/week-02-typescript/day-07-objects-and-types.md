# Day 7 — Objects and type aliases

## Goal
Describe object shapes with `type` aliases and `interface`.

## Estimated time
~1 hour.

## Where to put your code
`exercises/phase-1/week-02-typescript/ts-playground/`

## Explanation

- `type` and `interface` both describe object shapes.
- Use `type` for unions, primitives, computed types. Use `interface` for objects you may extend.
- **Optional fields:** `name?: string`.
- **Readonly:** `readonly id: string`.

## Step-by-step

```ts name=src/user.ts
export type Role = 'admin' | 'user';

export interface User {
  readonly id: string;
  email: string;
  displayName?: string;
  role: Role;
}

export function describeUser(u: User): string {
  const name = u.displayName ?? u.email;
  return `${name} (${u.role})`;
}
```

```ts name=src/user.test.ts
import { describe, it, expect } from 'vitest';
import { describeUser, type User } from './user';

describe('describeUser', () => {
  it('uses email when displayName missing', () => {
    const u: User = { id: '1', email: 'a@b.c', role: 'user' };
    expect(describeUser(u)).toBe('a@b.c (user)');
  });

  it('prefers displayName when present', () => {
    const u: User = { id: '1', email: 'a@b.c', displayName: 'Ada', role: 'admin' };
    expect(describeUser(u)).toBe('Ada (admin)');
  });
});
```

## Mini-task
Add a function `isAdmin(u: User): boolean` and tests for both roles.

## Glossary
- **Type alias** — a named shape (`type User = { ... }`).
- **Interface** — a named, extensible object shape.
- **Union type** — `'admin' | 'user'`.
- **Optional property** — `name?: string`.

## Resources
- [TS — Object types](https://www.typescriptlang.org/docs/handbook/2/objects.html)
- [TS — type vs interface](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#differences-between-type-aliases-and-interfaces)

## Checklist
- [ ] You used both `type` and `interface`
- [ ] Tests pass
