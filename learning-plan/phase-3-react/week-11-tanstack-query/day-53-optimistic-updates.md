# Day 53 — Optimistic updates

## Goal
Implement optimistic UI for the toggle-done action: update the cache before the server responds, and roll back if the request fails.

## Estimated time
~1.5 hours

## Prerequisites
Day 52 — `useMutation` + `invalidateQueries`.

## Where to put your code
In `my-web`.

## Explanation

**Optimistic updates** assume a mutation will succeed and update the UI immediately — before the server responds. If the server returns an error, you roll back to the previous state. The UX benefit: the UI feels instant. The cost: extra rollback logic.

For a `toggleDone` action, the sequence is:
1. User clicks checkbox.
2. `onMutate`: snapshot the current cache, apply the optimistic change.
3. Mutation fires in the background.
4. **On success**: invalidate the query to get the real server state.
5. **On error**: restore the snapshot.

TanStack Query's `onMutate` / `onError` / `onSettled` callbacks are designed for exactly this pattern. `onMutate` receives the mutation variables and can return a context object that `onError` and `onSettled` receive — the standard way to pass the snapshot through.

Laravel analogy: it's like a database transaction with rollback — but at the UI cache layer, not the DB layer.

## Step-by-step

### 1. Optimistic toggle hook

```ts name=src/api/task.mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTask, deleteTask, createTask } from '@/api/tasks';
import { taskKeys } from '@/api/query-keys';
import type { Task } from '@/types/task';
import type { CreateTaskInput } from '@/schemas/task.schema';

interface ToggleVariables {
  id: string;
  done: boolean;
}

interface MutationContext {
  previousTasks: Task[] | undefined;
}

export function useToggleTask() {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, ToggleVariables, MutationContext>({
    mutationFn: ({ id, done }) => updateTask(id, { done }),

    onMutate: async ({ id, done }) => {
      // Cancel any in-flight refetches that would overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: taskKeys.list() });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.list());

      // Optimistically update the cache
      queryClient.setQueryData<Task[]>(taskKeys.list(), (old) =>
        old?.map((t) => (t.id === id ? { ...t, done } : t)) ?? []
      );

      // Return the snapshot as context
      return { previousTasks };
    },

    onError: (_err, _variables, context) => {
      // Roll back to the snapshot
      if (context?.previousTasks !== undefined) {
        queryClient.setQueryData(taskKeys.list(), context.previousTasks);
      }
    },

    onSettled: () => {
      // Always refetch after error or success to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: taskKeys.list() });
    },
  });
}

// Keep the other mutations from Day 52
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
```

### 2. Understand the lifecycle

```
click checkbox
  → onMutate fires
      cancelQueries (stop in-flight fetches)
      getQueryData  (snapshot)
      setQueryData  (optimistic update → UI updates immediately)
      return { previousTasks }

  → mutationFn fires (network request)

  if success:
    onSettled → invalidateQueries → background refetch

  if error:
    onError → setQueryData(previousTasks) → UI reverts
    onSettled → invalidateQueries → background refetch
```

`onSettled` always runs (after either `onSuccess` or `onError`). Invalidating in `onSettled` ensures the cache eventually reflects server truth regardless of outcome.

### 3. Simulate a failure to verify rollback

To test the rollback path, temporarily break `updateTask`:

```ts name=src/api/tasks.ts
export async function updateTask(id: string, patch: object): Promise<Task> {
  // Force failure for testing
  throw new Error('Simulated server error');
}
```

Click a checkbox — it toggles immediately (optimistic), then ~instantly reverts (rollback). Restore the real implementation after verifying.

### 4. Optimistic delete

Optimistic delete uses the same pattern — remove the item immediately, restore on error:

```ts
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, { previousTasks: Task[] | undefined }>({
    mutationFn: (id) => deleteTask(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.list() });
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.list());
      queryClient.setQueryData<Task[]>(taskKeys.list(), (old) =>
        old?.filter((t) => t.id !== id) ?? []
      );
      return { previousTasks };
    },

    onError: (_err, _id, context) => {
      if (context?.previousTasks !== undefined) {
        queryClient.setQueryData(taskKeys.list(), context.previousTasks);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.list() });
    },
  });
}
```

### 5. When NOT to use optimistic updates

- Operations with side effects visible to other users (e.g., sending an email — if it fails the email already went out conceptually).
- When the server might modify the returned data significantly (computed fields, server-generated values like `id`).
- For creates — the server returns the new `id`, so you can't fully optimistically insert the item without a temporary id.

## Test it

1. Click a checkbox — done state updates immediately, no loading flicker.
2. Check DevTools — see `setQueryData` fire before the network request completes.
3. Temporarily break the API to force `onError` — checkbox should revert.

## Mini-task
Implement optimistic delete in `useDeleteTask`. Verify by deleting a task: it disappears immediately, then after `onSettled` the list refetches from the server.

## Glossary
- **Optimistic update** — updating UI before server confirms; roll back on error.
- **`onMutate`** — runs before the mutation fn; used to snapshot + apply optimistic change.
- **`onError`** — runs if mutation fn throws; receives context returned by `onMutate`.
- **`onSettled`** — runs after either success or error; good place for invalidation.
- **`cancelQueries`** — aborts in-flight queries that would overwrite the optimistic state.

## Resources
- [TanStack Query — Optimistic Updates](https://tanstack.query.gg/docs/framework/react/guides/optimistic-updates)
- [TanStack Query — `setQueryData`](https://tanstack.query.gg/docs/reference/QueryClient#queryclientsetquerydata)

## Checklist
- [ ] `useToggleTask` implements full onMutate/onError/onSettled lifecycle
- [ ] Checkbox updates immediately without waiting for server
- [ ] Broken API causes UI to revert to original state
- [ ] `cancelQueries` called before applying optimistic change
- [ ] `onSettled` invalidates to ensure eventual consistency
- [ ] Mini-task optimistic delete implemented
