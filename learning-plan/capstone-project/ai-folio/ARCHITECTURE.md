# ai-folio — Architecture

## System overview

```
Browser                    Next.js (Vercel)            External services
─────────                  ────────────────            ─────────────────
Chat widget (useChat)  →   POST /api/chat          →   Claude API (stream)
                       ←   SSE token stream         ←
                           │
                           ├── searchSimilar()      →   Postgres + pgvector
                           │   (RAG retrieval)      ←   top-5 chunks
                           │
                           └── [after stream ends]
                               scoreConversation()  →   Claude API (generateObject)
                               │
                               ├── save to DB (Conversation, Lead, KanbanCard)
                               └── sendEmail()      →   Resend (if score >= 4)

Admin dashboard        →   GET  /api/admin/*        →   Postgres
                       →   PATCH /api/admin/kanban  →   Postgres
                       →   POST /api/admin/*/summarise → Claude API
                       →   POST /api/admin/*/draft-reply → Claude API

Admin login            →   Auth.js (credentials)   →   Postgres (sessions)
```

---

## RAG pipeline (per chat message)

```
1. User sends message
        │
        ▼
2. embed(message.content)          ← OpenAI text-embedding-3-small
        │
        ▼
3. pgvector similarity search      ← SELECT ... ORDER BY vector <-> $query LIMIT 5
        │
        ▼
4. Build system prompt:
   "You are an AI assistant...
   CONTEXT:
   [chunk 1]
   [chunk 2]
   [chunk 3]
   [chunk 4]
   [chunk 5]"
        │
        ▼
5. streamText({ model: claude, system, messages })
        │
        ▼
6. toDataStreamResponse()          → SSE stream to browser
        │
        ▼ (after stream ends — async)
7. scoreConversation()             ← Next.js background task or BullMQ (Phase 6)
```

---

## Lead scoring pipeline

Runs after each conversation turn (async — does not block the chat response).

```
1. Load all messages for the conversation
        │
        ▼
2. generateObject({
     model: claude-haiku,           ← cheaper model, structured output
     schema: z.object({
       intent: z.enum([...]),
       score: z.number().int().min(1).max(5),
       reasoning: z.string(),
     }),
     prompt: `Score this conversation...
              Messages: [...]`
   })
        │
        ▼
3. Save intent + score to Conversation
        │
        ▼ (if score >= 3)
4. Create Lead + KanbanCard
        │
        ▼ (if score >= 4)
5. Resend.emails.send({ to: owner, ... })
```

---

## Streaming flow (browser detail)

```
Browser                         Server
───────                         ──────
useChat.handleSubmit()
  POST /api/chat { messages }  →
                                streamText() opens stream to Claude
                               ← data: {"type":"text-delta","textDelta":"Hi"}
useChat appends delta to
last assistant message
  (user sees token appear)
                               ← data: {"type":"text-delta","textDelta":"!"}
                               ← data: {"type":"finish",...}
                               ← data: [DONE]
useChat sets isLoading=false
```

Transport: HTTP chunked transfer encoding. No WebSocket needed. Works on Vercel Edge Runtime.

---

## Auth flow (admin only)

```
Admin visits /admin/*
        │
        ▼
Auth.js middleware (middleware.ts)
checks session cookie
        │
   no session ──→ redirect /admin/login
        │
   session valid
        │
        ▼
Page renders (Server Component reads session via auth())
```

Auth.js v5 uses a database session strategy. Session token stored in `httpOnly` cookie. `Session` row in Postgres expires after 30 days.

---

## Phase 6 additions (BullMQ)

```
apps/worker/          ← separate Node.js process, runs alongside Next.js
  queues/
    scoring.ts        ← processes scoreConversation jobs
    email.ts          ← processes sendLeadEmail jobs
    embedding.ts      ← processes indexProject jobs (GitHub webhook → re-index)
    digest.ts         ← cron: weekly summary email
```

Redis (Upstash or Railway Redis) acts as the BullMQ broker. Worker deployed as a separate Railway service.

---

## Deployment topology

```
                ┌─────────────┐
     browser ─→ │   Vercel    │  (Next.js — web + API routes)
                └──────┬──────┘
                       │
              ┌────────┴────────┐
              │                 │
     ┌────────▼──────┐  ┌───────▼───────┐
     │  Railway DB   │  │  Railway Redis │
     │  Postgres     │  │  (BullMQ)      │
     │  + pgvector   │  └───────┬────────┘
     └───────────────┘          │
                        ┌───────▼───────┐
                        │ Railway Worker │
                        │ (BullMQ jobs)  │
                        └───────────────┘
```
