# Week 18 — Server Components + Claude API

**Goal:** Add the AI-powered chat widget. Understand the Server vs Client Component boundary deeply, wire Claude via the Vercel AI SDK, stream responses in real time, and ground answers in your CV using pgvector RAG.

## Days

- [Day 86 — Server Components vs Client Components](./day-86-server-vs-client.md)
- [Day 87 — Claude API intro + streamText](./day-87-claude-api-streamtext.md)
- [Day 88 — Chat widget (useChat + streaming)](./day-88-chat-widget.md)
- [Day 89 — RAG setup (pgvector + embeddings)](./day-89-rag-setup.md)
- [Day 90 — Chat answers from CV context](./day-90-chat-rag-context.md)

## Outcome

`ai-folio` now has:
- `server-only` guard on all files that touch secrets or DB
- `POST /api/chat` Route Handler streaming Claude responses via Vercel AI SDK
- Floating chat widget (shadcn Sheet) that streams token by token using `useChat`
- pgvector running in Docker; `Embedding` table in Postgres; CV chunks seeded
- RAG pipeline: every user message retrieves top-5 CV chunks, injected into Claude's system prompt
- Chat correctly answers questions about your skills, projects, and availability
