# Learning plan

Welcome to your 24-week journey from Laravel to fullstack TypeScript.

## How to use this plan

1. Work in **order**, day by day. Each day is roughly **1 hour** of focused work.
2. **Don't skip the tests.** From Day 6 onward, every day has a `Test it` section.
3. **All your code goes in [`exercises/`](../exercises/).** Each day tells you exactly where.
4. **Tick days off in [`PROGRESS.md`](../PROGRESS.md)** to keep momentum.
5. **Push to GitHub** at the end of every day.

## Plan at a glance

| Phase | Weeks | Theme | End-of-phase project state |
| ----- | ----- | ----- | -------------------------- |
| Phase 1 | 1–4 | Foundations: setup, TS, Express, Prisma | Working Task API with DB |
| Phase 2 | 5–8 | Backend Advanced: auth, DDD, testing | Production-quality Task API |
| Phase 3 | 9–12 | React: components, router, queries, UI | Polished React frontend |
| Phase 4 | 13–16 | Monorepo + deployment | Deployed fullstack Task Manager |
| Phase 5 | 17–20 | Next.js + Habit Tracker MVP | **Habit Tracker MVP** |
| Phase 6 | 21–24 | Production: Docker, CI, jobs, monitoring | **Habit Tracker in production** |

## Capstone project

The second half of the plan builds **Habit Tracker SaaS**, a real production-ready application. See the full spec in [`capstone-project/`](./capstone-project/README.md).

## Conventions

- **Code language:** TypeScript everywhere unless noted.
- **Package manager:** `npm` until Phase 4, then `pnpm`.
- **Editor:** PhpStorm or WebStorm recommended (you can use any).
- **Testing:** Vitest by default; Supertest for HTTP; React Testing Library for React; Playwright for e2e.
