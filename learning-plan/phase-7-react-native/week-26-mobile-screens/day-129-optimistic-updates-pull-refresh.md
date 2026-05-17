# Day 129 — Optimistic updates + pull-to-refresh patterns

## Goal
Apply consistent optimistic update and refresh patterns across all screens. After this day the mobile app feels instant — status changes apply immediately, lists refresh on pull, and stale data is managed with a clear strategy.

## Estimated time
~1.5 hours

## Prerequisites
Day 128 (Kanban screen). Day 127 (lead detail with basic optimistic update).

## Where to put your code
In `ai-folio-mobile`.

## Explanation

**Why optimistic updates matter on mobile:** mobile networks are slow and unreliable. Without optimistic updates, every status change shows a spinner while waiting for a round trip to Fly.io (100–300ms on good WiFi, 500ms+ on mobile data). With optimistic updates, the UI responds in under 16ms — then confirms or reverts silently. On mobile, perceived performance is actual performance.

**The three-callback pattern** for TanStack Query mutations:
1. `onMutate` — snapshot + apply optimistic state
2. `onError` — revert to snapshot
3. `onSettled` — invalidate to sync with server truth

This is the same pattern from Day 127 but you will now extract it into a reusable hook so every screen uses it consistently.

**Pull-to-refresh** in React Native: `FlatList` has `onRefresh` and `refreshing` props that render the native pull-to-refresh spinner. The correct implementation calls `refetch()` from TanStack Query and sets `refreshing` to `isFetching`. Do not use a separate `useState(false)` for `refreshing` — use the query's `isFetching` flag to avoid state synchronisation bugs.

## Step-by-step

### 1. Extract a reusable status update hook

```ts name=src/hooks/useUpdateStatus.ts
import { trpc } from '../lib/trpc';

export function useUpdateStatus() {
  const utils = trpc.useUtils();

  return trpc.conversations.updateKanbanStatus.useMutation({
    onMutate: async ({ id, status }) => {
      // Cancel any in-flight queries for this conversation
      await Promise.all([
        utils.conversations.byId.cancel({ id }),
        utils.conversations.byStatus.cancel(),
        utils.conversations.list.cancel(),
      ]);

      // Snapshot
      const prevById = utils.conversations.byId.getData({ id });
      const prevByStatus = utils.conversations.byStatus.getData();

      // Apply optimistic state
      utils.conversations.byId.setData({ id }, (old) =>
        old ? { ...old, kanbanStatus: status } : old
      );
      utils.conversations.byStatus.setData(undefined, (old) => {
        if (!old) return old;
        const updated = { ...old };
        // Remove from current column
        for (const col of Object.keys(updated) as Array<keyof typeof updated>) {
          (updated[col] as any[]) = (updated[col] as any[]).filter((c: { id: string }) => c.id !== id);
        }
        // Add to new column (find the card in the snapshot)
        const card = Object.values(prevByStatus ?? {})
          .flat()
          .find((c: { id: string }) => c.id === id);
        if (card) {
          (updated[status] as any[]) = [{ ...card, kanbanStatus: status }, ...(updated[status] as any[])];
        }
        return updated;
      });

      return { prevById, prevByStatus };
    },

    onError: (_err, { id }, ctx) => {
      if (ctx?.prevById) utils.conversations.byId.setData({ id }, ctx.prevById);
      if (ctx?.prevByStatus) utils.conversations.byStatus.setData(undefined, ctx.prevByStatus);
    },

    onSettled: (_data, _err, { id }) => {
      utils.conversations.byId.invalidate({ id });
      utils.conversations.byStatus.invalidate();
      utils.conversations.list.invalidate();
    },
  });
}
```

Update the Kanban screen and Lead detail screen to use this hook instead of inline `useMutation`.

### 2. Standardise pull-to-refresh across screens

Create a wrapper that enforces the correct pattern:

```ts name=src/hooks/useRefreshControl.ts
import { useState, useCallback } from 'react';

export function useRefreshControl(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return { refreshing, onRefresh };
}
```

