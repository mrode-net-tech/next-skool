# Day 95 — Lead scoring with generateObject

## Goal
After each chat conversation ends, automatically score it with Claude using `generateObject`. Extract the visitor's intent (job offer / collaboration / question / spam) and a 1–5 lead score. Store the result, then create a `Lead` and `KanbanCard` for high-scoring conversations.

## Estimated time
~2.5 hours

## Prerequisites
Day 94 (Kanban board working). `Lead` and `KanbanCard` tables in the DB (from the Prisma migration on Day 89).

## Where to put your code
In `ai-folio`. Primary new files: `src/lib/lead-scoring.ts` and a background trigger in `src/app/api/chat/route.ts`.

## Explanation

**`generateObject`** is the Vercel AI SDK function for structured LLM output. You provide a Zod schema; the SDK instructs Claude to respond in JSON matching that schema and validates the output. If Claude returns malformed JSON, the SDK retries automatically (up to 3 times). You get a fully typed TypeScript object — no `JSON.parse`, no `as` casts.

This is the right tool for classification tasks: intent detection, sentiment analysis, lead scoring — anywhere you need a structured decision from an LLM rather than free-form prose.

**When to trigger scoring:** After the chat stream ends (`onFinish` callback in `streamText`). This runs server-side, asynchronously — the visitor does not wait for it. The scoring call uses `fastModel` (Claude Haiku) to keep latency and cost low. Claude Haiku costs ~20× less than Sonnet; for a simple classification task the quality difference is negligible.

**Idempotency:** The scoring runs on every message, but only creates a `Lead` once per conversation. Add a check: if `conversation.leadScore !== null`, skip the full scoring and just re-score. Or simpler: score after every turn and upsert the lead.

In Laravel terms: `generateObject` is like calling an external classification API and expecting a typed JSON response — except you define the schema in Zod, and the LLM fills it. The scoring trigger is like a Laravel `event()` dispatched at the end of a controller, handled by a queued `Listener`.

## Step-by-step

### 1. Lead scoring schema and function

```ts name=src/lib/lead-scoring.ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { fastModel } from '@/lib/ai';
import { prisma } from '@/lib/db';

const LeadScoringSchema = z.object({
  intent: z.enum(['job_offer', 'collaboration', 'general_question', 'spam']),
  score: z.number().int().min(1).max(5),
  reasoning: z.string().max(300),
});

export type LeadScoring = z.infer<typeof LeadScoringSchema>;

function buildScoringPrompt(messages: Array<{ role: string; content: string }>): string {
  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  return `You are analysing a chat conversation from a software engineer's portfolio website.

Score this conversation for the portfolio owner's purposes:

INTENT — choose one:
- job_offer: visitor is a recruiter or hiring manager, mentions a role or company
- collaboration: visitor wants to work together on a project or startup
- general_question: curious visitor asking general questions
- spam: promotional content, bot, or irrelevant

SCORE (1-5):
1 = spam or no value
2 = curious but not actionable
3 = possibly interesting (collaboration, vague inquiry)
4 = strong lead (clear intent, real name/company)
5 = exceptional lead (immediate opportunity, specific role, contact info shared)

CONVERSATION:
${transcript}

Return only the JSON object matching the schema. Be concise in reasoning (max 2 sentences).`;
}

export async function scoreConversation(conversationId: string): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!conversation || conversation.messages.length < 2) return;

  let scoring: LeadScoring;

  try {
    const result = await generateObject({
      model: fastModel,
      schema: LeadScoringSchema,
      prompt: buildScoringPrompt(conversation.messages),
    });
    scoring = result.object;
  } catch (error) {
    console.error('[lead-scoring] generateObject failed:', error);
    return;
  }

  // Update the conversation
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      intent: scoring.intent,
      leadScore: scoring.score,
    },
  });

  // Create or update a Lead if score >= 3
  if (scoring.score >= 3) {
    const lead = await prisma.lead.upsert({
      where: { conversationId },
      create: {
        conversationId,
        score: scoring.score,
        intent: scoring.intent,
        status: 'new',
      },
      update: {
        score: scoring.score,
        intent: scoring.intent,
      },
    });

    // Create a KanbanCard if it doesn't exist yet
    await prisma.kanbanCard.upsert({
      where: { leadId: lead.id },
      create: {
        leadId: lead.id,
        column: 'new',
        order: Date.now(), // simple initial ordering
      },
      update: {}, // don't move existing card on re-score
    });

    if (scoring.score >= 4) {
      // Email notification stub — wired up on Day 96
      console.log(
        `[lead-scoring] High-value lead! Score: ${scoring.score}, Intent: ${scoring.intent}, conversationId: ${conversationId}`,
      );
    }
  }
}
```

### 2. Trigger scoring after each chat turn

Update the chat Route Handler to call `scoreConversation` asynchronously after the stream ends:

