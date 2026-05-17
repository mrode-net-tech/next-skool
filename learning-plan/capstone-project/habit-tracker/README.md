# Capstone Project 1 — Habit Tracker SaaS

## What you will build

A real, deployable **Habit Tracker** web application:

- Users sign up and log in.
- They define **habits** (e.g. "Read 20 pages", "Go for a walk").
- Each day they mark habits as **done**.
- The app calculates **streaks**, shows a **weekly grid**, and offers a **dashboard**.
- A background job sends **daily reminder emails**.
- Errors are tracked in **Sentry**, the app is dockerized and deployed.

## Why this project

- **Real domain logic** — streaks and achievements are interesting, not trivial CRUD.
- **Touches every layer** — auth, jobs, scheduling, files, charts, monitoring.
- **Looks great in portfolio** — a polished UI plus production deployment.
- **You will use it yourself** — motivation matters when learning.

## Where it fits in the plan

| Phase | What you do |
|---|---|
| 1–4 | Build the **Task Manager** monorepo — learn the stack |
| 5 | Start Habit Tracker as a Next.js project, ship the MVP |
| 6 | Add production concerns: Docker, CI, jobs, monitoring |

## Tech stack

- **Framework:** Next.js 14 App Router
- **Auth:** Auth.js (email + password, sessions)
- **DB:** PostgreSQL via Prisma
- **UI:** Tailwind CSS + shadcn/ui
- **Forms:** react-hook-form + Zod
- **Background jobs:** BullMQ on Redis
- **Mail:** Resend
- **Errors:** Sentry
- **Tests:** Vitest, React Testing Library, Playwright
- **CI/CD:** GitHub Actions
- **Hosting:** Vercel (web) + Railway (db, redis, worker)

## Documents

- [`feature-roadmap.md`](./feature-roadmap.md) — ordered features: MVP → production → future
- [`domain-model.md`](./domain-model.md) — entities, value objects, aggregates, services
- [`database-schema.md`](./database-schema.md) — Prisma schema
- [`api-spec.md`](./api-spec.md) — server actions and REST shape
- [`ui-wireframes.md`](./ui-wireframes.md) — screens described in text
- [`deployment.md`](./deployment.md) — how it goes to production
