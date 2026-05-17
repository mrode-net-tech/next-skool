# Day 90 — Chat answers from CV context

## Goal
Connect the pgvector similarity search from Day 89 to the Claude chat route. When a visitor asks a question, retrieve the most relevant CV chunks and inject them into Claude's system prompt. The chat widget now answers questions *about you* instead of speaking generically.

## Estimated time
~2 hours

## Prerequisites
Day 89 (pgvector set up, embeddings seeded, `searchSimilar` helper working).

## Where to put your code
In `ai-folio`. Primary change is `src/app/api/chat/route.ts`.

## Explanation

The RAG pipeline has three steps:

1. **Retrieve** — embed the user's latest message, run vector similarity search, return the top-N matching CV chunks.
2. **Augment** — build a system prompt that includes those chunks as context.
3. **Generate** — pass the augmented system prompt + the conversation history to Claude.

The key insight: Claude never "knows" your CV — it only knows what you put in its context window right now. RAG is just a structured way of filling that context with the right information at the right moment. Each request is stateless on the model side; the conversation history and context travel up with every request.

**What goes into the system prompt?** Two things:
- A *persona instruction*: who you are, what Claude is allowed to say.
- The *retrieved context*: the actual CV chunks most relevant to the question.

In Laravel terms: imagine your route controller runs a `FULLTEXT` search, prepends the results to a prompt string, and passes that to an external `CurlClient::post('claude')`. Day 90 is wiring those pieces together.

**Token budget:** each CV chunk is ~50–150 tokens. Injecting 5 chunks costs ~750 tokens — trivial for Claude's 200K context window. You do not need to worry about context length for a portfolio site.

## Step-by-step

### 1. Update the chat route to use RAG

```ts name=src/app/api/chat/route.ts
import { streamText } from 'ai';
import { chatModel } from '@/lib/ai';
import { searchSimilar } from '@/lib/vector-search';

export const maxDuration = 30;

function buildSystemPrompt(contextChunks: string[]): string {
  const context = contextChunks.join('\n\n');

  return `You are an AI assistant embedded in the portfolio website of [Your Name], a senior full-stack engineer.

Your job is to answer visitor questions about [Your Name]'s skills, experience, projects, and availability.
Be concise, factual, and professional. Do not invent information not present in the context below.
If the answer is not in the context, say you don't have that information and suggest the visitor use the contact form.

--- CONTEXT (facts about the portfolio owner) ---
${context}
--- END CONTEXT ---`;
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Retrieve the user's latest message for the similarity search
    const lastUserMessage = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === 'user');

    const contextChunks =
      lastUserMessage
        ? (await searchSimilar(lastUserMessage.content, 5)).map(
            (r) => r.content,
          )
        : [];

    const result = streamText({
      model: chatModel,
      system: buildSystemPrompt(contextChunks),
      messages,
      onError: ({ error }) => {
        console.error('[chat/route] streamText error:', error);
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('[chat/route] unexpected error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
```

### 2. Handle the case where the database is unavailable

Wrap the vector search with a fallback so the chat widget still works without the DB (useful for local dev without Docker):

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
  try {
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
  } catch (error) {
    console.error('[vector-search] search failed, returning empty context:', error);
    return [];
  }
}
```

### 3. Add a debug log to inspect retrieved context (dev only)

```ts name=src/app/api/chat/route.ts
// Add inside the POST handler, after retrieval:
if (process.env.NODE_ENV === 'development') {
  console.log(
    '[chat/route] retrieved context:',
    contextChunks.map((c) => c.slice(0, 80)).join('\n'),
  );
}
```

This lets you watch the terminal to see which CV chunks are being retrieved for each question.

### 4. Update the welcome message in the chat panel

```tsx name=src/components/chat/chat-panel.tsx
// Update the initialMessages in useChat:
initialMessages: [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      "Hi! I'm an AI assistant with knowledge of this portfolio. Ask me about skills, projects, availability, or anything else you'd like to know.",
  },
],
```

### 5. Add a "Sources" toggle (optional enhancement)

If you want to show the visitor which parts of your CV answered their question, extend the route to return source information via `experimental_streamData`:

```ts name=src/app/api/chat/route.ts
import { streamText, StreamData } from 'ai';
import { chatModel } from '@/lib/ai';
import { searchSimilar } from '@/lib/vector-search';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const lastUserMessage = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === 'user');

    const searchResults = lastUserMessage
      ? await searchSimilar(lastUserMessage.content, 5)
      : [];

    const contextChunks = searchResults.map((r) => r.content);
    const sources = [...new Set(searchResults.map((r) => r.source))];

    const data = new StreamData();
    data.append({ sources });

    const result = streamText({
      model: chatModel,
      system: buildSystemPrompt(contextChunks),
      messages,
      onFinish: () => data.close(),
    });

    return result.toDataStreamResponse({ data });
  } catch (error) {
    console.error('[chat/route] unexpected error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
```

On the frontend, `useChat` exposes `data` which you can render as small source badges below each assistant message. Implement this as the mini-task.

## Test it

```bash
pnpm dev
```

Open the chat widget and ask:

1. `"What programming languages do you know?"` → Should mention TypeScript, PHP, etc. from the skills chunk.
2. `"Tell me about the Task Manager project."` → Should describe the monorepo, Playwright, Railway/Vercel.
3. `"Are you available for freelance work?"` → Should answer from the availability chunk.
4. `"What's the capital of France?"` → Claude should say it doesn't have that information in context.

Watch the **terminal** — you should see the retrieved context logged for each message.

```bash
pnpm build
# Should compile without errors
```

## Mini-task
Read the `data` array returned by `useChat` and display a small row of source badges (e.g. "cv", "project") beneath the last assistant message. The `data` array is populated by `StreamData.append()` in the route.

## Glossary
- **RAG (Retrieval-Augmented Generation)** — technique of injecting retrieved documents into an LLM's context window at query time.
- **System prompt** — instructions prepended to every conversation; sets the LLM's persona and constraints.
- **Context window** — the total token budget Claude can process in one request (200K for Claude Sonnet).
- **`StreamData`** — Vercel AI SDK class for streaming extra JSON metadata alongside the text stream.
- **Semantic search** — finding similar text by meaning (via vector distance) rather than exact keyword match.

## Resources
- [Vercel AI SDK — RAG guide](https://sdk.vercel.ai/docs/guides/rag-chatbot)
- [Vercel AI SDK — StreamData](https://sdk.vercel.ai/docs/reference/stream-helpers/stream-data)
- [Anthropic — Prompt engineering for RAG](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips)

## Checklist
- [ ] `POST /api/chat` retrieves top-5 CV chunks for each user message
- [ ] `buildSystemPrompt` injects the chunks into the system prompt
- [ ] Terminal logs show retrieved context in development mode
- [ ] Chat widget answers skills/project/availability questions with correct facts
- [ ] Questions outside your CV are declined gracefully
- [ ] `searchSimilar` error is caught; chat still works without DB
- [ ] `pnpm build` passes
