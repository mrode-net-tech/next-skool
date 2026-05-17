# Day 86 — Server Components vs Client Components

## Goal
Understand the mental model behind React Server Components (RSC): what runs where, how data flows from server to client, and when to reach for `'use client'`. This is the foundational concept that makes Next.js 14 different from everything before it.

## Estimated time
~1.5 hours

## Prerequisites
Day 85 (ai-folio Week 17 complete).

## Where to put your code
In `ai-folio`. No new files — this day is about refactoring and observing.

## Explanation

**Server Components** run on the server, once per request (or once at build time for static pages). They never ship JavaScript to the browser. They can `await` database queries, read the filesystem, access environment variables directly — without any API layer in between. The output is serialised HTML + a special React tree (RSC payload) sent to the browser.

**Client Components** are what React has always been. They ship JavaScript, run in the browser, can use hooks (`useState`, `useEffect`, `useRef`), handle events, and maintain interactive state. You opt in with `'use client'` at the top of the file.

The key insight: `'use client'` is a *boundary*, not a label on a single component. Everything imported by a Client Component also becomes a Client Component unless it is passed as `children` or a prop. This is the "prop-passing" pattern — a Server Component can render a Client Component and pass Server-rendered content as `children`.

In Laravel terms: a Server Component is a Blade partial where the controller already pre-fetched the data. A Client Component is a Vue/Alpine component embedded in that Blade view for interactivity. The Blade partial never ships to the browser as JS; the Alpine component does.

**Decision rule:**

| Need this? | Use |
|---|---|
| DB query, file read, secret env var | Server Component |
| `useState`, `useEffect`, event handlers | Client Component |
| Both (e.g. fetch data + interactive UI) | Server fetches → passes data as props to Client child |

## Step-by-step

### 1. Observe what's already Server vs Client in ai-folio

```
app/layout.tsx       → Server Component (no hooks, no events)
components/navbar.tsx → Client Component ('use client', uses useState + usePathname)
components/footer.tsx → Server Component
app/projects/page.tsx → Server Component (async function, awaits data)
app/projects/[id]/page.tsx → Server Component
```

Open Chrome DevTools → Network tab. Reload `/projects`. Notice: no separate API fetch. The HTML arrives pre-rendered with project data inline.

### 2. Move data fetching deeper — the "async Server Component" pattern

Right now `ProjectsPage` fetches everything and passes it to `ProjectCard`. This is fine. But you can also fetch *inside* a leaf Server Component:

```tsx name=src/components/project-card-server.tsx
import { Badge } from '@/components/ui/badge';
import type { Project } from '@/data/projects';

// This is a Server Component — no 'use client', no hooks
// It receives data as props from a parent Server Component
export function ProjectCardServer({ project }: { project: Project }) {
  return (
    <article className="rounded-xl border p-6">
      <h2 className="mb-2 text-xl font-semibold">{project.title}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{project.description}</p>
      <div className="flex flex-wrap gap-2">
        {project.tags.map((tag) => (
          <Badge key={tag} variant="secondary">{tag}</Badge>
        ))}
      </div>
    </article>
  );
}
```

No `'use client'` = Server Component by default. Zero JS sent for this component.

### 3. The children-passing pattern

When you need a Server Component *inside* a Client Component's layout, pass it via `children`:

```tsx name=src/components/animated-wrapper.tsx
'use client';

import { useState } from 'react';

// Client Component — but its children can still be Server Components
export function AnimatedWrapper({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);

  return (
    <div
      className={`transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={() => setVisible(!visible)}
    >
      {children}
    </div>
  );
}
```

Usage in a Server Component page:

```tsx
// Server Component page — children of AnimatedWrapper stay server-rendered
import { AnimatedWrapper } from '@/components/animated-wrapper';
import { ProjectCardServer } from '@/components/project-card-server';
import { projects } from '@/data/projects';

export default function ProjectsPage() {
  return (
    <AnimatedWrapper>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => <ProjectCardServer key={p.id} project={p} />)}
      </div>
    </AnimatedWrapper>
  );
}
```

`ProjectCardServer` is still a Server Component even though it renders inside a Client Component — because it was passed as `children`, not imported inside the Client Component file.

### 4. What CANNOT be done in a Server Component

```tsx
// ❌ These cause an error in a Server Component:
import { useState } from 'react';      // hooks not allowed
import { useRouter } from 'next/navigation'; // client-only hook

// ❌ Cannot pass non-serialisable values from Server → Client:
// Functions, class instances, Dates (use .toISOString() instead)

// ✅ These are fine in a Server Component:
import { db } from '@/lib/db';         // database access
const secret = process.env.SECRET_KEY; // server-only env var
const data = await fetch('...');       // top-level await
```

### 5. Server-only env vars

Create `src/lib/env.server.ts`:

```ts name=src/lib/env.server.ts
// This file can only be imported by Server Components.
// If a Client Component imports it, Next.js throws an error.
import 'server-only';

export const anthropicApiKey = process.env.ANTHROPIC_API_KEY!;
export const databaseUrl = process.env.DATABASE_URL!;
```

```bash
pnpm add server-only
```

The `server-only` package makes Next.js throw a build error if this file is accidentally imported from a Client Component. Use it for any file that must never ship to the browser.

## Test it

```bash
pnpm build
```

Run `pnpm build` and look at the route output table. Pages listed as `○` (Static) or `●` (SSR) with no client JS listed have zero browser JavaScript for their server parts.

Verify: add `console.log('SERVER LOG')` inside `ProjectsPage`. Run `pnpm dev`, visit `/projects`. The log appears in the *terminal*, not the browser console.

## Mini-task
Add `console.log('CLIENT LOG')` inside the `Navbar` component. Confirm it appears in the browser console (not the terminal). Then add `console.log('SERVER LOG')` to `ProjectsPage`. Confirm it appears only in the terminal.

## Glossary
- **RSC (React Server Component)** — component that runs on the server; no JS in browser bundle.
- **RSC payload** — serialised React tree sent from server to browser; not HTML, not JSON — a React-specific wire format.
- **`'use client'`** — boundary directive; makes a file and its imports into Client Components.
- **`server-only`** — npm package that throws a build error if the file is imported in client context.
- **Children pattern** — passing Server Component output as `children` prop to a Client Component; the children stay server-rendered.

## Resources
- [Next.js — Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Next.js — Client Components](https://nextjs.org/docs/app/building-your-application/rendering/client-components)
- [Next.js — Composition Patterns](https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns)

## Checklist
- [ ] Can explain the difference between Server and Client Components without looking at notes
- [ ] `src/lib/env.server.ts` created with `server-only` guard
- [ ] `console.log` experiment confirms server logs appear in terminal, client logs in browser
- [ ] `pnpm build` passes
