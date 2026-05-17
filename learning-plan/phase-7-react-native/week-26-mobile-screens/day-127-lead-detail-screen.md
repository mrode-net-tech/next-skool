# Day 127 — Lead detail screen

## Goal
Build the lead detail screen: full conversation thread, lead score with intent, status update controls, and a link to draft a reply. After this day the portfolio owner can read and act on any lead from their phone.

## Estimated time
~2 hours

## Prerequisites
Day 126 (Conversations list screen). Day 123 (`conversations.byId` and `updateKanbanStatus` tRPC procedures).

## Where to put your code
In `ai-folio-mobile`.

## Explanation

**Mutations with optimistic updates** in tRPC/TanStack Query: when the user changes a lead's Kanban status, you update the UI immediately (optimistic) and fire the mutation in the background. If the mutation fails, TanStack Query reverts the cache to the previous state. The user perceives instant feedback with no spinner. This is the same `useMutation` + `onMutate` pattern from Day 53 in Phase 3 — applied to React Native.

**Message thread rendering** in React Native uses `FlatList` with `inverted` — the list starts at the bottom (newest messages first, as in a chat app). Combined with `contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}`, the thread appears at the bottom of the screen like iMessage.

## Step-by-step

### 1. Create a status picker component

```tsx name=src/components/StatusPicker.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';

const STATUSES = ['new', 'reviewing', 'replied', 'archived'] as const;
type Status = (typeof STATUSES)[number];

const STATUS_COLOURS: Record<Status, string> = {
  new: '#3b82f6',
  reviewing: '#f59e0b',
  replied: '#22c55e',
  archived: '#6b7280',
};

interface StatusPickerProps {
  current: Status;
  onChange: (status: Status) => void;
  loading?: boolean;
}

export function StatusPicker({ current, onChange, loading }: StatusPickerProps) {
  return (
    <View style={styles.row}>
      {STATUSES.map((s) => (
        <Pressable
          key={s}
          style={[
            styles.pill,
            { borderColor: STATUS_COLOURS[s] },
            current === s && { backgroundColor: STATUS_COLOURS[s] },
          ]}
          onPress={() => onChange(s)}
          disabled={loading || current === s}
        >
          <Text style={[styles.pillText, current === s && styles.pillTextActive]}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, backgroundColor: 'transparent',
  },
  pillText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  pillTextActive: { color: '#fff' },
});
```

### 2. Build the lead detail screen

