# Day 89 — RAG setup (pgvector + embeddings)

## Goal
Install and configure `pgvector` (a Postgres extension for vector similarity search), add an `Embedding` table to your Prisma schema, generate embeddings for your CV content using the OpenAI embeddings API, and store them in the database. This is the foundation of the Retrieval-Augmented Generation pipeline.

## Estimated time
~3 hours

## Prerequisites
Day 88 (chat widget working). Docker installed. OpenAI API key (for embeddings — Claude does not have its own embedding model; OpenAI's `text-embedding-3-small` is the standard choice).

## Where to put your code
In `ai-folio`. You will also update `docker-compose.yml` (or create one).

## Explanation

**RAG (Retrieval-Augmented Generation)** is the technique of giving a language model access to a private knowledge base at query time. Instead of fine-tuning Claude on your CV (expensive, slow), you:
1. **Embed** your documents: run them through an embedding model, which turns text into a high-dimensional vector (a list of ~1500 numbers) that represents meaning.
2. **Store** the vectors in a vector database (pgvector inside Postgres).
3. At query time: **embed the user's question**, then **search** the stored vectors for the most similar chunks.
4. **Inject** the matching chunks into Claude's system prompt as context.

In Laravel terms: imagine every paragraph of your CV is indexed in a `FULLTEXT` column, and when a user asks "what databases do you know?", you run a `MATCH AGAINST` search and pass the top 5 results into GPT's system message. pgvector is that index, but for *semantic* similarity — not keyword matching.

**pgvector** is a Postgres extension that adds a `vector` column type and operators for cosine similarity (`<=>`) and L2 distance (`<->`). Prisma supports it via `Unsupported("vector(1536)")` — you use raw SQL for the similarity search while Prisma handles everything else.

**Embeddings model:** `text-embedding-3-small` from OpenAI produces 1536-dimensional vectors and is both fast and cheap. You need a separate `OPENAI_API_KEY` just for embeddings; Claude stays as the chat model.

## Step-by-step

### 1. Start Postgres with pgvector via Docker

```yaml name=docker-compose.yml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: aifolio
      POSTGRES_PASSWORD: aifolio
      POSTGRES_DB: aifolio
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

```bash
docker compose up -d
```

Update `.env.local`:

```bash name=.env.local
DATABASE_URL="postgresql://aifolio:aifolio@localhost:5432/aifolio"
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### 2. Install Prisma + OpenAI

```bash
pnpm add prisma @prisma/client openai
pnpm add -D @types/node
npx prisma init --datasource-provider postgresql
```

### 3. Prisma schema with pgvector

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

model Embedding {
  id        String   @id @default(cuid())
  content   String
  source    String   // "cv" | "project" | "skills"
  metadata  Json     @default("{}")
  vector    Unsupported("vector(1536)")
  createdAt DateTime @default(now())
}
```

Run the migration:

```bash
npx prisma migrate dev --name init_embeddings
```

### 4. Prisma client singleton

```ts name=src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ['error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### 5. Embedding helper

```ts name=src/lib/embeddings.ts
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' '),
  });
  return response.data[0].embedding;
}
```

### 6. CV content as structured chunks

Create a file representing your CV in small, semantically coherent chunks. Each chunk should be 1–3 sentences — small enough to be specific, large enough to have context.

```ts name=src/data/cv-chunks.ts
export interface Chunk {
  content: string;
  source: 'cv' | 'project' | 'skills';
  metadata?: Record<string, string>;
}

export const cvChunks: Chunk[] = [
  {
    source: 'cv',
    content:
      'Senior full-stack engineer with 8 years of experience. Background in Laravel and PHP; now working primarily in the TypeScript ecosystem with Node.js, React, and Next.js.',
  },
  {
    source: 'cv',
    content:
      'Available for full-time remote roles and freelance projects. Preferred timezone: CET. Open to relocation to Western Europe.',
  },
  {
    source: 'skills',
    content:
      'Backend: Node.js, TypeScript, Express, Prisma, PostgreSQL, PHP, Laravel, Redis, BullMQ.',
  },
  {
    source: 'skills',
    content:
      'Frontend: React 18, Next.js 14, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form, Zod.',
  },
  {
    source: 'skills',
    content:
      'AI integrations: Claude API, Vercel AI SDK, pgvector RAG pipelines, streaming LLM responses.',
  },
  {
    source: 'project',
    content:
      'Task Manager: full-stack monorepo with Express API, React SPA, pnpm workspaces, Turborepo, Playwright e2e tests, deployed on Railway and Vercel.',
    metadata: { projectId: 'task-manager' },
  },
  {
    source: 'project',
    content:
      'ai-folio: portfolio site with Claude-powered chat widget, RAG pipeline using pgvector, lead scoring via generateObject, admin Kanban dashboard.',
    metadata: { projectId: 'ai-folio' },
  },
];
```

Edit this file with your real information before running the next step.

### 7. Seed script — generate and store embeddings

```ts name=scripts/seed-embeddings.ts
import { prisma } from '../src/lib/db';
import { embed } from '../src/lib/embeddings';
import { cvChunks } from '../src/data/cv-chunks';

async function main() {
  console.log('Clearing existing embeddings…');
  await prisma.$executeRaw`DELETE FROM "Embedding"`;

  for (const chunk of cvChunks) {
    console.log(`Embedding: "${chunk.content.slice(0, 60)}…"`);
    const vector = await embed(chunk.content);

    await prisma.$executeRaw`
      INSERT INTO "Embedding" (id, content, source, metadata, vector, "createdAt")
      VALUES (
        gen_random_uuid()::text,
        ${chunk.content},
        ${chunk.source},
        ${JSON.stringify(chunk.metadata ?? {})}::jsonb,
        ${JSON.stringify(vector)}::vector,
        NOW()
      )
    `;
  }

  console.log(`Seeded ${cvChunks.length} embeddings.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Add a script to `package.json`:

```json name=package.json
{
  "scripts": {
    "seed:embeddings": "npx tsx scripts/seed-embeddings.ts"
  }
}
```

```bash
pnpm add -D tsx
pnpm seed:embeddings
```

### 8. Similarity search helper

```ts name=src/lib/vector-search.ts
import { prisma } from './db';
import { embed } from './embeddings';

export interface SearchResult {
  content: string;
  source: string;
  distance: number;
}

export async function searchSimilar(
  query: string,
  limit = 5,
): Promise<SearchResult[]> {
  const queryVector = await embed(query);

  const results = await prisma.$queryRaw<SearchResult[]>`
    SELECT
      content,
      source,
      vector <-> ${JSON.stringify(queryVector)}::vector AS distance
    FROM "Embedding"
    ORDER BY distance
    LIMIT ${limit}
  `;

  return results;
}
```

## Test it

```bash
pnpm dev
```

In a separate terminal, create a quick test script:

```ts name=scripts/test-search.ts
import { searchSimilar } from '../src/lib/vector-search';

const results = await searchSimilar('What databases does this person know?');
console.log(results);
```

```bash
npx tsx scripts/test-search.ts
```

Expected: top results contain the `skills` chunk mentioning PostgreSQL and Redis, with a low distance score (closer to 0 = more similar).

## Mini-task
Add a second query: `"Is this person available for freelance?"`. Confirm the availability chunk ranks first. Try a query unrelated to your CV (e.g. `"How do I bake bread?"`). Note the distances are high — the model is honest that nothing in your CV is relevant.

## Glossary
- **Embedding** — numerical representation of text; semantically similar texts have vectors close together in the vector space.
- **`vector(1536)`** — pgvector column type; 1536-dimensional float array matching `text-embedding-3-small`'s output.
- **`<->`** — pgvector L2 distance operator; smaller = more similar. `<=>` is cosine distance.
- **Chunk** — a small, self-contained piece of text (1–3 sentences) used as the retrieval unit.
- **Seed script** — one-time script that pre-populates the database; run once, not on every deploy.

## Resources
- [pgvector — GitHub](https://github.com/pgvector/pgvector)
- [Prisma — pgvector guide](https://www.prisma.io/docs/orm/prisma-client/queries/raw-database-access/custom-and-type-safe-queries#vector-similarity-search)
- [OpenAI — Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [RAG — Practical guide](https://www.pinecone.io/learn/retrieval-augmented-generation/)

## Checklist
- [ ] `docker compose up -d` starts Postgres with pgvector enabled
- [ ] `Embedding` table created via Prisma migration
- [ ] `pnpm seed:embeddings` runs without errors and logs each chunk
- [ ] `scripts/test-search.ts` returns relevant results with low distance for a skills query
- [ ] Unrelated queries return high-distance results
