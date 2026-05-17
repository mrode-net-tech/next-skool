# Day 84 — Loading + error UI

## Goal
Add `loading.tsx` and `error.tsx` files to handle async data fetching states and runtime errors gracefully in Next.js. Understand how the App Router maps these special files to React Suspense and Error Boundaries automatically.

## Estimated time
~1.5 hours

## Prerequisites
Day 83 (portfolio sections built).

## Where to put your code
In `ai-folio`.

## Explanation

Next.js has a set of **special file names** that map to React primitives automatically. You never manually write `<Suspense>` or `<ErrorBoundary>` — you just drop a file in the right folder:

| File | What it does |
|---|---|
| `loading.tsx` | Shown instantly while the page's async data resolves (wraps in `<Suspense>`) |
| `error.tsx` | Shown when the page throws an unhandled error (wraps in an `<ErrorBoundary>`) |
| `not-found.tsx` | Shown when `notFound()` is called inside a page |

In Laravel terms: `loading.tsx` is like a skeleton screen you'd show while an Axios request is in-flight, but here it's the *server* rendering the skeleton on the edge before the data is ready. `error.tsx` is like Laravel's `Handler::render()` for a specific page subtree — not the global 500 page.

`error.tsx` **must** be a Client Component (`'use client'`) because React Error Boundaries require lifecycle methods that only exist in client React. It receives `error` (the thrown Error) and `reset` (a function to re-render and retry). The root `app/layout.tsx` is never inside an error boundary — use `app/global-error.tsx` for that edge case.

`not-found.tsx` is a Server Component and gets shown when any code in its route segment calls `notFound()` from `next/navigation`. No redirect, no 404 from the web server — Next.js handles it entirely in React.

## Step-by-step

### 1. Simulate async data fetching

Temporarily update the Projects page to `await` a fake delay so you can see loading states:

```tsx name=src/app/projects/page.tsx
import { projects } from '@/data/projects';
import { ProjectCard } from '@/components/project-card';

async function getProjects() {
  // Simulates a database call. Remove the delay in production.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return projects;
}

export default async function ProjectsPage() {
  const data = await getProjects();

  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">Projects</h1>
      <p className="mb-8 text-muted-foreground">Things I&apos;ve built.</p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}
```

### 2. Root loading UI

```tsx name=src/app/loading.tsx
export default function RootLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
```

This is shown for *any* page in the app while its async data is pending. Add a more specific one next to the Projects page to override it:

```tsx name=src/app/projects/loading.tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function ProjectsLoading() {
  return (
    <section>
      <Skeleton className="mb-2 h-9 w-48" />
      <Skeleton className="mb-8 h-5 w-32" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-52 w-full rounded-xl" />
        ))}
      </div>
    </section>
  );
}
```

```bash
pnpm dlx shadcn-ui@latest add skeleton
```

### 3. Error boundary for a page

```tsx name=src/app/projects/error.tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to an error reporting service in production (e.g. Sentry, Day 116)
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-bold">Something went wrong</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

### 4. Not-found page

```tsx name=src/app/not-found.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="text-xl">Page not found.</p>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </div>
  );
}
```

### 5. Test the error boundary

Temporarily throw an error inside `getProjects()`:

```ts
async function getProjects() {
  throw new Error('Database connection failed');
}
```

Visit `/projects` — you should see the error UI with a "Try again" button. Remove the throw when done.

## Test it

```bash
pnpm dev
```

1. Visit `/projects` — see the skeleton loading state for ~1.5s, then the real content.
2. Add `throw new Error('...')` in `getProjects` → see the error boundary with the "Try again" button.
3. Visit `/nonexistent-route` → see the 404 page.
4. Remove the artificial delay and the throw before moving on.

## Mini-task
Add a `src/app/about/loading.tsx` that shows two skeleton lines matching the prose layout (two `<Skeleton>` blocks of different widths).

## Glossary
- **`loading.tsx`** — Next.js special file; wraps the page in a React `<Suspense>` boundary automatically.
- **`error.tsx`** — Next.js special file; wraps the page in a React Error Boundary; must be `'use client'`.
- **`not-found.tsx`** — Rendered when `notFound()` is called; a Server Component.
- **`digest`** — opaque error ID attached by Next.js; correlate with server logs without leaking stack traces to the browser.
- **Skeleton** — placeholder UI matching the shape of real content; reduces perceived load time.

## Resources
- [Next.js — Loading UI and Streaming](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)
- [Next.js — Error Handling](https://nextjs.org/docs/app/building-your-application/routing/error-handling)
- [Next.js — not-found.tsx](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)

## Checklist
- [ ] `src/app/loading.tsx` renders a spinner for any page
- [ ] `src/app/projects/loading.tsx` renders skeleton cards
- [ ] `src/app/projects/error.tsx` is `'use client'`, shows error message + "Try again" button
- [ ] `src/app/not-found.tsx` shows 404 with a home link
- [ ] Artificial delay removed from `getProjects` before moving on
- [ ] `pnpm build` passes
