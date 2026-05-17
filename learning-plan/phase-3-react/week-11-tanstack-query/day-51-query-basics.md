# Day 51 — TanStack Query basics

## Goal
Replace manual `useEffect + fetch` with TanStack Query's `useQuery`, understand stale-while-revalidate caching, and appreciate what you get for free.

## Estimated time
~1.5 hours

## Prerequisites
Day 50 — loading/error states with manual fetch. Day 44 — understanding why `useEffect + fetch` is painful.

## Where to put your code
In `my-web`.

## Explanation

**TanStack Query** (formerly React Query) is a server-state management library. It owns the cache of data fetched from your API and handles: deduplication (two components requesting the same data share one fetch), caching, background refetch, stale-while-revalidate, loading/error/success states, and pagination.

The **stale-while-revalidate** strategy means: serve cached data immediately (fast UX), then quietly refetch in the background and update if the data changed. The user sees something instantly; the data stays fresh. Laravel has no direct analog, but think of it as returning a cached `Cache::remember(...)` response and then dispatching a background job to refresh the cache.

Your three manual `useState` calls (`data`, `loading`, `error`) from Day 44 collapse into a single `useQuery` call. TanStack Query manages all three states, plus `isFetching` (background refetch), `isStale`, `dataUpdatedAt`, and more.

`QueryClient` is the cache. One instance is created at the root and provided to the tree via `QueryClientProvider`. All `useQuery` calls in any component share this single cache.

## Step-by-step

### 1. Install

```bash
npm install @tanstack/react-query
npm install -D @tanstack/react-query-devtools
```

### 2. Set up `QueryClient` at the root

```tsx name=src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // data considered fresh for 1 minute
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>
);
```

`ReactQueryDevtools` adds a floating inspector in development — open it to see cache entries, query states, and refetch activity. Remove or tree-shake for production builds.

### 3. Query keys

A **query key** is an array that uniquely identifies a piece of server data. TanStack Query uses it as the cache key and to know when to refetch.

```ts name=src/api/query-keys.ts
export const taskKeys = {
  all: ['tasks'] as const,
  list: () => [...taskKeys.all, 'list'] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
};
```

This factory pattern (from the TanStack Query docs) makes key management predictable and allows targeted invalidation.

### 4. Replace `useEffect` with `useQuery` in `TasksPage`

```tsx name=src/pages/TasksPage.tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchTasks } from '@/api/tasks';
import { taskKeys } from '@/api/query-keys';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

export function TasksPage() {
  const { data: tasks, isLoading, isError, error, refetch } = useQuery({
    queryKey: taskKeys.list(),
    queryFn: fetchTasks,
  });

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorMessage message={(error as Error).message} onRetry={refetch} />;

  return (
    <div>
      <h2>Tasks ({tasks?.length ?? 0})</h2>
      <ul>
        {tasks?.map((task) => (
          <li key={task.id}>
            <Link to={`/tasks/${task.id}`}>{task.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

The entire `useEffect` + three `useState` calls + the cleanup cancelled-flag pattern from Day 44 is gone. `useQuery` handles all of it.

### 5. Fetch a single task by id with `useQuery`

```tsx name=src/pages/TaskDetailPage.tsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchTask } from '@/api/tasks';
import { taskKeys } from '@/api/query-keys';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: task, isLoading, isError, error } = useQuery({
    queryKey: taskKeys.detail(id!),
    queryFn: () => fetchTask(id!),
    enabled: Boolean(id),
  });

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorMessage message={(error as Error).message} />;
  if (!task) return null;

  return (
    <div>
      <h2>{task.title}</h2>
      <p>Priority: {task.priority} | Done: {task.done ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

Add `fetchTask` to the API client:

```ts name=src/api/tasks.ts
export async function fetchTask(id: string): Promise<Task> {
  const res = await fetch(`${BASE}/tasks/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Task>;
}
```

`enabled: Boolean(id)` prevents the query from running when `id` is undefined (e.g., during first render before params are resolved).

### 6. What you get for free

- **Deduplication**: if `TasksPage` and a widget both call `useQuery({ queryKey: taskKeys.list(), queryFn: fetchTasks })`, only one fetch happens.
- **Background refetch**: when the browser tab regains focus, stale queries silently refetch.
- **Cache**: navigate away and back — data appears instantly from cache while a refetch runs.
- **`staleTime`**: during the "fresh" window, no refetch happens at all — fully cached.

## Test it

```bash
npm run dev
```

1. Open DevTools → React Query tab (bottom-right).
2. Navigate to `/tasks` — see "tasks list" entry appear as `success`.
3. Navigate away and back — data is instant (from cache).
4. Wait 1 minute — query becomes stale; focus the tab — background refetch fires.

## Mini-task
Add `refetchInterval: 30000` to `useQuery` options so tasks auto-refresh every 30 seconds. Observe the refetch in DevTools.

## Glossary
- **`useQuery`** — hook subscribing to a cached async value; manages loading/error/success.
- **Query key** — array uniquely identifying a cache entry; also used for invalidation.
- **`staleTime`** — duration after which cached data is considered stale and eligible for refetch.
- **Stale-while-revalidate** — serve stale cache immediately, refetch in background, update when done.
- **`QueryClient`** — singleton cache; shared across the component tree via `QueryClientProvider`.

## Resources
- [TanStack Query docs](https://tanstack.query.gg/docs/framework/react/overview)
- [TanStack Query — Query Keys](https://tanstack.query.gg/docs/framework/react/guides/query-keys)
- [TanStack Query — caching](https://tanstack.query.gg/docs/framework/react/guides/caching)

## Checklist
- [ ] `@tanstack/react-query` installed + `QueryClientProvider` at root
- [ ] `ReactQueryDevtools` visible in dev mode
- [ ] `taskKeys` factory defined
- [ ] `TasksPage` uses `useQuery` (no manual useState/useEffect)
- [ ] `TaskDetailPage` fetches single task with `enabled` guard
- [ ] Background refetch on tab focus observable in DevTools
