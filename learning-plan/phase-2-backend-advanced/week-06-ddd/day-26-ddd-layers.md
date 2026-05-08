# Day 26 — DDD layers explained

## Goal
Understand the four-layer DDD structure we'll use for the rest of the course. No code changes today — just sketches and decisions.

## Estimated time
~45 minutes.

## Prerequisites
Phase 1 + Week 5 (you have a working `my-api` with auth and Prisma).

## Where to put your code
Nothing to commit. Take notes in `exercises/phase-2/week-06-ddd/notes.md` if you like.

## Explanation

**Domain-Driven Design (DDD)** is a way of organising code so that business rules are independent of frameworks, databases, and HTTP. The pieces you write today will work the same whether the API is Express, Fastify, or a CLI.

We use **four layers**, each depending only on the layer below:

| Layer            | Responsibility                                              | Knows about       | Examples                              |
| ---------------- | ----------------------------------------------------------- | ----------------- | ------------------------------------- |
| `infrastructure` | Talks to the outside world: HTTP, DB, queues, email         | application       | `tasksRouter`, `PrismaTaskRepository` |
| `application`    | Orchestrates the domain to fulfil a use case                | domain            | `CreateTask`, `LoginUser`             |
| `domain`         | Pure business rules — entities, value objects, domain errors| nothing           | `Task`, `Email`, `InvalidPasswordError`|
| `shared`         | Cross-cutting glue (DI container, logger, config, errors)   | nothing           | `container`, `logger`                 |

**Dependency direction:** `infrastructure → application → domain`. Domain never imports from above.

### Laravel comparison

| Laravel                       | This course (DDD)                       |
| ----------------------------- | --------------------------------------- |
| Controller                    | `infrastructure/http/*Router.ts`        |
| Action / Service              | `application/*UseCase.ts`               |
| Eloquent model + Repository   | `domain/*.ts` (entity) + `infrastructure/Prisma*Repository.ts` |
| Form Request                  | Zod schema in `infrastructure/http/`    |
| Service Provider              | `shared/container.ts`                   |
| Custom exception              | `domain/errors.ts`                      |

### Why bother?

1. **Testable in isolation.** A use case test instantiates the use case with an in-memory repository — no DB, no HTTP. Tests run in milliseconds.
2. **Swap implementations.** Move from Prisma to Drizzle by writing one new repository class. Domain code is untouched.
3. **Bounded contexts.** Each `modules/<name>/` folder is self-contained. New developers ramp up by reading one folder.

## Step-by-step

### 1. Sketch the target structure on paper

```
src/
├── modules/
│   ├── users/
│   │   ├── domain/
│   │   │   ├── User.ts                     # entity
│   │   │   ├── UserRepository.ts           # interface
│   │   │   └── errors.ts                   # EmailTakenError, InvalidCredentialsError
│   │   ├── application/
│   │   │   ├── RegisterUser.ts             # use case
│   │   │   └── LoginUser.ts                # use case
│   │   └── infrastructure/
│   │       ├── PrismaUserRepository.ts     # implements UserRepository
│   │       └── http/
│   │           ├── authRouter.ts
│   │           └── schemas.ts              # Zod
│   └── tasks/                              # same shape
└── shared/
    ├── container.ts                        # tsyringe config
    ├── errors.ts                           # base AppError
    └── http/
        ├── errorHandler.ts                 # turns AppError → res.status
        └── validate.ts                     # Zod middleware
```

### 2. Choose the use-case shape

Every use case is a class with a single `execute` method. It receives its dependencies in the constructor and returns a plain DTO.

```ts
// Example only — you'll build this in Day 28.
class RegisterUser {
  constructor(private users: UserRepository, private hasher: Hasher) {}
  async execute(input: { email: string; password: string }): Promise<UserDTO> { ... }
}
```

### 3. Choose the repository shape

A repository is an interface in `domain/`, implemented in `infrastructure/`. It speaks the domain language — `findByEmail(email)`, not `prisma.user.findUnique({ where: { email } })`.

```ts
// domain/UserRepository.ts
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
```

### 4. Decide what NOT to do

- **No anaemic domain** with getters/setters only. The `User` entity owns its invariants (e.g. `User.changeEmail(newEmail)` validates).
- **No leaky abstractions.** Repository never returns Prisma objects; it returns domain entities.
- **No god services.** Each use case does one thing.

## Test it

There is nothing to run today. Instead, write down on paper:

1. Three use cases the API currently performs (e.g. `RegisterUser`, `CreateTaskForUser`, `ListMyTasks`).
2. For each, list the inputs, the outputs, and the dependencies it would need.
3. Which Prisma calls live where (in current code) and which layer they would belong in after refactoring.

If you can answer these without checking the code, you understand the model well enough to start.

## Mini-task
Open the current `my-api` source and label every file with one of: `domain`, `application`, `infrastructure`, `shared`. Note files that mix concerns — those are the prime refactor targets in Days 27 and 30.

## Glossary
- **Entity** — a domain object with identity (`User`, `Task`).
- **Value object** — immutable, compared by value (`Email`, `Money`).
- **Use case** — a single application operation (`RegisterUser`).
- **Repository** — abstraction over data access for a specific aggregate.
- **Bounded context** — a slice of the domain with its own ubiquitous language; here, each `modules/<x>/` folder.

## Resources
- [Eric Evans — DDD Reference (PDF)](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)
- [Khalil Stemmler — DDD in TypeScript](https://khalilstemmler.com/articles/domain-driven-design-intro/)

## Checklist
- [ ] You can recite the four layers and what each may import.
- [ ] You labelled every file in current `my-api` with a layer name.
- [ ] You wrote inputs / outputs / deps for at least three use cases.