```tsx name=app/(admin)/leads/[id].tsx
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Link } from 'expo-router';
import { trpc } from '../../../src/lib/trpc';
import { StatusPicker } from '../../../src/components/StatusPicker';
import { INTENT_LABELS, INTENT_COLOURS, formatRelativeDate } from '../../../src/lib/formatting';
import { Ionicons } from '@expo/vector-icons';

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.conversations.byId.useQuery({ id });

  const updateStatus = trpc.conversations.updateKanbanStatus.useMutation({
    onMutate: async ({ status }) => {
      // Optimistic update
      await utils.conversations.byId.cancel({ id });
      const prev = utils.conversations.byId.getData({ id });
      utils.conversations.byId.setData({ id }, (old) =>
        old ? { ...old, kanbanStatus: status } : old
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      // Revert on failure
      utils.conversations.byId.setData({ id }, ctx?.prev);
      Alert.alert('Error', 'Failed to update status');
    },
    onSettled: () => {
      utils.conversations.byId.invalidate({ id });
      utils.conversations.list.invalidate();
    },
  });

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (error || !data) {
    return <View style={styles.center}><Text style={styles.errorText}>Lead not found</Text></View>;
  }

  const intentColour = INTENT_COLOURS[data.intent ?? ''] ?? '#6b7280';

  return (
    <View style={styles.screen}>
      {/* Header info */}
      <View style={styles.header}>
        <View style={[styles.intentBadge, { backgroundColor: intentColour + '20' }]}>
          <Text style={[styles.intentText, { color: intentColour }]}>
            {INTENT_LABELS[data.intent ?? ''] ?? 'Unknown'}
          </Text>
        </View>
        <View style={styles.scoreRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Text key={i} style={{ color: i < (data.leadScore ?? 0) ? '#f59e0b' : '#e5e7eb', fontSize: 18 }}>★</Text>
          ))}
        </View>
        <Text style={styles.date}>{formatRelativeDate(data.createdAt)}</Text>
      </View>

      {/* AI summary */}
      {data.summary && (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>AI Summary</Text>
          <Text style={styles.summaryText}>{data.summary}</Text>
        </View>
      )}

      {/* Status picker */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Status</Text>
        <StatusPicker
          current={(data.kanbanStatus as any) ?? 'new'}
          onChange={(status) => updateStatus.mutate({ id, status })}
          loading={updateStatus.isPending}
        />
      </View>

      {/* Message thread */}
      <Text style={[styles.sectionLabel, { paddingHorizontal: 16, marginBottom: 4 }]}>
        Conversation ({data.messages.length} messages)
      </Text>
      <FlatList
        data={[...data.messages].reverse()}
        keyExtractor={(m) => m.id}
        inverted
        contentContainerStyle={styles.messages}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={styles.roleLabel}>{item.role === 'user' ? 'Visitor' : 'Claude'}</Text>
            <Text style={styles.messageText}>{item.content}</Text>
          </View>
        )}
      />

      {/* Draft reply button */}
      <View style={styles.actions}>
        <Link href={`/(admin)/reply/${id}`} asChild>
          <Pressable style={styles.replyButton}>
            <Ionicons name="create-outline" size={20} color="#fff" />
            <Text style={styles.replyButtonText}>Draft AI Reply</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#ef4444', fontSize: 16 },
  header: { padding: 16, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  intentBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  intentText: { fontSize: 13, fontWeight: '600' },
  scoreRow: { flexDirection: 'row' },
  date: { fontSize: 13, color: '#6b7280', marginLeft: 'auto' },
  summaryBox: { margin: 16, padding: 14, backgroundColor: '#eff6ff', borderRadius: 10 },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase', marginBottom: 4 },
  summaryText: { fontSize: 14, color: '#1e3a8a', lineHeight: 20 },
  section: { padding: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  messages: { padding: 16, paddingTop: 4 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 12, marginBottom: 8 },
  userBubble: { backgroundColor: '#fff', alignSelf: 'flex-end', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  aiBubble: { backgroundColor: '#e0f2fe', alignSelf: 'flex-start' },
  roleLabel: { fontSize: 10, fontWeight: '600', color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' },
  messageText: { fontSize: 14, lineHeight: 20, color: '#111827' },
  actions: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  replyButton: { backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 10, gap: 8 },
  replyButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

## Test it

Navigate to a lead from the Conversations screen. Verify:
1. Intent badge, star score, date all show correctly
2. AI summary box appears if `summary` is set
3. Status pills show current status highlighted; tapping another updates it instantly (optimistic)
4. Force an error (disconnect from backend mid-mutation) — status reverts to previous value
5. Message thread renders with visitor messages right-aligned, Claude messages left-aligned
6. "Draft AI Reply" button is visible at the bottom

## Mini-task
Add a share button in the screen header (`options={{ headerRight }}` in the root layout) that uses `expo-sharing` or React Native's `Share.share()` to share the conversation summary as text. Format it as: `Lead from [intent] (score [X]/5): [summary]`.

## Glossary
- **Optimistic update** — updating the UI before the server confirms the mutation; reverted on error.
- **`trpc.useUtils()`** — tRPC hook that returns cache manipulation utilities (`setData`, `invalidate`, `cancel`).
- **`inverted`** — `FlatList` prop that flips the list upside down; combined with reversed data, creates a bottom-anchored chat view.
- **`onMutate`** — `useMutation` callback that runs before the mutation fires; used to snapshot and apply optimistic state.
- **`onSettled`** — `useMutation` callback that runs after the mutation completes (success or error); used to re-sync the cache.

## Resources
- [tRPC — optimistic updates](https://trpc.io/docs/client/react-query/useUtils#optimistic-updates)
- [React Native — Share API](https://reactnative.dev/docs/share)
- [TanStack Query — optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)

## Checklist
- [ ] Lead detail screen fetches via `trpc.conversations.byId.useQuery`
- [ ] Intent badge and star score render with correct colours
- [ ] AI summary box displays when `summary` is set on the conversation
- [ ] `StatusPicker` updates Kanban status with optimistic UI and revert on error
- [ ] Message thread renders in inverted FlatList (newest at top, oldest at bottom)
- [ ] User and Claude messages styled distinctly
- [ ] "Draft AI Reply" button navigates to reply screen placeholder
