# Day 93 — Admin dashboard layout

## Goal
Build the admin section: a sidebar layout wrapping all `/admin/*` pages, a conversations list page that queries the database server-side, and a conversation detail page with message history and lead metadata.

## Estimated time
~2.5 hours

## Prerequisites
Day 92 (Auth.js working — login redirects to `/admin`).

## Where to put your code
In `ai-folio`. All new files under `src/app/admin/`.

## Explanation

The admin section is a **nested layout**. `src/app/admin/layout.tsx` wraps every `/admin/*` page with a sidebar and header. It checks the session server-side using `auth()` and redirects unauthenticated requests — a second layer of protection in addition to `middleware.ts`.

Why check auth in both the middleware and the layout? Middleware runs on the edge (fast, before the page renders); the layout check protects against edge cases where the middleware is bypassed (e.g., direct server-to-server requests). Defence in depth.

**Server Components fetch data directly.** `ConversationsPage` calls `prisma.conversation.findMany()` at the top level — no API call, no `useEffect`. The data arrives with the HTML. This is the same Server Component pattern from Day 86, applied to a real database query.

**Suspense for partial streaming.** Wrap slow data-fetching components in `<Suspense fallback={<Skeleton />}>`. Next.js streams the fast-loading shell (sidebar, header) immediately and fills in the conversation list when the DB query resolves. Users see the UI instantly — even if the DB is slow.

In Laravel terms: the admin layout is like a `Layout` controller middleware group. The Server Component page is a controller method that calls `Conversation::paginate()` and passes it to a Blade view — except it's all in one file.

## Step-by-step

### 1. Admin root page (redirect to conversations)

```tsx name=src/app/admin/page.tsx
import { redirect } from 'next/navigation';

export default function AdminPage() {
  redirect('/admin/conversations');
}
```

### 2. Admin layout with sidebar

```tsx name=src/app/admin/layout.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/../auth';
import { SignOutButton } from '@/components/admin/sign-out-button';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect('/admin/login');

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-56 flex-col border-r bg-muted/40 lg:flex">
        <div className="flex h-16 items-center border-b px-4 font-semibold">
          Admin
        </div>
        <AdminSidebar />
        <div className="mt-auto border-t p-4">
          <p className="mb-2 truncate text-xs text-muted-foreground">
            {session.user?.email}
          </p>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center border-b px-6 lg:hidden">
          <span className="font-semibold">Admin</span>
          <div className="ml-auto">
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

### 3. Sidebar navigation (Client Component for active state)

```tsx name=src/components/admin/admin-sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Kanban, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/admin/conversations', label: 'Conversations', icon: MessageSquare },
  { href: '/admin/kanban',        label: 'Kanban',         icon: Kanban },
  { href: '/admin/analytics',     label: 'Analytics',      icon: BarChart3 },
  { href: '/admin/settings',      label: 'Settings',       icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 px-2 py-4">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            pathname.startsWith(href)
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted',
          )}
        >
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
```

### 4. Conversations list (Server Component)

```tsx name=src/app/admin/conversations/page.tsx
import { Suspense } from 'react';
import { prisma } from '@/lib/db';
import { ConversationsTable } from '@/components/admin/conversations-table';
import { Skeleton } from '@/components/ui/skeleton';

async function ConversationsList() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      messages: { select: { id: true } },
      lead: { select: { score: true, status: true } },
    },
  });

  return <ConversationsTable conversations={conversations} />;
}

export default function ConversationsPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Conversations</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ConversationsList />
      </Suspense>
    </div>
  );
}
```

### 5. Conversations table (Client Component for interactivity)

```tsx name=src/components/admin/conversations-table.tsx
'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { Conversation, Lead } from '@prisma/client';

type ConversationWithMeta = Conversation & {
  messages: { id: string }[];
  lead: Pick<Lead, 'score' | 'status'> | null;
};

const intentColour: Record<string, string> = {
  job_offer: 'bg-green-100 text-green-800',
  collaboration: 'bg-blue-100 text-blue-800',
  general_question: 'bg-gray-100 text-gray-800',
  spam: 'bg-red-100 text-red-800',
};

