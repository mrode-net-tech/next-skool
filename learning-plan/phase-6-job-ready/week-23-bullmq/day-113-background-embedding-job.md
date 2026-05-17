# Day 113 — Background embedding job (new project → index)

## Goal
Implement the real embedding worker: when a new conversation message arrives, generate a vector embedding with the Claude API and store it in pgvector. After this day, AI chat answers from Day 90 use freshly indexed content without blocking the HTTP response.

## Estimated time
~2.5 hours

## Prerequisites
Day 112 (Redis hardened). Day 89 (pgvector + embeddings setup). Day 111 (BullMQ basics, placeholder worker).

## Where to put your code
In `ai-folio`.

## Explanation

**The embedding pipeline** from Day 89 worked synchronously: generate embedding → store → query. For a portfolio site this is fine when indexing static CV content at startup. For conversation messages (which arrive unpredictably), synchronous embedding blocks the chat response. Moving it to a background job gives the user an immediate streaming response; the message gets indexed within seconds, and subsequent questions can use it as RAG context.

**Job payload design:** pass only what is needed to process the job — IDs and small strings, not large objects. The worker re-fetches from the database if it needs full records. If you pass a large object in the job payload, it is serialised to Redis JSON on every enqueue and deserialised on every dequeue. For 1,000 conversations per day, that is unnecessary Redis traffic.

