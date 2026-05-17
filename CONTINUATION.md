# CONTINUATION.md — How to resume generating learning materials

This file is the **handoff document** for any future Copilot session (or any other AI assistant, or just future-you) that needs to continue building this learning plan.

If you're starting a fresh session and want to continue, paste this prompt:

> Hi. Read `CONTINUATION.md`, `PROGRESS.md`, and `learning-plan/phase-1-foundations/week-04-prisma/day-20-user-task-relation.md`. Then continue generating the next phase listed under "Status — what exists" in the same style. Work directly with the `create` tool, not via sub-agents.

---

## Status — what exists

**Done (do not regenerate):**

- `phase-1-foundations/` — Weeks 1–4 (Days 1–20) — Node + TS + Express + Prisma. Reference quality.
- `phase-2-backend-advanced/` — Weeks 5–8 (Days 21–40) — JWT auth, DDD, errors/logging/config, testing.
- `capstone-project/` — README, domain-model, database-schema, api-spec, ui-wireframes, feature-roadmap, deployment. **80% complete** — see "Capstone TODO" below.

**Empty (need lessons):**

- `phase-3-react/` — Weeks 9–12 (Days 41–60) — React + RTL + Router + TanStack Query + Tailwind/shadcn. The web project is `my-web`.
- `phase-4-fullstack-monorepo/` — Weeks 13–16 (Days 61–80) — pnpm workspaces + Turborepo + shared types + auth integration + Playwright E2E + deploy. The monorepo is `task-manager`.
- `phase-5-nextjs/` — Weeks 17–20 (Days 81–100) — Next.js basics + Server Components + Server Actions + Auth.js + **Habit Tracker MVP**. Project: `habit-tracker`.
- `phase-6-job-ready/` — Weeks 21–24 (Days 101–120) — Docker + GitHub Actions + BullMQ + monitoring + production deploy. Continues `habit-tracker`.

The folders for Phases 3–6 already exist with empty week subfolders. `PROGRESS.md` lines 50–185 list every day's title — **use those titles verbatim**.

## The template (must match exactly)

Every "Day NN" file follows this layout. Read `phase-1-foundations/week-04-prisma/day-20-user-task-relation.md` (small, complete) and `phase-2-backend-advanced/week-06-ddd/day-30-tasks-refactor.md` (large, complex DDD example) before writing new ones.

```markdown
# Day NN — Short title

## Goal
One paragraph. What the learner can do after this day.

## Estimated time
~XX minutes  |  ~X hours

## Prerequisites
(Optional) "Day NN" or skill name.

## Where to put your code
In `<project-name>` (`my-api` / `my-web` / `task-manager` / `habit-tracker`).

## Explanation
2–4 short paragraphs. Why this matters. Always include a **Laravel analogy** (the
learner is a senior Laravel/PHP dev). Use **bold** for the key term.

## Step-by-step
Numbered ### subheadings with code blocks. Code blocks MUST use the
`name=` attribute so the file path is visible:

    ```ts name=src/path/to/file.ts
    // real, runnable TypeScript
    ```

## Test it
Mandatory from Day 6 onwards. Either a Vitest snippet or a curl command + expected response. Always show the command(s) the learner runs.

## Mini-task
One sentence describing an extension. The learner does it themselves.

## Glossary
- **Term** — one-line definition.

## Resources
- [Title](url)

## Checklist
- [ ] Concrete, verifiable items
```

### Conventions

| Rule | Reason |
|---|---|
| Files are **in English** | The user is Polish but wants English materials. |
| Per file: **80–250 lines** | Long enough to teach, short enough to do in one sitting. |
| Code blocks use ` ```ts name=path/to/file.ts ` | Renders the path and enables tools to extract the file. |
| Every day from Day 6 onwards has a **Test it** section | Reinforce TDD habits. |
| Use real, runnable code — no `// TODO` placeholders | The learner copies and runs it. |
| Each day ends with a **Checklist** | Self-verification. |

### Tech-stack invariants per phase