Usage in Conversations screen:

```tsx
const { data, refetch } = trpc.conversations.list.useInfiniteQuery({ limit: 20 });
const { refreshing, onRefresh } = useRefreshControl(refetch);

<FlatList
  onRefresh={onRefresh}
  refreshing={refreshing}
  // ...
/>
```

### 3. Add focus-based refetch

When the user switches from another app and returns to the Conversations screen, the data may be stale. TanStack Query's `refetchOnWindowFocus` applies on web but not React Native. Use Expo Router's `useFocusEffect` instead:

```tsx name=app/(admin)/conversations.tsx
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

// Inside ConversationsScreen:
const { data, refetch, isLoading } = trpc.conversations.list.useInfiniteQuery(
  { limit: 20 },
  { staleTime: 60_000 }   // consider fresh for 60 seconds
);

useFocusEffect(
  useCallback(() => {
    refetch();
  }, [refetch])
);
```

This refetches when the screen gains focus — equivalent to `refetchOnWindowFocus` on web.

### 4. Add a global error handler

When a tRPC mutation fails and the optimistic revert happens, show a toast. Install a toast library:

```bash
npx expo install react-native-toast-message
```

```tsx name=app/_layout.tsx
import Toast from 'react-native-toast-message';

export default function RootLayout() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {/* ... existing providers */}
        <Toast />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

Update `useUpdateStatus.ts` to show a toast on error:

```ts
import Toast from 'react-native-toast-message';

onError: (_err, { id }, ctx) => {
  // revert...
  Toast.show({ type: 'error', text1: 'Update failed', text2: 'Status reverted' });
},
```

### 5. Tune stale time per screen

Different screens have different freshness requirements:

```ts
// Conversations list — refetch on focus; 60s stale
trpc.conversations.list.useInfiniteQuery({ limit: 20 }, { staleTime: 60_000 });

// Lead detail — refetch on focus; 30s stale (status changes happen here)
trpc.conversations.byId.useQuery({ id }, { staleTime: 30_000 });

// Kanban — refetch on focus; 30s stale (cards move between columns)
trpc.conversations.byStatus.useQuery(undefined, { staleTime: 30_000 });
```

## Test it

1. Change a lead's status on the **web** admin dashboard
2. Pull to refresh on the mobile Conversations screen — the new status appears
3. Long-press a Kanban card and move it — the card jumps to the new column instantly (before the server responds)
4. Disable your WiFi mid-mutation — the optimistic update reverts and a toast appears

## Mini-task
Add a "last refreshed" timestamp below the filter chips on the Conversations screen. Store `Date.now()` in a `useState` that updates in `onRefresh`. Display it as "Updated just now" / "Updated 2 min ago" using `formatRelativeDate`.

## Glossary
- **`useFocusEffect`** — Expo Router hook that runs an effect when the screen gains focus; the React Native equivalent of `refetchOnWindowFocus`.
- **`staleTime`** — TanStack Query option; queries older than this value are refetched on the next `useQuery` mount or focus event.
- **Snapshot** — a copy of the cache state saved before the optimistic update; restored by `onError` if the mutation fails.
- **`cancel`** — cancels in-flight queries for a given key; prevents race conditions where the server response overwrites the optimistic state.

## Resources
- [TanStack Query — optimistic updates guide](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [expo-router — useFocusEffect](https://docs.expo.dev/router/reference/hooks/#usefocuseffect)
- [react-native-toast-message](https://github.com/calintamas/react-native-toast-message)

## Checklist
- [ ] `useUpdateStatus` hook extracted; used by both Kanban and Lead detail screens
- [ ] Optimistic update applies across `byId`, `byStatus`, and `list` caches simultaneously
- [ ] `useRefreshControl` hook used on all FlatList screens
- [ ] `useFocusEffect` triggers refetch when screen gains focus
- [ ] Toast appears when a mutation fails and optimistic state reverts
- [ ] `staleTime` tuned per screen based on data freshness requirements
