# Capstone projects

Two capstone projects are documented here. Build them in order — Habit Tracker first (simpler), ai-folio second (advanced).

---

## Project 1 — Habit Tracker SaaS

**Simpler. Build this first to solidify Next.js + Auth.js + Prisma + background jobs.**

→ All docs in this folder (`README.md`, `domain-model.md`, etc.) describe this project.

---

## Project 2 — ai-folio (AI-powered portfolio)

**Advanced. Build after Habit Tracker. Adds Claude API, pgvector RAG, lead scoring, admin Kanban.**

→ All docs in [`ai-folio/`](./ai-folio/)

---

## Original Habit Tracker SaaS

## What you will build

A real, deployable **Habit Tracker** web application:

- Users sign up and log in.
- They define **habits** (e.g. "Read 20 pages", "Go for a walk").
- Each day they mark habits as **done**.
- The app calculates **streaks**, shows a **weekly grid**, and offers a **dashboard**.
- A background job sends **daily reminder emails**.
- Errors are tracked in **Sentry**, the app is **dockerized** and **deployed**.

## Why this project

- **Real domain logic** — streaks and achievements are interesting, not trivial CRUD.
- **Touches every layer** — auth, jobs, scheduling, files, charts, monitoring.
- **Looks great in portfolio** — a polished UI plus production deployment.
- **You will use it yourself** — motivation matters when learning.

## Where it fits in the plan

| Phase | What you do for the capstone |
| ----- | ---------------------------- |
| 1–4   | You build a **separate** Task Manager app to learn the stack. |
| 5     | You **start Habit Tracker** as a Next.js project, ship the **MVP**. |
| 6     | You add **production concerns**: Docker, CI, jobs, monitoring. |

## Tech stack

- **Framework:** Next.js 15+ (App Router)
- **Auth:** Auth.js (email + password, sessions)
- **DB:** PostgreSQL via Prisma
- **UI:** Tailwind CSS + shadcn/ui
- **Forms:** react-hook-form + Zod
- **Validation:** Zod (shared between client and server)
- **Background jobs:** BullMQ on Redis
- **Mail:** Resend or Nodemailer (your choice)
- **Errors:** Sentry
- **Tests:** Vitest, React Testing Library, Playwright
- **CI/CD:** GitHub Actions
- **Hosting:** Vercel (web) + Railway (db, redis, worker)

## Documents in this folder

- [`feature-roadmap.md`](./feature-roadmap.md) — ordered list of features (MVP → production → future).
- [`domain-model.md`](./domain-model.md) — entities, value objects, aggregates, services.
- [`database-schema.md`](./database-schema.md) — Prisma schema sketch.
- [`api-spec.md`](./api-spec.md) — server actions and a reference REST shape.
- [`ui-wireframes.md`](./ui-wireframes.md) — screens described in text.
- [`deployment.md`](./deployment.md) — how it goes to production.