- **Phase 3 (`my-web`)** — Vite + React 18 + TypeScript + React Router + React Hook Form + Zod + TanStack Query + Tailwind + shadcn/ui + Vitest + RTL + msw.
- **Phase 4 (`task-manager`)** — pnpm workspaces, Turborepo, packages: `apps/api` (port from `my-api`), `apps/web` (port from `my-web`), `packages/types` (shared Zod), `packages/config-eslint`, `packages/config-tsconfig`. Playwright for e2e. Deploy: Vercel (web) + Railway/Fly (api).
- **Phase 5 (`habit-tracker`)** — Next.js 14 App Router + Server Components + Server Actions + Auth.js (next-auth v5) + Prisma + Tailwind + shadcn/ui. The capstone project.
- **Phase 6** — extends `habit-tracker` with Docker, GitHub Actions CI/CD, BullMQ + Redis (background jobs / scheduled habit reminders), Sentry, fly.io / Railway production.

### DDD pattern (for any phase that touches the API)

Folder template inside `apps/api/src/modules/<name>/`:

```
domain/         — entities, value objects, repository interfaces, errors
application/    — use cases (one class per command), DTOs
infrastructure/
  http/         — Express routers + Zod schemas
  prisma/       — repository implementations
```

Use cases are `@injectable()` classes, ports are wired through `tsyringe` with string tokens in `src/shared/tokens.ts`. See Day 28 for the canonical example.

## Capstone change — AI Portfolio (`ai-folio`)

**The capstone project has changed from Habit Tracker to an AI-powered portfolio site.**
Project name: `ai-folio`. Phases 5–6 now build this instead.

### What `ai-folio` is

A portfolio website + AI chat system where:
- Visitors ask questions about the portfolio owner via a chat widget
- Claude answers using RAG (CV + project descriptions indexed in pgvector)
- Responses stream in real-time via Vercel AI SDK
- Each conversation is analyzed: intent classified (job offer / collab / question / spam), lead-scored 1-5
- New conversations auto-create Kanban cards in an internal admin dashboard
- Owner gets email notifications (Resend) for high-scoring leads
- Admin can view all conversations, see AI summaries, draft replies

### Tech additions vs Habit Tracker

- `@anthropic-ai/sdk` — Claude API calls
- `ai` (Vercel AI SDK) — `streamText`, `useChat`, `generateObject`
- `pgvector` (Postgres extension) — RAG embedding store
- Resend — transactional email
- SSE (server-sent events) — real-time admin notifications
- Optional: Pusher/Ably for WebSocket if SSE is insufficient

### Phase 5 revised day titles (Days 81–100)

Week 17: 81 create-next-app (ai-folio), 82 App Router + portfolio layout, 83 Portfolio sections (about/projects/skills), 84 Loading+error UI, 85 Metadata + SEO.
Week 18: 86 Server Components vs Client, 87 Claude API intro + streamText, 88 Chat widget (useChat + streaming), 89 RAG setup (pgvector + embeddings), 90 Chat answers from CV context.
Week 19: 91 Server Actions (contact form), 92 Auth.js setup (admin login), 93 Admin dashboard layout, 94 Kanban board (conversations as cards), 95 Lead scoring with generateObject.
Week 20: 96 Email notifications (Resend), 97 GitHub API integration (auto-pull projects), 98 Analytics tab, 99 AI draft-reply feature, 100 MVP polish + production deploy.

### Phase 6 revised day titles (Days 101–120)

Week 21: 101 Dockerfile (Next.js), 102 docker-compose with Postgres+pgvector, 103 Multi-stage builds, 104 Image size optimization, 105 Local full stack with Docker.
Week 22: 106 GH Actions hello, 107 Lint+typecheck job, 108 Test job, 109 Build+deploy job, 110 Caching+secrets.
Week 23: 111 BullMQ basics, 112 Redis setup, 113 Background embedding job (new project → index), 114 Scheduled digest email (weekly lead summary), 115 Worker deployment.
Week 24: 116 Sentry integration, 117 Production env setup, 118 Production deploy (Fly.io or Railway), 119 Post-deploy monitoring, 120 Final retrospective.

### Capstone TODO (was habit-tracker, now ai-folio)

- Rewrite `capstone-project/README.md` for `ai-folio`
- Rewrite `capstone-project/domain-model.md` — entities: Conversation, Message, Lead, KanbanCard
- Rewrite `capstone-project/database-schema.md` — add Auth.js tables + `conversations`, `messages`, `leads`, pgvector `embeddings`
- Rewrite `capstone-project/api-spec.md` — chat endpoint (streaming), admin CRUD, lead scoring
- Rewrite `capstone-project/ui-wireframes.md` — portfolio page, chat widget, admin dashboard, Kanban
- New file `capstone-project/ARCHITECTURE.md` — RAG pipeline diagram, streaming flow
- New file `capstone-project/TESTING-STRATEGY.md`

