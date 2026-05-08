# Day 34 — OpenAPI / Swagger docs

## Goal
Generate an **OpenAPI 3** specification from your existing Zod schemas and serve interactive Swagger UI at `GET /docs`.

## Estimated time
~1.5 hours.

## Prerequisites
Days 31–33 (errors, logger, env). All routes use Zod for input validation.

## Where to put your code
In `my-api`.

## Explanation

An **OpenAPI spec** is a JSON/YAML document describing every endpoint: paths, methods, request bodies, responses. From it you can:
- generate client SDKs (TypeScript, PHP, Python).
- test contracts in CI.
- give frontend devs a live "try it out" UI.

We use [`@asteasolutions/zod-to-openapi`](https://github.com/asteasolutions/zod-to-openapi). It registers each Zod schema once, then derives the spec automatically — no duplicated documentation.

Laravel analogy: this is what `darkaonline/l5-swagger` does, but driven by your validation rules instead of PHPDoc annotations.

## Step-by-step

### 1. Install

```bash
npm i @asteasolutions/zod-to-openapi swagger-ui-express
npm i -D @types/swagger-ui-express
```

### 2. Extend Zod with the OpenAPI plugin (call once)

```ts name=src/shared/openapi/zod.ts
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export { z };
```

Use this re-exported `z` in any schema you want documented. (You can switch existing imports later — Zod plugins are global.)

### 3. Add OpenAPI metadata to schemas

```ts name=src/modules/users/infrastructure/http/schemas.ts
import { z } from '../../../../shared/openapi/zod';

export const RegisterSchema = z.object({
  email:    z.string().email().openapi({ example: 'alice@example.com' }),
  password: z.string().min(8).openapi({ example: 'super_secret_pw' }),
  name:     z.string().optional().openapi({ example: 'Alice' }),
}).openapi('RegisterInput');

export const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
}).openapi('LoginInput');

export const UserDTOSchema = z.object({
  id:        z.string().openapi({ example: 'cuid_xyz' }),
  email:     z.string().email(),
  name:      z.string().nullable(),
  createdAt: z.string().datetime(),
}).openapi('User');
```

### 4. Build the registry + document

```ts name=src/shared/openapi/registry.ts
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { RegisterSchema, LoginSchema, UserDTOSchema } from '../../modules/users/infrastructure/http/schemas';
import { CreateTaskSchema } from '../../modules/tasks/infrastructure/http/schemas';
import { z } from './zod';

export const registry = new OpenAPIRegistry();

const ErrorSchema = z.object({
  error:   z.string(),
  message: z.string().optional(),
}).openapi('Error');

registry.register('Error', ErrorSchema);
registry.register('User', UserDTOSchema);

// Bearer auth scheme
const bearer = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http', scheme: 'bearer', bearerFormat: 'JWT',
});

registry.registerPath({
  method: 'post', path: '/auth/register',
  request: { body: { content: { 'application/json': { schema: RegisterSchema } } } },
  responses: {
    201: { description: 'Created',  content: { 'application/json': { schema: UserDTOSchema } } },
    409: { description: 'Conflict', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method: 'post', path: '/auth/login',
  request: { body: { content: { 'application/json': { schema: LoginSchema } } } },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: z.object({
        accessToken:  z.string(),
        refreshToken: z.string(),
      }) } },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method: 'get', path: '/tasks',
  security: [{ [bearer.name]: [] }],
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: z.array(z.any()) } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method: 'post', path: '/tasks',
  security: [{ [bearer.name]: [] }],
  request: { body: { content: { 'application/json': { schema: CreateTaskSchema } } } },
  responses: {
    201: { description: 'Created' },
    400: { description: 'Validation error', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized',     content: { 'application/json': { schema: ErrorSchema } } },
  },
});

export function buildDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: { title: 'My API', version: '1.0.0', description: 'Task Manager API' },
    servers: [{ url: 'http://localhost:3000' }],
  });
}
```

### 5. Serve Swagger UI

```ts name=src/shared/http/docsRouter.ts
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildDocument } from '../openapi/registry';

export const docsRouter = Router();
const doc = buildDocument();

docsRouter.use('/', swaggerUi.serve, swaggerUi.setup(doc));
docsRouter.get('/openapi.json', (_req, res) => res.json(doc));
```

```ts name=src/app.ts
import { docsRouter } from './shared/http/docsRouter';
// after the other routes, BEFORE the error handler:
app.use('/docs', docsRouter);
```

### 6. Try it

```bash
npm run dev
# open http://localhost:3000/docs
# open http://localhost:3000/docs/openapi.json
```

Use the **Authorize** button in the UI to paste a JWT and call the protected endpoints right from the browser.

## Test it

```ts name=src/shared/openapi/registry.test.ts
import { describe, it, expect } from 'vitest';
import { buildDocument } from './registry';

describe('OpenAPI document', () => {
  const doc = buildDocument();

  it('declares all the main endpoints', () => {
    expect(doc.paths['/auth/register']).toBeDefined();
    expect(doc.paths['/auth/login']).toBeDefined();
    expect(doc.paths['/tasks']).toBeDefined();
  });

  it('declares the bearer security scheme', () => {
    expect(doc.components?.securitySchemes?.bearerAuth).toBeDefined();
  });

  it('register endpoint has 201 and 409 responses', () => {
    const op = doc.paths['/auth/register']?.post;
    expect(op?.responses['201']).toBeDefined();
    expect(op?.responses['409']).toBeDefined();
  });
});
```

```bash
npm test
```

## Mini-task
Document the `POST /auth/refresh` and `POST /auth/logout` routes. Verify `/docs` shows them with the right shapes.

## Glossary
- **OpenAPI** — vendor-neutral standard for describing REST APIs.
- **Swagger UI** — interactive HTML viewer for OpenAPI documents.
- **Schema registry** — collection of named schemas that the generator references; avoids inline duplication.
- **Security scheme** — declares how an endpoint expects credentials (here: Bearer JWT).

## Resources
- [zod-to-openapi](https://github.com/asteasolutions/zod-to-openapi)
- [OpenAPI 3.0 spec](https://swagger.io/specification/)
- [swagger-ui-express](https://github.com/scottie1984/swagger-ui-express)

## Checklist
- [ ] `extendZodWithOpenApi(z)` called once
- [ ] Schemas registered in the OpenAPI registry
- [ ] `GET /docs` shows interactive Swagger UI
- [ ] `GET /docs/openapi.json` returns valid OpenAPI 3 JSON
- [ ] Document tests pass
