---
name: project-capstone-ai-folio
description: Capstone project changed from Habit Tracker to AI-powered portfolio site (ai-folio) with Claude chatbot, Kanban lead board, email notifications, RAG
metadata:
  type: project
---

Capstone project is now `ai-folio` — an AI-powered portfolio page (not Habit Tracker).

**Why:** User wants to showcase AI skills in their portfolio. More impressive for job hunting.

**How to apply:** Phases 5–6 build `ai-folio`. Any reference to "Habit Tracker" in future lessons should be replaced with `ai-folio` features.

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
