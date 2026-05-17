# Day 128 — Kanban board screen

## Goal
Build a horizontal Kanban board in React Native with drag-to-reorder support between columns. After this day the portfolio owner can manage lead pipeline stages on their phone using the same four-column board as the web admin.

## Estimated time
~2.5 hours

## Prerequisites
Day 127 (lead detail screen). Day 123 (`conversations.list` and `updateKanbanStatus` procedures).

## Where to put your code
In `ai-folio-mobile`.

## Explanation

**Horizontal scrolling columns** in React Native use a horizontal `ScrollView` or `FlatList` for the column rail, with a vertical `FlatList` or `ScrollView` inside each column for the cards. This creates a nested scroll — horizontal for columns, vertical for cards within a column. React Native handles nested scroll directions automatically.

**Drag and drop** in React Native requires a library — the web's `draggable` attribute does not exist. `react-native-draggable-flatlist` provides a `DraggableFlatList` component with smooth animated reordering. For cross-column drag (moving a card between columns), `react-native-drag-drop-context` or a simpler tap-to-move pattern works better for mobile — dragging between columns in a horizontal scroll is awkward on small screens.

**Pragmatic mobile UX:** instead of complex cross-column drag, use a bottom sheet to pick the new column when tapping a card's status indicator. This is faster on mobile than drag (especially with fat thumbs) and maps directly to the `updateKanbanStatus` mutation you built in Day 127.

## Step-by-step

### 1. Add a kanban query to the tRPC router

```ts name=src/lib/trpc/routers/conversations.ts
// Add to conversationsRouter:
  byStatus: protectedProcedure.query(async () => {
    const all = await prisma.conversation.findMany({
      where: { kanbanStatus: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, intent: true, leadScore: true, kanbanStatus: true,
        createdAt: true,
        messages: { take: 1, orderBy: { createdAt: 'asc' }, select: { content: true } },
      },
    });

    const columns = {
      new: all.filter((c) => c.kanbanStatus === 'new'),
      reviewing: all.filter((c) => c.kanbanStatus === 'reviewing'),
      replied: all.filter((c) => c.kanbanStatus === 'replied'),
      archived: all.filter((c) => c.kanbanStatus === 'archived'),
    };

    return columns;
  }),
```

### 2. Create a Kanban column component

```tsx name=src/components/KanbanColumn.tsx
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { INTENT_COLOURS, formatRelativeDate } from '../lib/formatting';

interface KanbanCard {
  id: string;
  intent: string | null;
  leadScore: number | null;
  kanbanStatus: string | null;
  createdAt: string | Date;
  messages: { content: string }[];
}

interface KanbanColumnProps {
  title: string;
  colour: string;
  cards: KanbanCard[];
  onMoveCard: (id: string) => void;
}

export function KanbanColumn({ title, colour, cards, onMoveCard }: KanbanColumnProps) {
  const router = useRouter();

  return (
    <View style={styles.column}>
      <View style={[styles.columnHeader, { borderTopColor: colour }]}>
        <Text style={styles.columnTitle}>{title}</Text>
        <View style={[styles.countBadge, { backgroundColor: colour + '20' }]}>
          <Text style={[styles.countText, { color: colour }]}>{cards.length}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {cards.map((card) => (
          <Pressable
            key={card.id}
            style={styles.card}
            onPress={() => router.push(`/(admin)/leads/${card.id}`)}
            onLongPress={() => onMoveCard(card.id)}
            delayLongPress={500}
          >
            <View style={styles.cardTop}>
              <View style={[styles.dot, { backgroundColor: INTENT_COLOURS[card.intent ?? ''] ?? '#6b7280' }]} />
              <Text style={styles.scoreText}>{'★'.repeat(card.leadScore ?? 0)}</Text>
            </View>
            <Text style={styles.preview} numberOfLines={3}>
              {card.messages[0]?.content ?? 'No messages'}
            </Text>
            <Text style={styles.date}>{formatRelativeDate(card.createdAt)}</Text>
          </Pressable>
        ))}

        {cards.length === 0 && (
          <View style={styles.emptyColumn}>
            <Text style={styles.emptyText}>Empty</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { width: 220, marginRight: 12, backgroundColor: '#f3f4f6', borderRadius: 12, padding: 12, maxHeight: '100%' },
  columnHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderTopWidth: 3, paddingTop: 8 },
  columnTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  scoreText: { fontSize: 12, color: '#f59e0b' },
  preview: { fontSize: 13, color: '#374151', lineHeight: 18, marginBottom: 6 },
  date: { fontSize: 11, color: '#9ca3af' },
  emptyColumn: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 13, color: '#9ca3af' },
});
```

