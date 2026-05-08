# Week 8 — Testing Deep Dive

**Goal:** Master the three test layers (unit / integration / e2e), mocking with Vitest, isolated test databases, coverage thresholds, and refactoring tests for speed and determinism.

## Days

- [Day 36 — Unit vs integration vs e2e](./day-36-test-types.md)
- [Day 37 — Mocking with Vitest](./day-37-vitest-mocking.md)
- [Day 38 — Test database setup](./day-38-test-database.md)
- [Day 39 — Coverage reports](./day-39-coverage.md)
- [Day 40 — Refactor tests for speed](./day-40-refactor-tests.md)

## Outcome

`my-api` ends Phase 2 with:

- A clear test pyramid: many unit tests, some integration, a handful of e2e.
- Pure use cases tested with **fakes**, no database needed.
- Integration tests run against an isolated test database that's reset between cases.
- `npm run test:coverage` produces an HTML report; CI fails below 80% line coverage.
- The whole suite runs in seconds in parallel.

## Phase 2 wrap-up

After Day 40, `my-api` is a real backend project: typed Express, Prisma, JWT auth, DDD modules, errors, logging, env validation, OpenAPI, versioning, and a proper test suite. Ready for Phase 3 (the React frontend that will consume it).
