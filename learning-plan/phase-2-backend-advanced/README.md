# Phase 2 — Backend Advanced (Weeks 5–8)

**Goal:** Take the `my-api` project from Phase 1 and make it production-quality: real authentication, clean architecture, structured logging, and a solid test suite.

## Outcome at the end of phase 2

You have a **production-ready Task Manager API** built with:
- JWT authentication (access + refresh tokens) with bcrypt-hashed passwords
- Domain-Driven Design folder structure (domain / application / infrastructure)
- tsyringe dependency injection container
- Custom error hierarchy + global error handler
- Pino structured JSON logging
- Zod-validated environment variables
- OpenAPI docs served at `/docs`
- Vitest coverage report ≥ 80 %

## Weeks

| Week | Topic | Folder |
| ---- | ----- | ------ |
| 5 | JWT Authentication | [`week-05-auth`](./week-05-auth/) |
| 6 | DDD Structure | [`week-06-ddd`](./week-06-ddd/) |
| 7 | Errors, Logging, Config | [`week-07-infra`](./week-07-infra/) |
| 8 | Testing Deep Dive | [`week-08-testing`](./week-08-testing/) |

## Mindset for a Laravel dev entering this phase

**Architecture first, magic never.** Laravel gives you `Auth::user()`, service providers, and facades. In Node you build each piece yourself — but you'll understand exactly what it does. The DDD structure in Week 6 will feel familiar: it maps closely to Laravel's Service/Action/Repository pattern.

**Errors are just values.** Node doesn't have PHP exceptions propagating through a framework handler. You'll build your own error class hierarchy and a single Express error middleware that converts domain errors into HTTP responses. This is actually cleaner than try/catch everywhere.

**Tests fund confidence.** In Phase 1 tests were a bonus. In Phase 2 they are mandatory. Each day has a "Test it" section — run it before moving on. By Day 40 you'll have a fast, isolated, deterministic test suite you can trust.
