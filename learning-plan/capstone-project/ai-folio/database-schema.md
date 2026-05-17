# ai-folio — Database schema

Full Prisma schema. Auth.js tables follow the official v5 adapter spec; do not modify their field names.

```prisma name=prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

// ─────────────────────────────────────────────
// Auth.js v5 — do not rename fields
// ─────────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?   // bcrypt hash — only set for credentials provider
  accounts      Account[]
  sessions      Session[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Account {
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([provider, providerAccountId])
}

model Session {
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@id([identifier, token])
}

// ─────────────────────────────────────────────
// ai-folio domain tables
// ─────────────────────────────────────────────

model Conversation {
  id           String             @id @default(cuid())
  sessionId    String
  intent       Intent?
  leadScore    Int?               // 1–5
  status       ConversationStatus @default(new)
  visitorEmail String?
  aiSummary    String?
  messages     Message[]
  lead         Lead?
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt

  @@index([status])
  @@index([leadScore])
  @@index([createdAt])
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  role           MessageRole
  content        String
  createdAt      DateTime     @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
}

model Lead {
  id             String       @id @default(cuid())
  conversationId String       @unique
  score          Int          // 1–5
  intent         Intent
  notes          String?
  status         LeadStatus   @default(new)
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  kanbanCard     KanbanCard?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([status])
}

model KanbanCard {
  id        String       @id @default(cuid())
  leadId    String       @unique
  column    KanbanColumn @default(new)
  order     Float        // fractional index for drag-and-drop
  lead      Lead         @relation(fields: [leadId], references: [id], onDelete: Cascade)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@index([column, order])
}

model Embedding {
  id        String          @id @default(cuid())
  content   String
  source    EmbeddingSource
  metadata  Json            @default("{}")
  vector    Unsupported("vector(1536)")
  createdAt DateTime        @default(now())
}

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

enum Intent {
  job_offer
  collaboration
  general_question
  spam
}

enum ConversationStatus {
  new
  reviewed
  contacted
  closed
}

enum LeadStatus {
  new
  contacted
  closed
}

enum MessageRole {
  user
  assistant
}

enum KanbanColumn {
  new
  reviewing
  contacted
  closed
}

enum EmbeddingSource {
  cv
  project
  skills
}
```

## Notes

- `leadScore` is stored on both `Conversation` (source of truth) and `Lead` (denormalised for dashboard queries). Keep them in sync in the service layer.
- `KanbanCard.order` uses fractional indexing — when moving a card between positions A and B, set `order = (A.order + B.order) / 2`. Avoids renumbering the entire column.
- `Embedding.vector` is `Unsupported("vector(1536)")` because Prisma does not natively understand the pgvector type. Use `prisma.$executeRaw` / `prisma.$queryRaw` for all vector operations.
- Run `pgvector` migration with `CREATE EXTENSION IF NOT EXISTS vector;` — the `extensions = [pgvector]` in the schema handles this automatically via `prisma migrate dev`.
