# Day 88 — Chat widget (useChat + streaming)

## Goal
Build the portfolio's chat widget as a floating Client Component that uses the Vercel AI SDK's `useChat` hook to stream messages from the Route Handler you built on Day 87. The widget opens/closes with a button, displays the conversation history, and submits new messages.

## Estimated time
~2 hours

## Prerequisites
Day 87 (`POST /api/chat` route handler working, streaming responses confirmed with curl).

## Where to put your code
In `ai-folio`.

## Explanation

**`useChat`** is a React hook from `ai/react` that connects a Client Component to a streaming Route Handler. It manages the message array, the current input value, loading state, and the streaming connection — everything you'd otherwise write manually with `useState`, `useEffect`, and `EventSource`. In Laravel terms it is like a pre-built AJAX layer that handles SSE parsing, appends partial tokens to the UI as they arrive, and retries on failure.

The hook POSTs to `/api/chat` (or any URL you specify) with the current message history. The server responds with a stream; `useChat` appends each token delta to the last assistant message in real time. When the stream ends, the full response is committed to the messages array.

**Widget architecture:** a floating button fixed to the bottom-right corner (like Intercom or Crisp). Clicking it toggles a chat panel. The panel is a Client Component (`'use client'`) because it uses `useChat`, manages open/close state, and handles keyboard events. The root layout stays a Server Component — the widget is appended to it as a Client Component leaf.

## Step-by-step

### 1. Install dependencies

```bash
pnpm dlx shadcn-ui@latest add sheet scroll-area
```

We'll use `Sheet` (slide-in panel) for the chat UI.

### 2. Message bubble component

```tsx name=src/components/chat/message-bubble.tsx
import { cn } from '@/lib/utils';
import type { Message } from 'ai';

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
```

### 3. Chat panel (inner component)

```tsx name=src/components/chat/chat-panel.tsx
'use client';

import { useChat } from 'ai/react';
import { useEffect, useRef } from 'react';
import { SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './message-bubble';

export function ChatPanel() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: '/api/chat',
      initialMessages: [
        {
          id: 'welcome',
          role: 'assistant',
          content:
            "Hi! I'm an AI assistant. Ask me anything about this portfolio.",
        },
      ],
    });

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      {/* Message list */}
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl bg-muted px-4 py-2 text-sm text-muted-foreground">
                <span className="animate-pulse">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t p-3"
      >
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask me anything…"
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          <SendHorizontal size={16} />
        </Button>
      </form>
    </div>
  );
}
```

### 4. Chat widget — floating button + Sheet

```tsx name=src/components/chat/chat-widget.tsx
'use client';

import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ChatPanel } from './chat-panel';

export function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating trigger button */}
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
        aria-label="Open chat"
      >
        <MessageCircle size={24} />
      </Button>

      {/* Slide-in chat panel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col p-0 sm:max-w-md"
        >
          <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
            <SheetTitle className="text-base">Chat with AI</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              <X size={16} />
            </Button>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <ChatPanel />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

### 5. Add ChatWidget to the root layout

```tsx name=src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { ChatWidget } from '@/components/chat/chat-widget';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000',
  ),
  title: { default: 'ai-folio', template: '%s | ai-folio' },
  description: 'AI-powered portfolio site.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={cn(inter.className, 'flex min-h-screen flex-col')}>
        <Navbar />
        <main className="container mx-auto flex-1 px-4 py-8">{children}</main>
        <Footer />
        <ChatWidget />
      </body>
    </html>
  );
}
```

`ChatWidget` is a Client Component leaf. The rest of `RootLayout` stays server-rendered.

### 6. Add shadcn Input if not already present

```bash
pnpm dlx shadcn-ui@latest add input
```

## Test it

```bash
pnpm dev
```

1. Visit `http://localhost:3000`. A chat bubble should appear at the bottom-right.
2. Click it — the Sheet slides in from the right with the welcome message.
3. Type "What technologies does this portfolio use?" and press Enter.
4. Watch tokens stream in word by word into the assistant message bubble.
5. Send a second message — conversation history is maintained (Claude sees prior turns).
6. Press Escape or click X — Sheet closes. Click the button again — previous messages persist (state lives in the component, not the URL).

## Mini-task
Add a "Clear conversation" button inside `ChatPanel` that calls `useChat`'s returned `setMessages([])` function (destructure it from `useChat`). Reset the messages to just the welcome message.

## Glossary
- **`useChat`** — Vercel AI SDK hook; manages message history, input state, streaming, and loading.
- **`handleSubmit`** — form submit handler returned by `useChat`; POSTs messages to the API route and opens the SSE stream.
- **`isLoading`** — `true` while the server is streaming; use it to disable the input and show a typing indicator.
- **`Sheet`** — shadcn/ui side panel component; slide-in overlay without blocking the main page.
- **`ScrollArea`** — shadcn/ui scrollable container; handles overflow without custom CSS.

## Resources
- [Vercel AI SDK — useChat](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat)
- [shadcn/ui — Sheet](https://ui.shadcn.com/docs/components/sheet)
- [shadcn/ui — ScrollArea](https://ui.shadcn.com/docs/components/scroll-area)

## Checklist
- [ ] `ChatWidget` renders a fixed floating button at bottom-right
- [ ] Clicking the button opens a Sheet with the chat panel
- [ ] `useChat` connects to `POST /api/chat`
- [ ] Messages stream token by token into the UI
- [ ] `isLoading` shows a "Thinking…" indicator while streaming
- [ ] Conversation history persists across multiple turns
- [ ] `pnpm build` passes
