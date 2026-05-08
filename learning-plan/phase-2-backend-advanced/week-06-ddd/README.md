# Week 6 — DDD Structure

**Goal:** Refactor `my-api` into a layered, **Domain-Driven Design** structure. Business logic moves out of route handlers into use cases; data access moves behind repository interfaces; the wiring is done by a tiny DI container.

## Days

- [Day 26 — DDD layers explained](./day-26-ddd-layers.md)
- [Day 27 — Refactor users into a module](./day-27-users-module.md)
- [Day 28 — Use case classes](./day-28-use-cases.md)
- [Day 29 — Dependency injection (tsyringe)](./day-29-dependency-injection.md)
- [Day 30 — Refactor tasks into a module + tests](./day-30-tasks-refactor.md)

## Outcome

The `my-api` project now has a clean layered structure:

```
src/
├── modules/
│   ├── users/
│   │   ├── domain/         # entities, value objects, errors
│   │   ├── application/    # use cases (RegisterUser, LoginUser)
│   │   └── infrastructure/ # PrismaUserRepository, http routes
│   └── tasks/
│       ├── domain/
│       ├── application/    # CreateTask, ListTasksForUser, ...
│       └── infrastructure/
├── shared/                 # DI container, middleware, db
└── app.ts
```

- All business rules live in **use cases**.
- All DB access goes through **repository interfaces**, with Prisma implementations.
- Routes are thin: parse request → resolve use case from container → respond.
- The full Supertest suite is still green at the end.