### 3. Build the Kanban screen with move bottom sheet

```tsx name=app/(admin)/kanban.tsx
import {
  View, Text, StyleSheet, ScrollView, Modal,
  Pressable, ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { trpc } from '../../src/lib/trpc';
import { KanbanColumn } from '../../src/components/KanbanColumn';

const COLUMNS = [
  { key: 'new', title: 'New', colour: '#3b82f6' },
  { key: 'reviewing', title: 'Reviewing', colour: '#f59e0b' },
  { key: 'replied', title: 'Replied', colour: '#22c55e' },
  { key: 'archived', title: 'Archived', colour: '#6b7280' },
] as const;

type Status = 'new' | 'reviewing' | 'replied' | 'archived';

export default function KanbanScreen() {
  const [movingId, setMovingId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.conversations.byStatus.useQuery();

  const updateStatus = trpc.conversations.updateKanbanStatus.useMutation({
    onSuccess: () => {
      utils.conversations.byStatus.invalidate();
      setMovingId(null);
    },
  });

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <View style={styles.screen}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.board}>
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.key}
            title={col.title}
            colour={col.colour}
            cards={data?.[col.key] ?? []}
            onMoveCard={(id) => setMovingId(id)}
          />
        ))}
      </ScrollView>

      {/* Move-to-column bottom sheet */}
      <Modal visible={!!movingId} transparent animationType="slide" onRequestClose={() => setMovingId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setMovingId(null)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Move to column</Text>
          {COLUMNS.map((col) => (
            <Pressable
              key={col.key}
              style={styles.sheetOption}
              onPress={() => movingId && updateStatus.mutate({ id: movingId, status: col.key })}
              disabled={updateStatus.isPending}
            >
              <View style={[styles.colDot, { backgroundColor: col.colour }]} />
              <Text style={styles.sheetOptionText}>{col.title}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.cancelButton} onPress={() => setMovingId(null)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  board: { padding: 16, alignItems: 'flex-start' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#111827' },
  sheetOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  colDot: { width: 12, height: 12, borderRadius: 6 },
  sheetOptionText: { fontSize: 16, color: '#374151' },
  cancelButton: { marginTop: 16, alignItems: 'center' },
  cancelText: { color: '#6b7280', fontSize: 16 },
});
```

## Test it

Open the Kanban tab. Verify:
1. Four columns visible, horizontally scrollable
2. Each column shows the correct cards based on their `kanbanStatus`
3. Tap a card — navigates to lead detail screen
4. Long-press a card — move bottom sheet appears
5. Select a different column — card moves (data refetched)

## Mini-task
Add a total pipeline count badge in the Kanban tab header: `Leads (12)` where 12 is the total count across all columns. Use the `data` from `byStatus` to compute the sum: `Object.values(data ?? {}).flat().length`.

## Glossary
- **`nestedScrollEnabled`** — React Native prop required on Android to enable scrolling inside a ScrollView nested in another ScrollView.
- **`onLongPress`** — gesture that fires after holding for `delayLongPress` milliseconds; used here to trigger the move-card action.
- **`Modal`** — React Native component for overlaying content; `transparent` + `animationType="slide"` creates a bottom sheet pattern.
- **Horizontal scroll** — `<ScrollView horizontal>` or `<FlatList horizontal>`; used for the column rail of the Kanban board.
- **`invalidate`** — tells TanStack Query to mark the cache for a procedure as stale and refetch; used after a mutation to sync server state.

## Resources
- [React Native — Modal](https://reactnative.dev/docs/modal)
- [React Native — nested scrolling](https://reactnative.dev/docs/scrollview#nestedscrollenabled)

## Checklist
- [ ] `conversations.byStatus` tRPC procedure groups conversations by kanbanStatus
- [ ] `KanbanColumn` renders cards with intent dot, stars, preview, date
- [ ] Horizontal `ScrollView` contains all four columns
- [ ] Long-press on a card opens the move-to-column Modal
- [ ] Selecting a column fires `updateKanbanStatus` and refetches board data
- [ ] Empty columns show an "Empty" placeholder
