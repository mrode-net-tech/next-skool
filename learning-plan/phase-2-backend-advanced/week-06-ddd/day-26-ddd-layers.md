# Day 26 — DDD layers explained

## Goal
Understand the four-layer DDD structure and CQRS-inspired command/query split we'll use for the rest of the course. No code changes today — just sketches and decisions.

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
| `application`    | Orchestrates the domain to fulfil a use case                | domain            | `CreateTask`, `ListMyTasks`           |
| `domain`         | Pure business rules — entities, value objects, domain errors| nothing           | `Task`, `Email`, `InvalidPasswordError`|
| `shared`         | Cross-cutting glue (DI container, logger, config, errors)   | nothing           | `container`, `logger`                 |

**Dependency direction:** `infrastructure → application → domain`. Domain never imports from above.

---

### Commands vs Queries (CQRS-inspired split)

Every use case is either a **command** (write) or a **query** (read). They have different return contracts:

| Kind    | Does                        | Returns                          |
| ------- | --------------------------- | -------------------------------- |
| Command | Mutates state, enforces invariants | `void` (or pre-generated ID) |
| Query   | Reads data, no side effects | purpose-built DTO                |

**Commands return void.** If the caller needs the new resource's ID, generate it *before* calling the command:

```ts
const id = randomUUID();
await createTask.execute({ id, title, userId });
// id is already known — no need to return it
```

**Each query has its own DTO** defined in `application/queries/`. A query can bypass the domain entirely and read directly from the DB — no need to hydrate a full domain entity just to project it down.

```ts
// application/queries/ListMyTasks.ts
export interface ListMyTasksDTO {
  id: string;
  title: string;
  priority: number;
  done: boolean;
}

class ListMyTasks {
  constructor(private db: TaskReadModel) {}
  async execute(userId: string): Promise<ListMyTasksDTO[]> { ... }
}
```

---

### Repository is write-only (domain concern)

The `TaskRepository` interface lives in `domain/` and speaks domain language. It is used only by **commands** to load and persist aggregates. Queries do not go through it.

```ts
// domain/TaskRepository.ts
export interface TaskRepository {
  findById(id: string): Promise<Task | null>;
  save(task: Task): Promise<void>;
  remove(id: string): Promise<void>;
}
```

Infrastructure implements it with Prisma. It returns domain entities, never Prisma objects.

---

### Laravel comparison

| Laravel                       | This course (DDD)                             |
| ----------------------------- | --------------------------------------------- |
| Controller                    | `infrastructure/http/*Router.ts`              |
| Action (write)                | `application/commands/*.ts`                   |
| Action (read)                 | `application/queries/*.ts` → returns DTO      |
| Eloquent model + Repository   | `domain/*.ts` + `infrastructure/Prisma*Repository.ts` |
| Form Request                  | Zod schema in `infrastructure/http/`          |
| Service Provider              | `shared/container.ts`                         |
| Custom exception              | `domain/errors.ts`                            |

---

### Why bother?

1. **Testable in isolation.** A command test instantiates the handler with an in-memory repository — no DB, no HTTP. Runs in milliseconds.
2. **Swap implementations.** Move from Prisma to Drizzle by writing one new repository class. Domain is untouched.
3. **Optimised reads.** Queries can use raw SQL or a dedicated read model — independent of the write model.
4. **Bounded contexts.** Each `modules/<name>/` folder is self-contained.

---

## Step-by-step

### 1. Sketch the target structure on paper

```
src/
├── modules/
│   ├── users/
│   │   ├── domain/
│   │   │   ├── User.ts                     # entity
│   │   │   ├── UserRepository.ts           # interface (write only)
│   │   │   └── errors.ts                   # EmailTakenError, InvalidCredentialsError
│   │   ├── application/
│   │   │   ├── commands/
│   │   │   │   ├── RegisterUser.ts         # returns void
│   │   │   │   └── DeleteUser.ts           # returns void
│   │   │   └── queries/
│   │   │       ├── GetMyProfile.ts         # returns GetMyProfileDTO
│   │   │       └── dtos/
│   │   │           └── GetMyProfileDTO.ts
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

### 2. Command shape

```ts
// application/commands/CreateTask.ts
class CreateTask {
  constructor(private tasks: TaskRepository) {}

  async execute(input: { id: string; title: string; userId: string; priority: number }): Promise<void> {
    const task = Task.create(input); // domain entity enforces invariants
    await this.tasks.save(task);
  }
}
```

### 3. Query shape

```ts
// application/queries/ListMyTasks.ts
export interface ListMyTasksDTO {
  id: string;
  title: string;
  priority: number;
  done: boolean;
}

class ListMyTasks {
  constructor(private db: PrismaClient) {} // reads directly, no domain entity needed

  async execute(userId: string): Promise<ListMyTasksDTO[]> {
    return this.db.task.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      select: { id: true, title: true, priority: true, done: true },
    });
  }
}
```

### 4. Repository shape (write side only)

```ts
// domain/TaskRepository.ts
export interface TaskRepository {
  findById(id: string): Promise<Task | null>;
  save(task: Task): Promise<void>;
  remove(id: string): Promise<void>;
}
```

### 5. Decide what NOT to do

- **No anaemic domain** with getters/setters only. `Task.create(...)` validates and `Task.markDone()` enforces invariants.
- **No leaky abstractions.** Repository never returns Prisma objects.
- **No DTOs in domain.** Domain has entities and value objects only. DTOs live in `application/queries/dtos/`.
- **No god services.** Each use case does one thing.

---

## Test it

Write down on paper:

1. Three commands the API currently performs (e.g. `RegisterUser`, `CreateTask`, `DeleteTask`). For each: inputs, domain invariant enforced, repository call.
2. Three queries (e.g. `ListMyTasks`, `GetTaskById`, `GetMyProfile`). For each: inputs, DTO shape, whether you need the domain entity at all.
3. Which files in current `my-api` mix command and query concerns — those are refactor targets.

## Mini-task
Label every file in current `my-api` with one of: `domain`, `application/command`, `application/query`, `infrastructure`, `shared`. Note where a file does not fit cleanly — that is where the architecture leaks.

## Glossary
- **Entity** — a domain object with identity (`User`, `Task`).
- **Value object** — immutable, compared by value (`Email`, `Money`).
- **Command** — a write use case that returns void.
- **Query** — a read use case that returns a DTO.
- **DTO** — Data Transfer Object; lives in `application/queries/dtos/`, never in domain.
- **Repository** — write-side abstraction over persistence for one aggregate.
- **Read model** — a query-side data source; can be a raw DB query, view, or separate store.
- **Bounded context** — a self-contained module with its own language; here, each `modules/<x>/` folder.

## Resources
- [Eric Evans — DDD Reference (PDF)](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)
- [Khalil Stemmler — DDD in TypeScript](https://khalilstemmler.com/articles/domain-driven-design-intro/)

## Checklist
- [x] You can recite the four layers and what each may import.
- [x] You understand why commands return void and queries return DTOs.
- [x] You labelled every file in current `my-api` with a layer + kind (command/query).
- [x] You wrote inputs / DTO shape / deps for at least three commands and three queries.
