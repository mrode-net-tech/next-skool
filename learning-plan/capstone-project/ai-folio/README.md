# Capstone project 2 — ai-folio (AI-powered portfolio)

## What you will build

A production-ready portfolio website with an embedded AI assistant:

- Visitors browse your **About, Projects, Skills, and Contact** pages.
- A floating **chat widget** lets visitors ask questions about you; Claude answers using RAG (your CV and project descriptions indexed in pgvector).
- Responses **stream in real time** via Vercel AI SDK.
- Each conversation is **analysed**: intent classified (job offer / collaboration / question / spam) and lead-scored 1–5 using `generateObject`.
- New high-value conversations **auto-create Kanban cards** in an internal admin dashboard.
- The owner receives **email notifications** (Resend) for leads scored 4–5.
- Admin can view all conversations, read AI summaries, and **draft replies** with AI assistance.

## Why this project

- **Immediately useful** — you deploy it and use it as your real portfolio.
- **AI-forward** — demonstrates Claude API, RAG, streaming, and `generateObject` to potential employers.
- **Full-stack depth** — Next.js App Router, Auth.js, Prisma, pgvector, BullMQ, Sentry, Fly.io.
- **Differentiator** — most portfolios are static sites; yours has an AI agent that qualifies leads.

## Where it fits in the plan

| Phase | What you build |
|---|---|
| 1–4 | Task Manager (separate learning project — Node, React, monorepo) |
| 5 | `ai-folio` MVP — portfolio pages, chat widget, RAG pipeline, admin dashboard |
| 6 | Production — Docker, CI/CD, BullMQ background jobs, Sentry, Fly.io deploy |

Build **Habit Tracker** first (capstone project 1) if you want more Next.js practice before tackling the AI features here.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 App Router |
| Auth | Auth.js v5 (email + password, sessions) |
| DB | PostgreSQL via Prisma |
| Vector search | pgvector extension |
| AI chat | Vercel AI SDK (`streamText`, `useChat`) |
| AI generation | `@ai-sdk/anthropic` — Claude Sonnet |
| Embeddings | `@ai-sdk/openai` — `text-embedding-3-small` |
| Email | Resend |
| Background jobs | BullMQ + Redis (Phase 6) |
| UI | Tailwind CSS + shadcn/ui |
| Error tracking | Sentry (Phase 6) |
| Tests | Vitest + Playwright |
| CI/CD | GitHub Actions |
| Hosting | Vercel (web) + Fly.io or Railway (Postgres + Redis) |

## Documents in this folder

- [`domain-model.md`](./domain-model.md) — entities, value objects, aggregates.
- [`database-schema.md`](./database-schema.md) — Prisma schema with Auth.js tables + pgvector.
- [`api-spec.md`](./api-spec.md) — Route Handlers and Server Actions spec.
- [`ui-wireframes.md`](./ui-wireframes.md) — all screens described in text.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — RAG pipeline, streaming flow, lead scoring diagram.
