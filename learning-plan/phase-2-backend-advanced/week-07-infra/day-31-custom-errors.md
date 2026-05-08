# Day 31 — Custom error classes + global handler

## Goal
Replace the ad-hoc `instanceof X / instanceof Y` cascade in the error middleware with a single `AppError` base class and a unified handler.

## Estimated time
~1 hour.

## Prerequisites
Day 30 (DDD modules with their own error classes).

## Where to put your code
In `my-api`.

## Explanation

Right now `errorHandler` has one `if (err instanceof X) return res.status(...)` per error type. That works but doesn't scale: every new domain error needs a new branch.

The fix is a small base class. Every domain error sets two fields:
- `status` — the HTTP code (404, 409, …)
- `code` — a short machine-readable string (`task_not_found`)

The handler then becomes one line: `res.status(err.status).json({ error: err.code })`. Anything that is **not** an `AppError` is treated as 500 Internal Server Error.

Laravel analogy: this is `App\Exceptions\Handler` rendering custom exceptions. The pattern is the same — a base class + a single handler.

## Step-by-step

### 1. Define the base class

```ts name=src/shared/errors/AppError.ts
export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code: string;
  constructor(code = 'not_found', message = 'Not found') {
    super(message);
    this.code = code;
  }
}

export class ValidationError extends AppError {
  readonly status = 400;
  readonly code = 'validation_error';
}

export class UnauthorizedError extends AppError {
  readonly status = 401;
  readonly code: string;
  constructor(code = 'unauthorized', message = 'Unauthorized') {
    super(message);
    this.code = code;
  }
}

export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly code: string;
  constructor(code = 'forbidden', message = 'Forbidden') {
    super(message);
    this.code = code;
  }
}

export class ConflictError extends AppError {
  readonly status = 409;
  readonly code: string;
  constructor(code: string, message = 'Conflict') {
    super(message);
    this.code = code;
  }
}
```

### 2. Refactor the domain errors to extend the base

```ts name=src/modules/users/domain/errors.ts
import { ConflictError, UnauthorizedError } from '../../../shared/errors/AppError';

export class EmailTakenError extends ConflictError {
  constructor(email: string) { super('email_taken', `Email already taken: ${email}`); }
}

export class InvalidCredentialsError extends UnauthorizedError {
  constructor() { super('invalid_credentials', 'Invalid credentials'); }
}
```

```ts name=src/modules/tasks/domain/errors.ts
import { NotFoundError, ForbiddenError } from '../../../shared/errors/AppError';

export class TaskNotFoundError extends NotFoundError {
  constructor(id: string) { super('task_not_found', `Task not found: ${id}`); }
}

export class TaskNotOwnedError extends ForbiddenError {
  constructor() { super('task_not_owned', 'You do not own this task'); }
}
```

### 3. Generic error handler

```ts name=src/shared/http/errorHandler.ts
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../errors/AppError';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const ve = new ValidationError('Invalid input', err.flatten());
    return res.status(ve.status).json({ error: ve.code, details: ve.details });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error:   err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  console.error('[unhandled]', err);
  res.status(500).json({ error: 'internal_error' });
};
```

Update `src/app.ts` to use the new path:

```ts name=src/app.ts
import { errorHandler } from './shared/http/errorHandler';
// remove the old: import { errorHandler } from './middleware/errorHandler';
```

Delete `src/middleware/errorHandler.ts`.

### 4. Throw `AppError` subclasses everywhere

The DDD modules already throw subclasses — they just inherit from the new base now. Anywhere you still respond with `res.status(404).json(...)` directly, replace it with `throw new TaskNotFoundError(id)` and let the handler do its job.

## Test it

```ts name=src/shared/errors/AppError.test.ts
import { describe, it, expect } from 'vitest';
import { NotFoundError, ConflictError, ValidationError } from './AppError';

describe('AppError hierarchy', () => {
  it('NotFoundError carries status 404', () => {
    const e = new NotFoundError();
    expect(e.status).toBe(404);
    expect(e.code).toBe('not_found');
  });

  it('ConflictError can be subclassed with a custom code', () => {
    class EmailTakenError extends ConflictError {
      constructor() { super('email_taken'); }
    }
    const e = new EmailTakenError();
    expect(e.status).toBe(409);
    expect(e.code).toBe('email_taken');
  });

  it('ValidationError carries 400 + details', () => {
    const e = new ValidationError('bad', { field: 'email' });
    expect(e.status).toBe(400);
    expect(e.details).toEqual({ field: 'email' });
  });
});
```

Add an integration test that the handler returns the right shape:

```ts name=src/shared/http/errorHandler.test.ts
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from './errorHandler';
import { NotFoundError } from '../errors/AppError';

const app = express();
app.get('/boom', () => { throw new NotFoundError('thing_missing', 'Thing missing'); });
app.use(errorHandler);

describe('errorHandler', () => {
  it('translates AppError into JSON response', async () => {
    const res = await request(app).get('/boom');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'thing_missing', message: 'Thing missing' });
  });
});
```

```bash
npm test
```

## Mini-task
Write a `RateLimitError extends AppError` with `status = 429` and `code = 'rate_limited'`. Throw it from a fake route and assert the handler responds with 429.

## Glossary
- **Error code** — short, stable machine-readable string (`task_not_found`); safer for clients than parsing English messages.
- **`details`** — optional structured payload (e.g. Zod issues) attached to the error.
- **Discriminated handling** — handling errors by class (`instanceof AppError`) instead of by message inspection.

## Resources
- [Node.js — Error class](https://nodejs.org/api/errors.html#class-error)
- [Express — Error handling](https://expressjs.com/en/guide/error-handling.html)

## Checklist
- [ ] `AppError` base + 5 subclasses (`NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`)
- [ ] Module-specific errors (`EmailTakenError`, `TaskNotFoundError`, …) extend the new base
- [ ] `errorHandler` is a single function with no per-class branches
- [ ] `ZodError` is converted to `ValidationError` with `details`
- [ ] All previous Supertest tests still pass
