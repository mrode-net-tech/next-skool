---
name: project-capstone-ai-folio
description: Capstone project changed from Habit Tracker to AI-powered portfolio site (ai-folio) with Claude chatbot, Kanban lead board, email notifications, RAG
metadata:
  type: project
---

Two capstone projects exist. Habit Tracker is project 1 (simpler, builds Next.js fundamentals). ai-folio is project 2 (advanced, adds AI features).

**Why:** User wants to keep Habit Tracker as a simpler intro project, then build ai-folio as the main portfolio showcasing AI skills.

**How to apply:** Phases 5–6 days build `ai-folio`. The Habit Tracker docs in `capstone-project/` (root level) remain valid. ai-folio docs live in `capstone-project/ai-folio/`. Do NOT remove or overwrite the Habit Tracker docs.

## Core features
- Portfolio page (About, Projects, Skills, Contact)
- AI chat widget — visitor asks questions, Claude answers using RAG (CV + project descriptions indexed in pgvector)
- Responses stream via Vercel AI SDK `useChat`
- Each conversation: intent classified (job/collab/question/spam), lead scored 1-5 with `generateObject`
- Admin dashboard — Kanban board, conversations auto-become cards
- Email notifications (Resend) for high-scoring leads
- GitHub API integration — auto-pull latest repos
- Analytics tab — topics heatmap
- AI draft-reply feature

## Tech additions vs Habit Tracker
- `@anthropic-ai/sdk` — Claude API
- `ai` (Vercel AI SDK) — `streamText`, `useChat`, `generateObject`
- pgvector (Postgres extension) — RAG embedding store
- Resend — transactional email
- SSE — real-time admin notifications
- BullMQ (Phase 6) — background embedding jobs + weekly digest email

## Project name
`ai-folio` (Next.js 14 App Router project, capstone for Phase 5-6)

## CONTINUATION.md updated
Yes — Capstone TODO section and Phase 5-6 day titles updated 2026-05-17.
