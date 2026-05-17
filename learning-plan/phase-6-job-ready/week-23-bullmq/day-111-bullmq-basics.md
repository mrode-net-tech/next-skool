# Day 111 — BullMQ basics

## Goal
Add BullMQ to `ai-folio` and enqueue your first job. After this day you understand what a message queue is, why background jobs matter for AI applications, and how BullMQ's queue/worker model maps to concepts you already know.

## Estimated time
~2 hours

## Prerequisites
Day 110 (CI pipeline complete). Day 102 (Redis running in docker-compose). Day 89 (embedding pipeline context).

## Where to put your code
In `ai-folio`.

## Explanation

**Background jobs** offload slow or unreliable work from the HTTP request cycle. When a visitor submits a contact form, the HTTP handler should return a 200 in milliseconds — not wait 3 seconds for an embedding to be computed and stored. The handler enqueues a job and returns; a separate worker process picks up the job and does the heavy work. In Laravel terms, BullMQ is Laravel Queue backed by Redis: `Queue::push(new GenerateEmbeddingJob($message))`.

**BullMQ** is a TypeScript/Node.js queue library built on Redis. It uses Redis sorted sets to store pending jobs and Redis streams for worker coordination. The two core classes are:
- **`Queue`** — your producer; call `queue.add(name, data)` to enqueue a job
- **`Worker`** — your consumer; pass a processor function that receives each job

A Redis connection is shared between the queue and the worker. In production the worker is a separate Node.js process (not the Next.js server). In development you can run both in the same process for simplicity.

**Why Redis, not a database queue?** Redis operations for queue operations (atomic push, sorted-set pop with score) are O(log N) and happen in microseconds. A database-backed queue (like Laravel's `database` driver) requires polling — every worker does `SELECT ... FOR UPDATE SKIP LOCKED` periodically, causing DB load and latency at low job rates. Redis is lock-free and low-latency.

## Step-by-step

### 1. Install BullMQ

```bash
pnpm add bullmq
```

BullMQ requires Redis 6.2+ (LMPOP support). The `redis:7-alpine` image from Day 102 satisfies this.

### 2. Create a shared Redis connection

```ts name=src/lib/redis.ts
import { Redis } from 'ioredis';

const getRedisUrl = () => {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL is not set');
  }
  return process.env.REDIS_URL;
};

// BullMQ requires separate connection instances for Queue and Worker
// because the Worker connection enters blocking mode
export const createRedisConnection = () =>
  new Redis(getRedisUrl(), {
    maxRetriesPerRequest: null,  // required by BullMQ
  });
```

BullMQ documentation mandates `maxRetriesPerRequest: null` — without it, failed Redis connections throw instead of retrying, which breaks the worker's retry logic.

### 3. Define the queue

```ts name=src/lib/queues/index.ts
import { Queue } from 'bullmq';
import { createRedisConnection } from '@/lib/redis';

export const embeddingQueue = new Queue('embeddings', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,   // 1s, 2s, 4s
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const emailQueue = new Queue('emails', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 200 },
  },
});
```

`removeOnComplete` and `removeOnFail` prevent completed/failed job data from accumulating in Redis indefinitely.

### 4. Enqueue a job from a Route Handler

```ts name=src/app/api/chat/route.ts
import { embeddingQueue } from '@/lib/queues';
// ... existing imports

export async function POST(req: Request) {
  const { messages, conversationId } = await req.json();

  // Enqueue embedding generation — do not await it
  await embeddingQueue.add('generate-embedding', {
    conversationId,
    text: messages[messages.length - 1].content,
  });

  // Stream the response immediately — the embedding is generated in the background
  const result = streamText({ model: chatModel, messages });
  return result.toDataStreamResponse();
}
```

The `add` call is fast (a Redis LPUSH — microseconds). The caller does not block on embedding generation.

### 5. Create a basic worker (standalone script)

```ts name=src/workers/embedding-worker.ts
import { Worker } from 'bullmq';
import { createRedisConnection } from '@/lib/redis';

const worker = new Worker(
  'embeddings',
  async (job) => {
    console.log(`[embedding-worker] Processing job ${job.id}:`, job.data);
    // Processor logic goes in Day 113
    await new Promise((resolve) => setTimeout(resolve, 500)); // placeholder
    console.log(`[embedding-worker] Done job ${job.id}`);
  },
  {
    connection: createRedisConnection(),
    concurrency: 2,   // process 2 jobs simultaneously
  }
);

worker.on('completed', (job) => console.log(`Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err.message));

console.log('[embedding-worker] Worker started');
```

### 6. Run the worker

Add a script to `package.json`:

```json name=package.json
{
  "scripts": {
    "worker": "tsx src/workers/embedding-worker.ts"
  }
}
```

In one terminal:

```bash
pnpm dev
```

In another terminal:

```bash
REDIS_URL=redis://localhost:6380 pnpm worker
```

(Port 6380 maps to the docker-compose Redis from Day 102.)

## Test it

With both `pnpm dev` and `pnpm worker` running:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"conversationId":"test-123"}'
```

Expected in the worker terminal:

```
[embedding-worker] Processing job 1: { conversationId: 'test-123', text: 'Hello' }
[embedding-worker] Done job 1
Job 1 completed
```

The HTTP response streams back immediately — it does not wait for the worker to finish.

## Mini-task
Install `@bull-board/fastify` or `@bull-board/express` and create a simple job dashboard at `/admin/queues`. Add a link to it in the admin sidebar (Day 93). The dashboard shows pending, active, completed, and failed jobs in real time.

## Glossary
- **Queue** — BullMQ producer; holds pending jobs in Redis; `queue.add(name, data)` enqueues a job.
- **Worker** — BullMQ consumer; polls Redis for jobs and calls the processor function.
- **`attempts`** — how many times BullMQ retries a failed job before marking it as permanently failed.
- **Exponential backoff** — retry delay doubles on each attempt; prevents hammering a failing external service.
- **`maxRetriesPerRequest: null`** — ioredis option required by BullMQ; disables per-request retry limit so the worker connection can block indefinitely.

## Resources
- [BullMQ — getting started](https://docs.bullmq.io/guide/getting-started)
- [BullMQ — queues](https://docs.bullmq.io/guide/queues)
- [BullMQ — workers](https://docs.bullmq.io/guide/workers)
- [bull-board — dashboard](https://github.com/felixmosh/bull-board)

## Checklist
- [ ] `bullmq` installed
- [ ] `createRedisConnection()` helper with `maxRetriesPerRequest: null`
- [ ] `embeddingQueue` and `emailQueue` defined with retry config
- [ ] `/api/chat` route enqueues a job without awaiting it
- [ ] `src/workers/embedding-worker.ts` exists with placeholder processor
- [ ] `pnpm worker` script runs the worker
- [ ] Job appears and is processed after hitting the chat endpoint
