# Day 87 — Claude API intro + streamText

## Goal
Wire the Claude API into `ai-folio` via a Next.js Route Handler. Use the Vercel AI SDK's `streamText` to stream Claude's response token-by-token. Understand why streaming matters for LLM UX and how Next.js Route Handlers replace Express routes.

## Estimated time
~2 hours

## Prerequisites
Day 86 (Server vs Client Components understood). An `ANTHROPIC_API_KEY` from console.anthropic.com.

## Where to put your code
In `ai-folio`.

## Explanation

**Next.js Route Handlers** (`app/api/.../route.ts`) replace the need for a separate Express server for simple API endpoints. They run on the server, export named functions (`GET`, `POST`, `DELETE`, etc.), and have access to the full Node.js environment. In Laravel terms they are like controller methods — but file-based, with no route registration file needed.

**The Vercel AI SDK** (`ai` package) is a TypeScript library designed specifically for building AI-powered UIs with Next.js, React, and other frameworks. Its `streamText` function wraps Claude (via `@ai-sdk/anthropic`), OpenAI, and other providers behind a single interface, and its `toDataStreamResponse()` method returns a streaming HTTP response that the `useChat` hook on the frontend can consume directly.

**Streaming matters** because Claude's responses can take several seconds. Without streaming the user stares at a blank input until the entire response is ready. With streaming each token appears as it is generated — exactly like the Claude.ai interface. The browser uses the `text/event-stream` content type (Server-Sent Events) to receive the token stream.

In Laravel terms: streaming is like `response()->streamDownload()` but instead of a file you're streaming JSON-encoded tokens, and the browser's `EventSource` API reads them in real time.

## Step-by-step

### 1. Install the Vercel AI SDK + Anthropic provider

```bash
pnpm add ai @ai-sdk/anthropic
```

### 2. Add API key to environment

```bash name=.env.local
ANTHROPIC_API_KEY=sk-ant-...
```

Never commit `.env.local`. Verify `.gitignore` already has `.env*`.

### 3. Create the chat Route Handler

```ts name=src/app/api/chat/route.ts
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export const maxDuration = 30; // seconds — Vercel hobby tier limit

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system:
      'You are an AI assistant on a portfolio website. Answer questions about the portfolio owner concisely and professionally.',
    messages,
  });

  return result.toDataStreamResponse();
}
```

`messages` follows the OpenAI-compatible format: `[{ role: 'user' | 'assistant', content: string }]`. The Vercel AI SDK normalises this for every provider.

### 4. Test the route with curl

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello, what can you tell me about the portfolio owner?"}]}' \
  --no-buffer
```

Expected: a stream of `data: ...` lines (Server-Sent Events format) ending with `data: [DONE]`. Each line contains a JSON-encoded token delta.

### 5. Understand the response format

The SDK streams in the Vercel AI data stream protocol:

```
data: {"type":"text-delta","textDelta":"Hello"}
data: {"type":"text-delta","textDelta":"!"}
data: {"type":"finish","finishReason":"stop","usage":{"promptTokens":42,"completionTokens":10}}
data: [DONE]
```

You do not need to parse this manually — the `useChat` hook on Day 88 does it for you.

### 6. Add a model configuration helper

```ts name=src/lib/ai.ts
import { anthropic } from '@ai-sdk/anthropic';

// Single place to swap the model across the whole app
export const chatModel = anthropic('claude-sonnet-4-6');
export const fastModel = anthropic('claude-haiku-4-5-20251001');
```

Update `route.ts` to use `chatModel`:

```ts name=src/app/api/chat/route.ts
import { streamText } from 'ai';
import { chatModel } from '@/lib/ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: chatModel,
    system:
      'You are an AI assistant on a portfolio website. Answer questions about the portfolio owner concisely and professionally.',
    messages,
  });

  return result.toDataStreamResponse();
}
```

### 7. Handle errors in the route

```ts name=src/app/api/chat/route.ts
import { streamText } from 'ai';
import { chatModel } from '@/lib/ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const result = streamText({
      model: chatModel,
      system:
        'You are an AI assistant on a portfolio website. Answer questions about the portfolio owner concisely and professionally.',
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

## Test it

```bash
pnpm dev
```

Run the curl command from step 4. Confirm you see a token stream in the terminal. Try a second message mentioning TypeScript — Claude should respond about the portfolio owner's skills.

Also test the error path:

```bash
# Temporarily remove ANTHROPIC_API_KEY from .env.local, restart dev server
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'
# Expect 500 response
```

Restore the key when done.

## Mini-task
Add a `temperature` parameter (e.g. `0.7`) to `streamText`. Re-run the curl test a few times with the same prompt. Notice variation in the responses — temperature controls randomness. Try `0` for deterministic output.

## Glossary
- **Route Handler** — `app/api/.../route.ts` file; exports `GET`/`POST`/etc. functions; replaces Express for simple endpoints in Next.js.
- **`streamText`** — Vercel AI SDK function that calls an LLM and returns a streaming response object.
- **`toDataStreamResponse()`** — converts the `streamText` result into an HTTP streaming response the `useChat` hook understands.
- **SSE (Server-Sent Events)** — HTTP streaming protocol using `Content-Type: text/event-stream`; one-way server → browser channel.
- **`maxDuration`** — Next.js Route Handler setting; controls the maximum execution time for serverless/edge functions.

## Resources
- [Vercel AI SDK — streamText](https://sdk.vercel.ai/docs/reference/ai-sdk-core/stream-text)
- [Vercel AI SDK — Anthropic provider](https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic)
- [Next.js — Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

## Checklist
- [ ] `ai` and `@ai-sdk/anthropic` installed
- [ ] `ANTHROPIC_API_KEY` set in `.env.local` (not committed)
- [ ] `POST /api/chat` route handler streams a response
- [ ] curl test shows SSE token stream
- [ ] `src/lib/ai.ts` centralises model config
- [ ] Error handling returns 500 without crashing the process