## Per-phase day titles

`PROGRESS.md` is authoritative. Quick reference:

### Phase 3 — React (Days 41–60)
Week 9 (basics): 41 Vite+TS, 42 Components+Props, 43 useState+Events, 44 useEffect+fetch, 45 RTL first test.
Week 10 (router/forms): 46 React Router, 47 Nested routes+layouts, 48 React Hook Form, 49 Zod resolvers, 50 Loading/error states.
Week 11 (TanStack Query): 51 Query basics, 52 Mutations+invalidation, 53 Optimistic updates, 54 Pagination, 55 msw for mocking.
Week 12 (Tailwind): 56 Tailwind setup, 57 Utility-first thinking, 58 shadcn/ui setup, 59 Build a polished page, 60 Theme + dark mode.

### Phase 4 — Fullstack Monorepo (Days 61–80)
Week 13: 61 pnpm workspaces, 62 Turborepo, 63 Move my-api into apps/api, 64 Move my-web into apps/web, 65 Shared scripts.
Week 14: 66 packages/types, 67 Shared Zod schemas, 68 Type-safe API client (fetch+Zod), 69 Generated SDK, 70 ESLint+TS config packages.
Week 15: 71 Login flow end-to-end, 72 Token storage (httpOnly cookie or localStorage tradeoffs), 73 Protected routes (web), 74 401 handling+refresh, 75 Logout.
Week 16: 76 Playwright setup, 77 First e2e test, 78 Deploy api (Railway/Fly), 79 Deploy web (Vercel), 80 CI runs e2e.

### Phase 5 — Next.js / ai-folio (Days 81–100)
Week 17: 81 create-next-app (ai-folio), 82 App Router + portfolio layout, 83 Portfolio sections, 84 Loading+error UI, 85 Metadata+SEO.
Week 18: 86 Server Components vs Client, 87 Claude API intro + streamText, 88 Chat widget (useChat+streaming), 89 RAG setup (pgvector+embeddings), 90 Chat answers from CV context.
Week 19: 91 Server Actions (contact form), 92 Auth.js setup (admin), 93 Admin dashboard layout, 94 Kanban board (conversations as cards), 95 Lead scoring with generateObject.
Week 20: 96 Email notifications (Resend), 97 GitHub API integration, 98 Analytics tab, 99 AI draft-reply feature, 100 MVP polish.

### Phase 6 — Job-ready / ai-folio (Days 101–120)
Week 21: 101 Dockerfile (Next.js), 102 docker-compose with Postgres+pgvector, 103 Multi-stage builds, 104 Image size optimization, 105 Local full stack with Docker.
Week 22: 106 GH Actions hello, 107 Lint+typecheck job, 108 Test job, 109 Build+deploy job, 110 Caching+secrets.
Week 23: 111 BullMQ basics, 112 Redis setup, 113 Background embedding job, 114 Scheduled digest email, 115 Worker deployment.
Week 24: 116 Sentry integration, 117 Production env setup, 118 Production deploy (Fly.io/Railway), 119 Post-deploy monitoring, 120 Final retrospective.

## Workflow tips

- **Direct file creation > sub-agents.** Sub-agents get interrupted and produce inconsistent output. Just call `create` for one day at a time, in batches of 4–6 per turn.
- **Don't rewrite Phase 1 or Phase 2.** Treat them as locked references.
- **Don't write code for the learner.** Lessons explain how, the learner types it. The `exercises/` folder at the repo root is for the learner's working copies.
- **Cross-reference earlier days** ("you built this on Day 28") to reinforce continuity.
- **Tone:** matter-of-fact, dense, like senior-to-senior. No fluff like "Awesome! You did it!"

## What persists across sessions

- All `.md` files (committed to Git).
- Project structure under `learning-plan/`, `exercises/`, `capstone-project/`.
- `PROGRESS.md` (master plan).

## What does NOT persist

- The session SQL `todos` table.
- The `~/.copilot/session-state/<id>/plan.md` file.
- The conversation history.

So a new session starts blind. **This file is the bridge.**
