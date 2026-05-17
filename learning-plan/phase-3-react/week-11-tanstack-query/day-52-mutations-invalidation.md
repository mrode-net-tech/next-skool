# Day 52 — Mutations + cache invalidation

## Goal
Use `useMutation` to create, update, and delete tasks, invalidate the cache after mutations so the list stays fresh, and understand the difference between `invalidateQueries` and direct cache updates.

## Estimated time
~1.5 hours

## Prerequisites
Day 51 — `useQuery` for task list + detail.

## Where to put your code
In `my-web`.

## Explanation

**`useMutation`** is TanStack Query's hook for write operations (POST / PATCH / DELETE). Unlike `useQuery` (runs automatically), a mutation runs on demand — you call `mutate()` or `mutateAsync()`. It gives you `isPending`, `isError`, `isSuccess` states for the mutation itself.

After a successful mutation the cache is stale — the list or detail cached under `taskKeys.list()` no longer reflects reality. **`invalidateQueries`** marks those entries stale and triggers a background refetch. This is the "nuclear" approach: throw away the old data, fetch fresh. It's always correct but costs one extra request.

**Direct cache update** (via `queryClient.setQueryData`) surgically updates the cache without a refetch. It's faster (no network round-trip) but optimistic — you trust that your local update matches what the server would return. Day 53 covers this pattern more deeply (optimistic updates). Today you'll use `invalidateQueries` which is simpler and always correct.

The Laravel analogy: `invalidateQueries` is like calling `Cache::forget('tasks')` after updating the database — the next request fetches fresh data. `setQueryData` is like patching the cached array in memory — faster but requires you to get the transformation right.

## Step-by-step

### 1. Mutation hooks file

```ts name=src/api/task.mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTask, updateTask, deleteTask } from '@/api/tasks';
import { taskKeys } from '@/api/query-keys';
import type { CreateTaskInput } from '@/schemas/task.schema';

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input.title, input.priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.list() });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.list() });
    },
  });
}

export function useToggleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      updateTask(id, { done }),
    onSuccess: (_data, { id }) => {
      // Invalidate both list and detail
      queryClient.invalidateQueries({ queryKey: taskKeys.list() });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
    },
  });
}
```

Add `updateTask` to the API client:

```ts name=src/api/tasks.ts
export async function updateTask(id: string, patch: { done?: boolean; title?: string; priority?: number }): Promise<Task> {
  const res = await fetch(`${BASE}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Task>;
}
```

Ensure `my-api` has a `PATCH /tasks/:id` endpoint (added on Day 16).

### 2. Use mutations in `TasksPage`

```tsx name=src/pages/TasksPage.tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchTasks } from '@/api/tasks';
import { taskKeys } from '@/api/query-keys';
import { useCreateTask, useDeleteTask, useToggleTask } from '@/api/task.mutations';
import { AddTaskForm } from '@/components/AddTaskForm';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

export function TasksPage() {
  const { data: tasks, isLoading, isError, error } = useQuery({
    queryKey: taskKeys.list(),
    queryFn: fetchTasks,
  });

  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();
  const toggleTask = useToggleTask();

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorMessage message={(error as Error).message} />;

  return (
    <div>
      <h2>Tasks</h2>
      <AddTaskForm
        onAdd={(title) => createTask.mutateAsync({ title, priority: 2 })}
      />

      {createTask.isError && (
        <p role="alert">Failed to create task: {(createTask.error as Error).message}</p>
      )}

      <ul>
        {tasks?.map((task) => (
          <li key={task.id} style={{ opacity: task.done ? 0.5 : 1 }}>
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => toggleTask.mutate({ id: task.id, done: !task.done })}
            />
            <Link to={`/tasks/${task.id}`}>{task.title}</Link>
            <button
              onClick={() => deleteTask.mutate(task.id)}
              disabled={deleteTask.isPending}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 3. Error handling on mutations

`useMutation` does not throw by default when you call `mutate()`. Use `mutateAsync()` if you want to `await` and `catch`:

```ts
try {
  await createTask.mutateAsync({ title, priority: 2 });
} catch (err) {
  // handle
}
```

Or use `onError` in the mutation options:

```ts
useMutation({
  mutationFn: deleteTask,
  onError: (err) => {
    alert(`Delete failed: ${(err as Error).message}`);
  },
});
```

### 4. `invalidateQueries` scope

```ts
// Invalidate everything under 'tasks'
queryClient.invalidateQueries({ queryKey: taskKeys.all });

// Invalidate only the list
queryClient.invalidateQueries({ queryKey: taskKeys.list() });

// Invalidate only one detail
queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
```

Broader keys cascade — invalidating `['tasks']` also invalidates `['tasks', 'list']` and all detail entries.

## Test it

1. Add a task — it appears in the list without manual refresh.
2. Check the DevTools: see `tasks list` go from `fresh` → `stale` → re-fetched.
3. Toggle done — checkbox updates immediately (the list refetches).
4. Delete a task — it disappears after refetch.

```bash
npx tsc --noEmit
```

## Mini-task
Add `onError` to `useDeleteTask` that logs the error to the console. Simulate an error by temporarily making `deleteTask` API call to a wrong URL and verify the error logs.

## Glossary
- **`useMutation`** — hook for write operations; runs on demand via `mutate()` / `mutateAsync()`.
- **`mutate`** — fire-and-forget call; errors don't propagate to the caller.
- **`mutateAsync`** — awaitable; throws on error.
- **`invalidateQueries`** — marks cache entries stale + triggers background refetch.
- **`isPending`** — `useMutation` state: true while the mutation fn is running.

## Resources
- [TanStack Query — Mutations](https://tanstack.query.gg/docs/framework/react/guides/mutations)
- [TanStack Query — Invalidation](https://tanstack.query.gg/docs/framework/react/guides/invalidations-from-mutations)

## Checklist
- [ ] `useCreateTask`, `useDeleteTask`, `useToggleTask` hooks created
- [ ] Each mutation invalidates correct query keys on success
- [ ] `TasksPage` uses all three mutation hooks
- [ ] Delete button disabled while `isPending`
- [ ] Error state shown when `createTask.isError`
- [ ] `npx tsc --noEmit` passes