**Idempotency:** if the worker crashes mid-job and BullMQ retries it (Day 111's `attempts: 3`), the job must be safe to run twice. Using `upsert` instead of `create` in Prisma, keyed on `conversationId + messageIndex`, achieves this.

## Step-by-step

### 1. Add an Embedding model to the Prisma schema

```prisma name=prisma/schema.prisma
// Add alongside the existing Conversation/Message models

model Embedding {
  id             String   @id @default(cuid())
  conversationId String
  messageIndex   Int
  content        String   @db.Text
  embedding      Unsupported("vector(1536)")
  createdAt      DateTime @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@unique([conversationId, messageIndex])  // idempotency key
}
```

Run the migration:

```bash
pnpm prisma migrate dev --name add-embedding-model
```

### 2. Create an embedding service

```ts name=src/lib/embeddings.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1,
    messages: [{ role: 'user', content: text }],
  });

  // Anthropic does not yet expose an embeddings API directly;
  // use the voyage-3 model via the embeddings endpoint pattern
  // For now use OpenAI-compatible embeddings or a placeholder
  // Real implementation: use @anthropic-ai/sdk when embeddings are GA
  throw new Error('Replace with actual embedding API when available');
}

// Workaround: use the Vercel AI SDK embed helper with a compatible model
import { embed } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export async function generateEmbeddingVAI(text: string): Promise<number[]> {
  // As of 2025, use voyage-3 via the Vercel AI SDK anthropic provider
  const { embedding } = await embed({
    model: anthropic.textEmbeddingModel('voyage-3'),
    value: text,
  });
  return embedding;
}
```

If you used a different embedding model in Day 89, keep it consistent. The embedding dimension in the Prisma schema (`vector(1536)`) must match the model's output dimension.

### 3. Define the job payload type

```ts name=src/lib/queues/types.ts
export interface EmbeddingJobData {
  conversationId: string;
  messageIndex: number;
  content: string;
}
```

Update the queue definition to be typed:

```ts name=src/lib/queues/index.ts
import { Queue } from 'bullmq';
import { createRedisConnection } from '@/lib/redis';
import type { EmbeddingJobData } from './types';

export const embeddingQueue = new Queue<EmbeddingJobData>('embeddings', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});
```

### 4. Implement the real worker

```ts name=src/workers/embedding-worker.ts
import { Worker } from 'bullmq';
import { createRedisConnection } from '@/lib/redis';
import { generateEmbeddingVAI } from '@/lib/embeddings';
import { prisma } from '@/lib/prisma';
import type { EmbeddingJobData } from '@/lib/queues/types';

const worker = new Worker<EmbeddingJobData>(
  'embeddings',
  async (job) => {
    const { conversationId, messageIndex, content } = job.data;

    console.log(`[embedding-worker] Embedding message ${messageIndex} of ${conversationId}`);

    const vector = await generateEmbeddingVAI(content);

    // Upsert — safe to retry if the job runs twice
    await prisma.$executeRaw`
      INSERT INTO "Embedding" ("id", "conversationId", "messageIndex", "content", "embedding", "createdAt")
      VALUES (
        gen_random_uuid()::text,
        ${conversationId},
        ${messageIndex},
        ${content},
        ${JSON.stringify(vector)}::vector,
        NOW()
      )
      ON CONFLICT ("conversationId", "messageIndex")
      DO UPDATE SET "embedding" = EXCLUDED."embedding", "content" = EXCLUDED."content"
    `;

    console.log(`[embedding-worker] Stored embedding for ${conversationId}/${messageIndex}`);
  },
  {
    connection: createRedisConnection(),
    concurrency: 3,
  }
);

worker.on('completed', (job) => {
  console.log(`[embedding-worker] Job ${job.id} done`);
});

worker.on('failed', (job, err) => {
  console.error(`[embedding-worker] Job ${job?.id} failed: ${err.message}`);
});

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});

console.log('[embedding-worker] Started, concurrency=3');
```

`SIGTERM` handling ensures the worker finishes in-flight jobs gracefully before the process exits — important in Docker and Kubernetes environments.

### 5. Enqueue from the conversation save path

When a user sends a message that is persisted to the database, enqueue its embedding:

```ts name=src/app/api/chat/route.ts
import { embeddingQueue } from '@/lib/queues';

// After saving the message to the database:
await embeddingQueue.add('generate-embedding', {
  conversationId: savedConversation.id,
  messageIndex: messageIndex,
  content: userMessage,
});
```

## Test it

Start all services:

```bash
docker-compose up postgres redis -d
REDIS_URL=redis://localhost:6380 pnpm worker &
pnpm dev
```

Send a chat message:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Tell me about your React experience"}],"conversationId":"test-embed-1"}'
```

Expected in the worker terminal within 2–3 seconds:

```
[embedding-worker] Embedding message 0 of test-embed-1
[embedding-worker] Stored embedding for test-embed-1/0
[embedding-worker] Job 1 done
```

Verify in the database:

```bash
docker-compose exec postgres psql -U folio -d folio_dev \
  -c 'SELECT "conversationId", "messageIndex", length("content") FROM "Embedding";'
```

## Mini-task
Add a second job type: `index-project`. When a new GitHub project is added (Day 97), enqueue a job that generates embeddings for the project title + description. Add a `ProjectEmbedding` model to the schema with an `@@unique([projectId])` constraint. Update the worker to handle both job types using a `switch` on `job.name`.

## Glossary
- **Embedding** — dense vector of floats representing the semantic meaning of a text; similar texts have vectors close in cosine distance.
- **Idempotency** — property of an operation that produces the same result whether run once or multiple times; `ON CONFLICT DO UPDATE` achieves this for SQL writes.
- **`SIGTERM`** — Unix signal sent by Docker/Kubernetes to request graceful shutdown; worker should stop accepting new jobs and finish current ones.
- **`concurrency`** — how many jobs the worker processes simultaneously; limited by your database connection pool and API rate limits.
- **`upsert`** — insert or update a row based on a unique constraint; the safe pattern for idempotent writes.

## Resources
- [BullMQ — workers](https://docs.bullmq.io/guide/workers)
- [pgvector — JavaScript examples](https://github.com/pgvector/pgvector-node)
- [Vercel AI SDK — embeddings](https://sdk.vercel.ai/docs/ai-sdk-core/embeddings)

## Checklist
- [ ] `Embedding` model added to Prisma schema with `@@unique([conversationId, messageIndex])`
- [ ] `generateEmbeddingVAI()` generates a vector from text
- [ ] `EmbeddingJobData` type defined and used in Queue and Worker
- [ ] Worker uses raw SQL `ON CONFLICT DO UPDATE` for idempotent upsert
- [ ] `SIGTERM` handler closes worker gracefully
- [ ] Chat endpoint enqueues an embedding job after saving the message
- [ ] Worker logs confirm job processed; `Embedding` row visible in DB
