# Day 54 — Pagination

## Goal
Add cursor-based pagination to the tasks API and implement paginated fetching with TanStack Query's `useInfiniteQuery` and a "Load more" button.

## Estimated time
~2 hours

## Prerequisites
Day 53 — optimistic updates. Day 19 — Prisma query basics.

## Where to put your code
Both `my-api` (API changes) and `my-web` (UI).

## Explanation

**Cursor-based pagination** uses an opaque cursor (typically the last row's `id` or `createdAt`) to fetch the next page. Unlike offset pagination (`page=2&size=10`), cursors stay stable when rows are inserted or deleted — you don't get duplicate or skipped rows. Prisma supports cursor pagination natively via `cursor` + `skip: 1`.

**`useInfiniteQuery`** is TanStack Query's hook for paginated or infinite-scroll data. It stores all pages in the cache as an array, provides `fetchNextPage()` to load more, and `hasNextPage` to know when to stop.

The Laravel analogy: `useInfiniteQuery` is like Eloquent's cursor pagination (`$items->nextCursor()`), but managed by the client cache instead of a server endpoint.

## Step-by-step

### 1. Add pagination to `GET /tasks` in `my-api`

```ts name=src/tasks/routes.ts
// GET /tasks?cursor=<id>&limit=10
tasksRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query['limit'] ?? 10), 50);
  const cursor = req.query['cursor'] as string | undefined;

  const tasks = await prisma.task.findMany({
    take: limit + 1, // fetch one extra to know if there's a next page
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  });

  const hasNextPage = tasks.length > limit;
  const items = hasNextPage ? tasks.slice(0, limit) : tasks;
  const nextCursor = hasNextPage ? items[items.length - 1]?.id : undefined;

  res.json({ items, nextCursor: nextCursor ?? null });
});
```

The `take: limit + 1` trick: fetch one more than needed. If we get `limit + 1` back, there's a next page. Slice it off before responding.

### 2. Update the API client for paginated response

```ts name=src/api/tasks.ts
import type { Task } from '@/types/task';

const BASE = 'http://localhost:3000';

export interface TaskPage {
  items: Task[];
  nextCursor: string | null;
}

export async function fetchTasksPage({ pageParam }: { pageParam: string | null }): Promise<TaskPage> {
  const url = new URL(`${BASE}/tasks`);
  url.searchParams.set('limit', '10');
  if (pageParam) url.searchParams.set('cursor', pageParam);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<TaskPage>;
}
```

### 3. Use `useInfiniteQuery` in `TasksPage`

```tsx name=src/pages/TasksPage.tsx
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchTasksPage } from '@/api/tasks';
import { taskKeys } from '@/api/query-keys';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

export function TasksPage() {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: taskKeys.list(),
    queryFn: fetchTasksPage,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorMessage message={(error as Error).message} />;

  // Flatten all pages into one array
  const tasks = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div>
      <h2>Tasks ({tasks.length})</h2>
      <ul>
        {tasks.map((task) => (
          <li key={task.id} style={{ opacity: task.done ? 0.5 : 1 }}>
            <Link to={`/tasks/${task.id}`}>{task.title}</Link>
          </li>
        ))}
      </ul>

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}

      {!hasNextPage && tasks.length > 0 && (
        <p style={{ color: '#94a3b8' }}>All tasks loaded.</p>
      )}
    </div>
  );
}
```

`getNextPageParam` receives the last page and returns the cursor for the next page. Return `undefined` (or `null`) to signal no more pages.

### 4. Update query key factory

The paginated endpoint replaces the non-paginated one:

```ts name=src/api/query-keys.ts
export const taskKeys = {
  all: ['tasks'] as const,
  list: () => [...taskKeys.all, 'list'] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
};
```

The keys remain the same — `useInfiniteQuery` and `useQuery` share the same key namespace, but keep in mind they're not interchangeable: a key used with `useInfiniteQuery` stores pages, not a flat array. Don't mix the two hooks for the same key.

### 5. Prefetch next page

TanStack Query can prefetch the next page while the user reads the current one:

```ts
// After fetchNextPage resolves, prefetch the page after
queryClient.prefetchInfiniteQuery({ queryKey: taskKeys.list(), ... });
```

For "Load more" UX, you can trigger prefetch when the user is near the bottom of the list (intersection observer pattern). That's beyond today's scope — mention it in DevTools by watching the network tab while clicking "Load more".

## Test it

```bash
# Seed some tasks
curl -X POST http://localhost:3000/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Task 1","priority":2}'
```

Repeat for 15+ tasks to have enough to paginate. Then open the app:

1. `/tasks` loads 10 tasks.
2. "Load more" button appears.
3. Click it — 5 more load (appended below).
4. "All tasks loaded." message appears.

## Mini-task
Add page size control — a `<select>` with options 5 / 10 / 20. Changing it should reset pagination and refetch with the new limit. (Hint: include `limit` in the query key so changing it invalidates the cache.)

## Glossary
- **Cursor pagination** — uses last row's id/timestamp as next-page cursor; stable across inserts/deletes.
- **`useInfiniteQuery`** — TanStack Query hook for paginated data; accumulates pages in cache.
- **`getNextPageParam`** — function returning the cursor/page param for the next fetch; return `undefined` for last page.
- **`fetchNextPage`** — function to trigger fetching the next page.
- **`isFetchingNextPage`** — boolean true while a `fetchNextPage` call is in flight.

## Resources
- [TanStack Query — Infinite Queries](https://tanstack.query.gg/docs/framework/react/guides/infinite-queries)
- [Prisma — Cursor-based pagination](https://www.prisma.io/docs/orm/prisma-client/queries/pagination#cursor-based-pagination)

## Checklist
- [ ] `GET /tasks` accepts `cursor` + `limit` query params
- [ ] API returns `{ items, nextCursor }` shape
- [ ] `useInfiniteQuery` fetches first page on mount
- [ ] "Load more" button fetches next page and appends items
- [ ] "All tasks loaded." appears when `hasNextPage` is false
- [ ] `isFetchingNextPage` disables the button while loading
