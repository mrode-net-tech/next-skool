# Phase 5 — Next.js / ai-folio (Weeks 17–20)

**Goal:** Build `ai-folio` — an AI-powered portfolio site — using Next.js 14 App Router. Ship the MVP: portfolio pages, Claude-powered chat widget with RAG, lead scoring, and an admin Kanban dashboard.

## Outcome at the end of phase 5

`ai-folio` MVP deployed to Vercel:
- Portfolio pages (Home, About, Projects, Skills, Contact) — Server Components, Tailwind, shadcn/ui
- Floating chat widget — `useChat` streaming, Claude Sonnet via Vercel AI SDK
- RAG pipeline — pgvector similarity search, CV chunks indexed as embeddings
- Lead scoring — `generateObject` classifies intent and scores 1–5 after each conversation
- Admin dashboard — Auth.js credentials login, conversations list, conversation detail
- Kanban board — drag-and-drop with `@dnd-kit`, persisted via Server Actions
- Contact form — Server Action with Zod validation, progressive enhancement

## Weeks

| Week | Topic | Folder |
| ---- | ----- | ------ |
| 17 | Next.js basics | [`week-17-nextjs-basics`](./week-17-nextjs-basics/) |
| 18 | Server Components + Claude API | [`week-18-server-components`](./week-18-server-components/) |
| 19 | Server Actions + Admin | [`week-19-server-actions`](./week-19-server-actions/) |
| 20 | MVP polish + deploy | [`week-20-mvp-polish`](./week-20-mvp-polish/) |

## Mindset for a Laravel dev entering this phase

**The server is in your component.** In Laravel you have controllers that fetch data and pass it to Blade. In Next.js App Router, Server Components *are* the controller and the template in one. `async function MyPage() { const data = await db.query(); return <div>{data}</div>; }` — that's it.

**`'use client'` is an escape hatch, not the default.** Every component is a Server Component unless you opt out. Add `'use client'` only when you need hooks, browser APIs, or event handlers. Keep the interactive boundary as low in the tree as possible.

**Server Actions replace 80% of your Route Handlers.** Forms that submit, buttons that mutate data, admin actions — all of these can be Server Actions. You only write a Route Handler when you need streaming (`/api/chat`), external webhooks, or `GET` endpoints consumed by third parties.
