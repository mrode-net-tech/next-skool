# Day 99 — AI draft-reply feature

## Goal
Add a "Generate draft reply" button to the conversation detail page. Clicking it calls Claude to write a professional email reply based on the full conversation. The reply streams into an editable textarea. The admin can edit it and copy it to their clipboard.

## Estimated time
~2 hours

## Prerequisites
Day 98 (analytics tab done). Conversation detail page from Day 93.

## Where to put your code
In `ai-folio`. New Route Handler `src/app/api/admin/conversations/[id]/draft-reply/route.ts` and a client component for the UI.

## Explanation

**Streaming into a textarea** is a different use case than the chat widget. The `useChat` hook assumes a multi-turn conversation format. For single-shot generation into an editable field, use the lower-level `useCompletion` hook from `ai/react` — it manages a single prompt → completion flow with streaming, without the message history overhead.

**`useCompletion`** POSTs to a URL you specify, streams the response, and exposes `completion` (the full accumulated text so far), `isLoading`, and `complete(prompt)` (trigger function). You display `completion` in a controlled `<textarea>` that the admin can then edit.

**Admin-only Route Handler**: This endpoint should only be reachable by authenticated admins. In a Route Handler you call `auth()` from Auth.js — if the session is missing, return `401`.

In Laravel terms: this is a controller method that accepts a POST request (conversation ID), calls an external LLM service, and streams the response back as SSE — like `StreamedResponse` with a generator function.

## Step-by-step

### 1. Draft reply Route Handler

```ts name=src/app/api/admin/conversations/[id]/draft-reply/route.ts
import { streamText } from 'ai';
import { auth } from '@/../auth';
import { prisma } from '@/lib/db';
import { chatModel } from '@/lib/ai';

export const maxDuration = 30;

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  // Admin-only
  const session = await auth();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      lead: true,
    },
  });

  if (!conversation) return new Response('Not found', { status: 404 });

  const transcript = conversation.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const intent = conversation.intent?.replace('_', ' ') ?? 'general enquiry';
  const score = conversation.leadScore ?? '?';

  const prompt = `You are helping a software engineer (portfolio owner) draft a professional reply to a visitor.

CONVERSATION CONTEXT:
- Intent: ${intent}
- Lead score: ${score}/5
- Visitor email: ${conversation.visitorEmail ?? 'not provided'}

TRANSCRIPT:
${transcript}

Write a concise, professional email reply. Tone: friendly but direct. No fluff.
Start with "Hi," (do not add a name unless it was mentioned in the conversation).
End with a clear next step or question.
Do not include a subject line.`;

  const result = streamText({
    model: chatModel,
    prompt,
    maxTokens: 400,
  });

  return result.toDataStreamResponse();
}
```

### 2. Draft reply Client Component

```tsx name=src/components/admin/draft-reply.tsx
'use client';

import { useCompletion } from 'ai/react';
import { useState } from 'react';
import { Sparkles, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface DraftReplyProps {
  conversationId: string;
}

export function DraftReply({ conversationId }: DraftReplyProps) {
  const [editedDraft, setEditedDraft] = useState('');
  const [copied, setCopied] = useState(false);

  const { complete, completion, isLoading } = useCompletion({
    api: `/api/admin/conversations/${conversationId}/draft-reply`,
    onFinish: (_prompt, result) => {
      setEditedDraft(result);
    },
  });

  const displayText = editedDraft || completion;

  async function copyToClipboard() {
    await navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Draft reply</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditedDraft('');
              complete('');
            }}
            disabled={isLoading}
          >
            <Sparkles size={14} className="mr-1" />
            {isLoading ? 'Generating…' : 'Generate'}
          </Button>
          {displayText && (
            <Button
              size="sm"
              variant="outline"
              onClick={copyToClipboard}
            >
              {copied ? (
                <Check size={14} className="mr-1 text-green-600" />
              ) : (
                <Copy size={14} className="mr-1" />
              )}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          )}
        </div>
      </div>

      {displayText && (
        <Textarea
          value={editedDraft || completion}
          onChange={(e) => setEditedDraft(e.target.value)}
          rows={8}
          className="font-mono text-sm"
          placeholder="Draft will appear here…"
        />
      )}

      {!displayText && !isLoading && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Click "Generate" to draft an AI reply based on this conversation.
        </div>
      )}
    </div>
  );
}
```

### 3. Add DraftReply to the conversation detail page

Update `src/app/admin/conversations/[id]/page.tsx` to include the component:

```tsx name=src/app/admin/conversations/[id]/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { DraftReply } from '@/components/admin/draft-reply';
import { formatDistanceToNow } from 'date-fns';

export default async function ConversationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      lead: true,
    },
  });

  if (!conversation) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="mb-1 text-2xl font-bold">Conversation</h1>
        <p className="font-mono text-xs text-muted-foreground">{conversation.id}</p>
      </div>

      {/* Meta badges */}
      <div className="flex flex-wrap gap-3">
        {conversation.intent && (
          <Badge>{conversation.intent.replace('_', ' ')}</Badge>
        )}
        {conversation.leadScore && (
          <Badge variant="secondary">
            {'★'.repeat(conversation.leadScore)}{'☆'.repeat(5 - conversation.leadScore)}
          </Badge>
        )}
        <Badge variant="outline">{conversation.status}</Badge>
        {conversation.visitorEmail && (
          <Badge variant="outline">{conversation.visitorEmail}</Badge>
        )}
      </div>

      {/* AI summary */}
      {conversation.aiSummary && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            AI summary
          </p>
          <p className="text-sm">{conversation.aiSummary}</p>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Messages</h2>
        {conversation.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <p className="mb-1 text-xs opacity-60">
                {msg.role} · {formatDistanceToNow(msg.createdAt, { addSuffix: true })}
              </p>
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* AI draft reply */}
      <DraftReply conversationId={conversation.id} />
    </div>
  );
}
```

## Test it

```bash
pnpm dev
```

1. Log in as admin, open a scored conversation.
2. Scroll to the "Draft reply" section.
3. Click "Generate" — tokens stream into the textarea character by character.
4. Edit the draft text directly in the textarea.
5. Click "Copy" — paste into your email client.
6. Try generating again — previous edits are cleared and a fresh draft streams in.

## Mini-task
Add a "Regenerate" button that fires `complete('')` again without clearing `editedDraft` first — show a confirmation dialog (`window.confirm`) before overwriting. This prevents accidentally losing a good edit.

## Glossary
- **`useCompletion`** — Vercel AI SDK hook for single-shot prompt → completion; simpler than `useChat` when you don't need multi-turn history.
- **`complete(prompt)`** — trigger function returned by `useCompletion`; POSTs to the API and starts the stream.
- **`onFinish`** — callback fired when the stream ends; use to copy `completion` into local editable state.
- **`navigator.clipboard.writeText`** — Web API for copying text programmatically; only works on HTTPS or localhost.
- **`maxTokens`** — limit on the LLM's output length; 400 tokens ≈ 300 words, enough for a short email.

## Resources
- [Vercel AI SDK — `useCompletion`](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-completion)
- [MDN — Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText)

## Checklist
- [ ] `POST /api/admin/conversations/:id/draft-reply` returns 401 without session
- [ ] Route Handler builds a prompt with transcript + intent + score
- [ ] `streamText` streams Claude's reply
- [ ] `useCompletion` connects to the route and streams into the textarea
- [ ] Admin can edit the streamed text directly
- [ ] "Copy" button copies to clipboard and shows a "Copied!" confirmation
- [ ] `pnpm build` passes
