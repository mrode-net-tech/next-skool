# ai-folio — API spec

Next.js Route Handlers (`app/api/`) + Server Actions. No separate Express server.

---

## Public endpoints (no auth)

### `POST /api/chat`
Stream a Claude response grounded in CV context via RAG.

**Request body**
```json
{
  "messages": [
    { "role": "user", "content": "What technologies do you work with?" }
  ],
  "sessionId": "sess_abc123"
}
```

**Response** — `Content-Type: text/event-stream` (Vercel AI data stream protocol)
```
data: {"type":"text-delta","textDelta":"I"}
data: {"type":"text-delta","textDelta":" work"}
...
data: {"type":"finish","finishReason":"stop","usage":{"promptTokens":312,"completionTokens":87}}
data: [DONE]
```

**Side effects**
- Creates or updates `Conversation` and `Message` rows.
- After stream completes: enqueues lead-scoring job (async — visitor does not wait).

---

## Admin endpoints (Auth.js session required)

All return `401` if no valid session cookie.

### `GET /api/admin/conversations`
Paginated conversation list for the dashboard.

**Query params**
| Param | Default | Notes |
|---|---|---|
| `status` | — | Filter by `ConversationStatus` |
| `minScore` | — | Filter by `leadScore >= N` |
| `cursor` | — | Cursor-based pagination (cuid of last item) |
| `limit` | `20` | Max 100 |

**Response**
```json
{
  "items": [
    {
      "id": "clx...",
      "sessionId": "sess_abc123",
      "intent": "job_offer",
      "leadScore": 5,
      "status": "new",
      "messageCount": 4,
      "createdAt": "2026-05-17T10:00:00Z"
    }
  ],
  "nextCursor": "clx..."
}
```

### `GET /api/admin/conversations/:id`
Single conversation with messages and lead data.

**Response**
```json
{
  "id": "clx...",
  "intent": "job_offer",
  "leadScore": 5,
  "status": "new",
  "visitorEmail": "hiring@company.com",
  "aiSummary": "Senior recruiter from Acme Corp, interested in a contract role...",
  "messages": [
    { "id": "msg_1", "role": "user", "content": "...", "createdAt": "..." },
    { "id": "msg_2", "role": "assistant", "content": "...", "createdAt": "..." }
  ],
  "lead": {
    "id": "lead_1",
    "score": 5,
    "intent": "job_offer",
    "status": "new",
    "notes": null
  }
}
```

### `GET /api/admin/kanban`
All KanbanCards grouped by column for the board view.

**Response**
```json
{
  "new": [{ "id": "card_1", "leadId": "lead_1", "order": 1.0, "lead": { ... } }],
  "reviewing": [],
  "contacted": [],
  "closed": []
}
```

### `PATCH /api/admin/kanban/:id`
Move a card to a new column and/or reorder within a column.

**Request body**
```json
{ "column": "reviewing", "order": 1.5 }
```

**Response** — `200` with updated card.

### `POST /api/admin/conversations/:id/summarise`
Generate an AI summary of the conversation and save it to `Conversation.aiSummary`.

**Response**
```json
{ "summary": "Recruiter from Acme Corp interested in a 6-month contract..." }
```

### `POST /api/admin/conversations/:id/draft-reply`
Generate a draft email reply based on the conversation context.

**Response**
```json
{ "draft": "Hi,\n\nThank you for reaching out..." }
```

---

## Server Actions (used by admin UI forms)

Server Actions are `async` functions marked `'use server'` called directly from Client Components — no fetch needed.

```ts
// Update lead notes
updateLeadNotes(leadId: string, notes: string): Promise<Lead>

// Update lead status
updateLeadStatus(leadId: string, status: LeadStatus): Promise<Lead>

// Re-seed embeddings (admin trigger)
reseedEmbeddings(): Promise<{ count: number }>

// Resend email notification for a lead
resendLeadNotification(leadId: string): Promise<void>
```

---

## Internal / background (Phase 6)

These are BullMQ jobs, not HTTP endpoints. Listed here for completeness.

| Queue | Job | Trigger |
|---|---|---|
| `scoring` | `scoreConversation` | After chat stream ends |
| `email` | `sendLeadEmail` | When `leadScore >= 4` |
| `embedding` | `indexProject` | GitHub webhook — new repo detected |
| `digest` | `weeklyDigest` | Cron: every Monday 08:00 |
