# Day 126 — Conversations list screen

## Goal
Build a polished, production-quality Conversations screen with infinite scroll, score filtering, and empty/loading/error states. After this day the core data screen of the mobile admin is complete.

## Estimated time
~2 hours

## Prerequisites
Day 125 (JWT auth working). Day 123 (tRPC `conversations.list` procedure with cursor pagination).

## Where to put your code
In `ai-folio-mobile`.

## Explanation

**Infinite scroll with cursor pagination** is the standard pattern for mobile lists — you load the first page, and as the user scrolls near the bottom, you fetch the next page automatically. TanStack Query's `useInfiniteQuery` handles this. The tRPC `conversations.list` procedure already returns a `nextCursor` — the mobile client uses it to fetch the next page.

**React Native `FlatList`** is the high-performance list component for React Native. It virtualises rendering — only visible items are rendered, items off-screen are unmounted. For lists of 100+ conversations, `FlatList` is mandatory. The plain `ScrollView` renders everything upfront and will cause performance issues on large datasets.

**Score badges and intent chips** need to work without Tailwind. React Native styling is component-scoped — you define styles per component in `StyleSheet.create`. The pattern of mapping intent strings to colours is the same as web, but expressed as JavaScript objects.

## Step-by-step

### 1. Create score and intent helpers

```ts name=src/lib/formatting.ts
export const INTENT_LABELS: Record<string, string> = {
  job_offer: 'Job Offer',
  collab: 'Collaboration',
  question: 'Question',
  spam: 'Spam',
};

export const INTENT_COLOURS: Record<string, string> = {
  job_offer: '#22c55e',
  collab: '#3b82f6',
  question: '#f59e0b',
  spam: '#ef4444',
};

export function formatRelativeDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
```

### 2. Create a reusable LeadCard component

```tsx name=src/components/LeadCard.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { INTENT_LABELS, INTENT_COLOURS, formatRelativeDate } from '../lib/formatting';

interface LeadCardProps {
  id: string;
  intent: string | null;
  leadScore: number | null;
  preview: string;
  createdAt: Date | string;
  onPress: () => void;
}

export function LeadCard({ id, intent, leadScore, preview, createdAt, onPress }: LeadCardProps) {
  const intentColour = INTENT_COLOURS[intent ?? ''] ?? '#6b7280';
  const intentLabel = INTENT_LABELS[intent ?? ''] ?? 'Unknown';
  const score = leadScore ?? 0;

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.header}>
        <View style={[styles.intentBadge, { backgroundColor: intentColour + '20' }]}>
          <Text style={[styles.intentText, { color: intentColour }]}>{intentLabel}</Text>
        </View>
        <View style={styles.scoreRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Text key={i} style={[styles.star, { color: i < score ? '#f59e0b' : '#e5e7eb' }]}>
              ★
            </Text>
          ))}
        </View>
      </View>
      <Text style={styles.preview} numberOfLines={2}>{preview}</Text>
      <Text style={styles.date}>{formatRelativeDate(createdAt)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  cardPressed: { opacity: 0.95, transform: [{ scale: 0.99 }] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  intentBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  intentText: { fontSize: 12, fontWeight: '600' },
  scoreRow: { flexDirection: 'row', gap: 2 },
  star: { fontSize: 14 },
  preview: { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 8 },
  date: { fontSize: 12, color: '#9ca3af' },
});
```

### 3. Build the infinite scroll Conversations screen

```tsx name=app/(admin)/conversations.tsx
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  Pressable, TextInput,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { trpc } from '../../src/lib/trpc';
import { LeadCard } from '../../src/components/LeadCard';

const SCORE_FILTERS = [
  { label: 'All', value: undefined },
  { label: '4+', value: 4 },
  { label: '5 only', value: 5 },
] as const;

export default function ConversationsScreen() {
  const router = useRouter();
  const [minScore, setMinScore] = useState<number | undefined>(undefined);

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.conversations.list.useInfiniteQuery(
      { limit: 20, minScore },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        initialCursor: undefined,
      }
    );

  const conversations = data?.pages.flatMap((p) => p.conversations) ?? [];

  const renderFooter = () => {
    if (!hasNextPage) return null;
    return (
      <View style={styles.footer}>
        {isFetchingNextPage
          ? <ActivityIndicator />
          : <Pressable onPress={() => fetchNextPage()}>
              <Text style={styles.loadMore}>Load more</Text>
            </Pressable>
        }
      </View>
    );
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load leads</Text>
        <Pressable onPress={() => refetch()} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Score filter chips */}
      <View style={styles.filterRow}>
        {SCORE_FILTERS.map((f) => (
          <Pressable
            key={String(f.value)}
            style={[styles.chip, minScore === f.value && styles.chipActive]}
            onPress={() => setMinScore(f.value)}
          >
            <Text style={[styles.chipText, minScore === f.value && styles.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={refetch}
        refreshing={isLoading}
        onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No leads found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <LeadCard
            id={item.id}
            intent={item.intent}
            leadScore={item.leadScore}
            preview={item.messages[0]?.content ?? 'No messages'}
            createdAt={item.createdAt}
            onPress={() => router.push(`/(admin)/leads/${item.id}`)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 16, color: '#ef4444' },
  retryButton: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#000', borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#000' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  chipTextActive: { color: '#fff' },
  list: { padding: 16, paddingTop: 8 },
  empty: { alignItems: 'center', paddingTop: 48 },
  emptyText: { fontSize: 16, color: '#9ca3af' },
  footer: { alignItems: 'center', paddingVertical: 16 },
  loadMore: { color: '#0066cc', fontSize: 16 },
});
```

## Test it

Run the app with real backend data. Verify:

1. Conversations load from tRPC and render as cards
2. Score filter chips change the query (switching from "All" to "4+" shows fewer cards)
3. Pull-to-refresh reloads the list
4. Scroll to the bottom — if more than 20 conversations exist, the next page loads
5. Empty state shows when filter returns nothing

```bash
npx tsc --noEmit
```

No TypeScript errors — `trpc.conversations.list.useInfiniteQuery` is fully typed.

## Mini-task
Add a search bar above the filter chips. Debounce the input (250ms) and pass the search term to a new `search` input on the `conversations.list` procedure. On the backend, add a `WHERE content ILIKE '%query%'` filter via Prisma's `messages: { some: { content: { contains: query, mode: 'insensitive' } } }`.

## Glossary
- **`useInfiniteQuery`** — TanStack Query hook for paginated data; manages all pages in memory and exposes `fetchNextPage`, `hasNextPage`.
- **`getNextPageParam`** — function that extracts the cursor for the next page from the last page's response.
- **`FlatList`** — React Native virtualised list; renders only visible items; required for performance on large lists.
- **`onEndReached`** — FlatList callback fired when the user scrolls to within `onEndReachedThreshold` (0–1) fraction of the bottom.
- **`numberOfLines`** — `<Text>` prop that truncates text with an ellipsis after N lines.

## Resources
- [tRPC — infinite queries](https://trpc.io/docs/client/react-query/useInfiniteQuery)
- [React Native — FlatList](https://reactnative.dev/docs/flatlist)
- [TanStack Query — infinite queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)

## Checklist
- [ ] `LeadCard` component renders intent badge, star score, preview text, relative date
- [ ] Conversations screen uses `useInfiniteQuery` with cursor pagination
- [ ] Score filter chips update the query and re-fetch
- [ ] Pull-to-refresh works
- [ ] Infinite scroll loads next page when approaching the bottom
- [ ] Empty state and error state both render correctly
