# Week 19 — Server Actions + Admin

**Goal:** Add the contact form (Server Action), protect `/admin` with Auth.js, build the conversations dashboard, the Kanban board, and wire Claude's `generateObject` for automatic lead scoring.

## Days

- [Day 91 — Server Actions (contact form)](./day-91-server-actions-contact.md)
- [Day 92 — Auth.js setup (admin login)](./day-92-authjs-setup.md)
- [Day 93 — Admin dashboard layout](./day-93-admin-dashboard.md)
- [Day 94 — Kanban board (conversations as cards)](./day-94-kanban-board.md)
- [Day 95 — Lead scoring with generateObject](./day-95-lead-scoring.md)

## Outcome

`ai-folio` now has:
- Contact form using `useActionState` + Server Action + Zod validation — no fetch layer
- Auth.js v5 credentials provider with bcrypt — single admin account, database sessions
- `middleware.ts` protecting all `/admin/*` routes
- Admin conversations list + detail page — Server Components with Prisma queries
- Kanban board with drag-and-drop (`@dnd-kit`) + Server Action persistence + optimistic updates
- `generateObject` scoring each conversation: intent (job/collab/question/spam) + score 1–5
- `Lead` + `KanbanCard` auto-created for score >= 3; terminal alert for score >= 4
