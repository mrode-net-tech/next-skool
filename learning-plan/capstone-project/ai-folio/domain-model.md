# ai-folio — Domain model

## Entities

### Conversation
A single chat session. Created when the first message is sent. Holds the aggregate lead intelligence.

| Field | Type | Notes |
|---|---|---|
| `id` | `cuid` | |
| `sessionId` | `string` | Browser session cookie — anonymous visitor identifier |
| `intent` | `Intent \| null` | Populated after lead scoring |
| `leadScore` | `1–5 \| null` | Populated after lead scoring |
| `status` | `ConversationStatus` | `new \| reviewed \| contacted \| closed` |
| `visitorEmail` | `string \| null` | Collected if visitor shares it in chat |
| `aiSummary` | `string \| null` | One-paragraph AI summary, generated on demand |
| `createdAt` | `DateTime` | |
| `updatedAt` | `DateTime` | |

### Message
A single turn in a conversation.

| Field | Type | Notes |
|---|---|---|
| `id` | `cuid` | |
| `conversationId` | `string` | FK → Conversation |
| `role` | `user \| assistant` | |
| `content` | `string` | Full text |
| `createdAt` | `DateTime` | |

### Lead
Business-facing view of a promising conversation. Created when `leadScore >= 3`.

| Field | Type | Notes |
|---|---|---|
| `id` | `cuid` | |
| `conversationId` | `string` | FK → Conversation (1:1) |
| `score` | `1–5` | Denormalised from Conversation for fast dashboard queries |
| `intent` | `Intent` | Denormalised |
| `notes` | `string \| null` | Admin free-text notes |
| `status` | `LeadStatus` | `new \| contacted \| closed` |
| `createdAt` | `DateTime` | |

### KanbanCard
Represents a Lead on the admin Kanban board.

| Field | Type | Notes |
|---|---|---|
| `id` | `cuid` | |
| `leadId` | `string` | FK → Lead (1:1) |
| `column` | `KanbanColumn` | `new \| reviewing \| contacted \| closed` |
| `order` | `float` | Fractional indexing for drag-and-drop reorder |
| `createdAt` | `DateTime` | |

### Embedding
Vectorised chunk of portfolio content used for RAG retrieval.

| Field | Type | Notes |
|---|---|---|
| `id` | `cuid` | |
| `content` | `string` | Original text chunk |
| `source` | `EmbeddingSource` | `cv \| project \| skills` |
| `metadata` | `Json` | e.g. `{ "projectId": "task-manager" }` |
| `vector` | `vector(1536)` | pgvector column — `text-embedding-3-small` output |
| `createdAt` | `DateTime` | |

### Auth.js tables (managed by Auth.js v5)

`User`, `Account`, `Session`, `VerificationToken` — standard Auth.js schema, auto-generated. `User` represents the portfolio owner (admin). No visitor registration.

---

## Value objects

### Intent
```
job_offer | collaboration | general_question | spam
```

### LeadStatus
```
new | contacted | closed
```

### ConversationStatus
```
new | reviewed | contacted | closed
```

### KanbanColumn
```
new | reviewing | contacted | closed
```

### EmbeddingSource
```
cv | project | skills
```

---

## Aggregate design

**Conversation** is the root aggregate. `Message[]` and `Lead` (optional) belong to it. The admin scores a Conversation, which creates/updates the Lead and KanbanCard.

**Embedding** is a standalone aggregate — no FK to Conversation. It represents static portfolio content, not user-generated content.

---

## Domain events (informal)

| Event | Trigger | Handler |
|---|---|---|
| `ConversationCreated` | First message sent | Create KanbanCard if score ≥ 3 after initial scoring |
| `LeadScored` | `generateObject` returns score | Create Lead + KanbanCard; send email if score ≥ 4 |
| `ProjectAdded` (Phase 6) | GitHub API webhook | Enqueue background embedding job |
