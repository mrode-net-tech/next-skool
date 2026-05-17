# Day 123 — tRPC setup in ai-folio backend

## Goal
Add tRPC to the `ai-folio` Next.js backend. After this day the admin Route Handlers for conversations, leads, and Kanban are replaced by a type-safe tRPC router that both the web admin and the mobile app can consume.

## Estimated time
~2.5 hours

## Prerequisites
Day 122 (Expo Router navigation). Day 92–94 (ai-folio admin dashboard — the routes being replaced).

## Where to put your code
In `ai-folio` (the Next.js backend).

## Explanation

**tRPC** lets you call server functions from the client with full TypeScript types — no OpenAPI spec, no code generation, no manual type duplication. You define a router with procedures (queries and mutations) on the server. The client calls them like regular async functions. TypeScript infers the input and output types automatically. In Laravel terms, tRPC is like Livewire's server-side calls — but for any client (web and mobile), not just the browser.

**When tRPC beats REST for ai-folio's admin routes:**
- You control both ends (Next.js backend + React/React Native frontend)
- You want TypeScript safety across the network boundary
- The API is not public — no external consumers need a REST spec

**When tRPC does NOT replace REST in ai-folio:**
- `/api/chat` — streaming SSE; tRPC subscriptions work but add complexity vs a simple Route Handler
- `/api/health` — external monitoring tools hit this; they need plain HTTP
- Webhooks — GitHub or Resend sends HTTP POST; they don't use tRPC

**Architecture:** tRPC in Next.js App Router is a single Route Handler at `/api/trpc/[trpc]/route.ts` that dispatches all procedure calls. The router is defined separately and imported by both the Route Handler (server) and the client.

## Step-by-step

### 1. Install tRPC in ai-folio

```bash
cd ai-folio
pnpm add @trpc/server @trpc/client @trpc/react-query @tanstack/react-query zod
```

### 2. Create the tRPC instance

```ts name=src/lib/trpc/init.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';

export async function createContext(opts: FetchCreateContextFnOptions) {
  const session = await getServerSession(authOptions);
  return { session };
}

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});
```

### 3. Define the conversations router

```ts name=src/lib/trpc/routers/conversations.ts
import { z } from 'zod';
import { router, protectedProcedure } from '../init';
import { prisma } from '@/lib/prisma';

export const conversationsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
        minScore: z.number().min(1).max(5).optional(),
      })
    )
    .query(async ({ input }) => {
      const conversations = await prisma.conversation.findMany({
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        where: input.minScore ? { leadScore: { gte: input.minScore } } : undefined,
        orderBy: { createdAt: 'desc' },
        include: { messages: { take: 1, orderBy: { createdAt: 'asc' } } },
      });

      let nextCursor: string | undefined;
      if (conversations.length > input.limit) {
        const next = conversations.pop();
        nextCursor = next?.id;
      }

      return { conversations, nextCursor };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const conversation = await prisma.conversation.findUniqueOrThrow({
        where: { id: input.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      return conversation;
    }),

  updateKanbanStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['new', 'reviewing', 'replied', 'archived']),
      })
    )
    .mutation(async ({ input }) => {
      return prisma.conversation.update({
        where: { id: input.id },
        data: { kanbanStatus: input.status },
      });
    }),
});
```

### 4. Define the leads router

```ts name=src/lib/trpc/routers/leads.ts
import { z } from 'zod';
import { router, protectedProcedure } from '../init';
import { prisma } from '@/lib/prisma';

export const leadsRouter = router({
  highScore: protectedProcedure
    .input(z.object({ minScore: z.number().default(4) }))
    .query(async ({ input }) => {
      return prisma.conversation.findMany({
        where: { leadScore: { gte: input.minScore } },
        orderBy: [{ leadScore: 'desc' }, { createdAt: 'desc' }],
        take: 50,
        select: {
          id: true,
          leadScore: true,
          intent: true,
          summary: true,
          kanbanStatus: true,
          createdAt: true,
          messages: { take: 1, orderBy: { createdAt: 'asc' }, select: { content: true } },
        },
      });
    }),
});
```

### 5. Assemble the root router

```ts name=src/lib/trpc/router.ts
import { router } from './init';
import { conversationsRouter } from './routers/conversations';
import { leadsRouter } from './routers/leads';

export const appRouter = router({
  conversations: conversationsRouter,
  leads: leadsRouter,
});

export type AppRouter = typeof appRouter;
```

`AppRouter` is the type exported for clients. This single type encodes the entire API contract.

### 6. Create the tRPC Route Handler

```ts name=src/app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/lib/trpc/router';
import { createContext } from '@/lib/trpc/init';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => console.error(`[tRPC] ${path}:`, error)
        : undefined,
  });

export { handler as GET, handler as POST };
```

### 7. Create the web tRPC client (for the Next.js admin dashboard)

```ts name=src/lib/trpc/client.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from './router';

export const trpc = createTRPCReact<AppRouter>();
```

```tsx name=src/app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: '/api/trpc' })],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

Wrap the root layout:

```tsx name=src/app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## Test it

With `pnpm dev` running:

```bash
# Test the conversations.list procedure
curl -X GET 'http://localhost:3000/api/trpc/conversations.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22limit%22%3A5%7D%7D%7D' \
  -H "Cookie: <your-session-cookie>"
```

Or test via the web admin — replace an existing `fetch('/api/conversations')` call with:

```tsx
const { data } = trpc.conversations.list.useQuery({ limit: 10 });
```

Verify the TypeScript types flow through: hovering over `data` in VS Code should show the full `conversation` type inferred from the Prisma query.

## Mini-task
Add a `stats` procedure to the `leadsRouter` that returns `{ total: number, highScore: number, byIntent: Record<string, number> }`. Use `prisma.conversation.groupBy` for the `byIntent` breakdown. Call it from the admin dashboard stats page.

## Glossary
- **tRPC** — TypeScript RPC library; server-defined procedures called from the client with full type inference.
- **`router`** — tRPC function that groups procedures; routers can be nested.
- **`publicProcedure`** — base procedure with no auth check; any caller can invoke it.
- **`protectedProcedure`** — procedure that checks session before running; throws `UNAUTHORIZED` if not logged in.
- **`AppRouter`** — the TypeScript type of the root router; exported and imported by clients for type inference.
- **`httpBatchLink`** — tRPC link that batches multiple procedure calls into a single HTTP request.

## Resources
- [tRPC — Next.js App Router setup](https://trpc.io/docs/client/nextjs/setup)
- [tRPC — procedures](https://trpc.io/docs/server/procedures)
- [tRPC — protected procedures](https://trpc.io/docs/server/middlewares)

## Checklist
- [ ] `@trpc/server`, `@trpc/client`, `@trpc/react-query` installed in `ai-folio`
- [ ] `src/lib/trpc/init.ts` defines `createContext`, `publicProcedure`, `protectedProcedure`
- [ ] `conversationsRouter` has `list`, `byId`, `updateKanbanStatus` procedures
- [ ] `leadsRouter` has `highScore` procedure
- [ ] `appRouter` assembles sub-routers; `AppRouter` type exported
- [ ] `GET/POST /api/trpc/[trpc]` Route Handler dispatches all calls
- [ ] `Providers` wraps root layout with tRPC + TanStack Query providers
- [ ] curl test returns conversation data (with valid session cookie)
