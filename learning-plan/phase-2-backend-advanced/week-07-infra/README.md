# Week 7 — Errors, Logging, Config

**Goal:** Make `my-api` operable: a single error class hierarchy, structured JSON logs, type-safe environment variables, OpenAPI docs at `/docs`, and an `/api/v1` URL prefix.

## Days

- [Day 31 — Custom error classes + global handler](./day-31-custom-errors.md)
- [Day 32 — Pino logger + request log middleware](./day-32-pino-logger.md)
- [Day 33 — dotenv + Zod environment](./day-33-zod-env.md)
- [Day 34 — OpenAPI / Swagger docs](./day-34-openapi-swagger.md)
- [Day 35 — API versioning + tests](./day-35-api-versioning.md)

## Outcome

The `my-api` project is now operationally ready:

- A single `AppError` base class; `errorHandler` translates any `AppError` into the right HTTP status + JSON shape.
- Pino prints JSON logs (`{"level":30,"time":...,"msg":"req_complete"}`) ready for log aggregators.
- Every env var is validated by a Zod schema at startup; misconfiguration crashes with a clear message instead of a runtime surprise.
- `GET /docs` serves an interactive Swagger UI generated from Zod schemas.
- All routes live under `/api/v1`; older Supertest paths are updated.