```ts name=src/app/api/chat/route.ts
import { streamText } from 'ai';
import { chatModel } from '@/lib/ai';
import { searchSimilar } from '@/lib/vector-search';
import { prisma } from '@/lib/db';
import { scoreConversation } from '@/lib/lead-scoring';

export const maxDuration = 30;

function buildSystemPrompt(contextChunks: string[]): string {
  const context = contextChunks.join('\n\n');
  return `You are an AI assistant on a portfolio website. Answer concisely and professionally.
Only use information from the context below. If not in context, say you don't know.

--- CONTEXT ---
${context}
--- END CONTEXT ---`;
}

export async function POST(req: Request) {
  try {
    const { messages, sessionId } = await req.json();

    // Retrieve or create the conversation
    let conversation = await prisma.conversation.findFirst({
      where: { sessionId },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { sessionId },
      });
    }

    // Persist the latest user message
    const lastUser = [...messages].reverse().find(
      (m: { role: string }) => m.role === 'user',
    );

    if (lastUser) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          content: lastUser.content,
        },
      });
    }

    // RAG retrieval
    const contextChunks = lastUser
      ? (await searchSimilar(lastUser.content, 5)).map((r) => r.content)
      : [];

    const result = streamText({
      model: chatModel,
      system: buildSystemPrompt(contextChunks),
      messages,
      onFinish: async ({ text }) => {
        // Persist assistant response
        await prisma.message.create({
          data: {
            conversationId: conversation!.id,
            role: 'assistant',
            content: text,
          },
        });

        // Score asynchronously — do not await (visitor already has the response)
        scoreConversation(conversation!.id).catch(console.error);
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('[chat/route] unexpected error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
```

### 3. Test scoring manually with a script

```ts name=scripts/test-scoring.ts
import { scoreConversation } from '../src/lib/lead-scoring';
import { prisma } from '../src/lib/db';

// Create a test conversation
const conv = await prisma.conversation.create({
  data: {
    sessionId: `test-${Date.now()}`,
    messages: {
      create: [
        {
          role: 'user',
          content: "Hi! I'm a recruiter at Acme Corp. We're looking for a senior TypeScript engineer for a 6-month contract. Are you available?",
        },
        {
          role: 'assistant',
          content: 'Hi! Yes, I am available for contract work. I would be happy to discuss the details.',
        },
        {
          role: 'user',
          content: 'Great! The role is fully remote, €700/day. Can I send you a calendar invite?',
        },
      ],
    },
  },
});

await scoreConversation(conv.id);

const scored = await prisma.conversation.findUnique({
  where: { id: conv.id },
  include: { lead: { include: { kanbanCard: true } } },
});

console.log('Scored conversation:', {
  intent: scored?.intent,
  score: scored?.leadScore,
  lead: scored?.lead,
});

await prisma.$disconnect();
```

```bash
npx tsx scripts/test-scoring.ts
```

Expected output:
```
Scored conversation: {
  intent: 'job_offer',
  score: 5,
  lead: { id: '...', score: 5, intent: 'job_offer', kanbanCard: { column: 'new', ... } }
}
```

## Test it

```bash
pnpm dev
```

1. Open the chat widget. Send messages that simulate a recruiter: "Hi, I'm a recruiter at Acme Corp looking for a Next.js engineer for a 6-month contract."
2. Wait ~5 seconds (scoring is async).
3. Visit `/admin/conversations` — the conversation should have an intent and score.
4. Visit `/admin/kanban` — a new card should appear in the "New" column.

Check the terminal logs for the `[lead-scoring] High-value lead!` message.

## Mini-task
Add a `reasoning` field to the `Conversation` model (a `String?`) and save `scoring.reasoning` to it. Display it in the conversation detail page as a small "AI reasoning" section.

## Glossary
- **`generateObject`** — Vercel AI SDK function; prompts an LLM to return JSON matching a Zod schema; retries on parse failure.
- **`fastModel`** — Claude Haiku from `src/lib/ai.ts`; used for classification tasks where cost matters more than prose quality.
- **`onFinish`** — callback in `streamText` fired after the stream ends; use for side effects (DB writes, scoring) that must not block the response.
- **`upsert`** — Prisma operation: update if exists, insert if not; used here to make scoring idempotent.
- **Structured output** — LLM response constrained to a specific JSON schema; eliminates parsing ambiguity.

## Resources
- [Vercel AI SDK — generateObject](https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-object)
- [Vercel AI SDK — onFinish callback](https://sdk.vercel.ai/docs/reference/ai-sdk-core/stream-text#on-finish)
- [Prisma — upsert](https://www.prisma.io/docs/orm/reference/prisma-client-reference#upsert)

## Checklist
- [ ] `generateObject` called with `LeadScoringSchema` (intent + score + reasoning)
- [ ] Scoring runs in `onFinish` callback — does not block the chat stream
- [ ] `Conversation.intent` and `Conversation.leadScore` updated after each turn
- [ ] `Lead` + `KanbanCard` created for conversations with score >= 3
- [ ] Terminal logs `[lead-scoring] High-value lead!` for score >= 4
- [ ] Manual test script produces expected intent/score for a recruiter conversation
- [ ] Chat widget still streams normally (scoring does not affect response latency)
- [ ] `pnpm build` passes