export function ConversationsTable({
  conversations,
}: {
  conversations: ConversationWithMeta[];
}) {
  if (conversations.length === 0) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        No conversations yet. They will appear here once visitors use the chat widget.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Session</th>
            <th className="px-4 py-3 text-left font-medium">Intent</th>
            <th className="px-4 py-3 text-left font-medium">Score</th>
            <th className="px-4 py-3 text-left font-medium">Messages</th>
            <th className="px-4 py-3 text-left font-medium">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {conversations.map((c) => (
            <tr
              key={c.id}
              className="cursor-pointer transition-colors hover:bg-muted/30"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/admin/conversations/${c.id}`}
                  className="font-mono text-xs hover:underline"
                >
                  {c.sessionId.slice(0, 12)}…
                </Link>
              </td>
              <td className="px-4 py-3">
                {c.intent ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${intentColour[c.intent] ?? 'bg-gray-100'}`}
                  >
                    {c.intent.replace('_', ' ')}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                {c.leadScore
                  ? '★'.repeat(c.leadScore) + '☆'.repeat(5 - c.leadScore)
                  : '—'}
              </td>
              <td className="px-4 py-3">{c.messages.length}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDistanceToNow(c.createdAt, { addSuffix: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

```bash
pnpm add date-fns
```

### 6. Conversation detail page

```tsx name=src/app/admin/conversations/[id]/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
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
        <h1 className="mb-1 text-2xl font-bold">Conversation detail</h1>
        <p className="font-mono text-xs text-muted-foreground">{conversation.id}</p>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3">
        {conversation.intent && <Badge>{conversation.intent.replace('_', ' ')}</Badge>}
        {conversation.leadScore && (
          <Badge variant="secondary">
            Score: {'★'.repeat(conversation.leadScore)}
          </Badge>
        )}
        <Badge variant="outline">{conversation.status}</Badge>
        {conversation.visitorEmail && (
          <Badge variant="outline">{conversation.visitorEmail}</Badge>
        )}
      </div>

      {/* AI summary (if exists) */}
      {conversation.aiSummary && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">AI summary</p>
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
                {msg.role} ·{' '}
                {formatDistanceToNow(msg.createdAt, { addSuffix: true })}
              </p>
              {msg.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Test it

```bash
pnpm dev
```

1. Log in at `/admin/login`.
2. Redirected to `/admin/conversations` — should show the table (possibly empty).
3. Open the chat widget as a visitor, send a few messages.
4. Refresh `/admin/conversations` — new conversation appears.
5. Click the session ID → conversation detail shows message history.
6. Log out — visiting `/admin` redirects to login.

## Mini-task
Add a `?status=new` query param filter to `ConversationsPage`. Read `searchParams` from the page props (`{ searchParams: { status?: string } }`) and pass it to `prisma.conversation.findMany({ where: { status: searchParams.status } })`.

## Glossary
- **Nested layout** — `src/app/admin/layout.tsx` wraps all `/admin/*` pages with sidebar + auth check.
- **`auth()`** — Auth.js v5 function; reads the session from the request in Server Components and Route Handlers.
- **`<Suspense>`** — React boundary; shows fallback while async children resolve; enables streaming HTML.
- **`date-fns`** — date formatting library; `formatDistanceToNow` returns "2 minutes ago" strings.

## Resources
- [Next.js — Layouts](https://nextjs.org/docs/app/building-your-application/routing/layouts-and-templates)
- [Auth.js — Session in Server Components](https://authjs.dev/getting-started/session-management/get-session)
- [Prisma — `include`](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#include-relations)

## Checklist
- [ ] `/admin` redirects to `/admin/conversations`
- [ ] `AdminLayout` checks session server-side; unauthenticated → redirect to login
- [ ] `AdminSidebar` highlights active link using `usePathname`
- [ ] Conversations list fetches from DB as a Server Component inside `<Suspense>`
- [ ] Clicking a conversation row navigates to the detail page
- [ ] Detail page shows all messages in chat-bubble style
- [ ] `pnpm build` passes
