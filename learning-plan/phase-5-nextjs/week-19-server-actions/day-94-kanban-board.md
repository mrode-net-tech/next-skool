# Day 94 — Kanban board (conversations as cards)

## Goal
Build the admin Kanban board where each high-value conversation becomes a draggable card. Use `@dnd-kit` for drag-and-drop. When a card is dropped into a new column, optimistically update the UI and persist the change via a Server Action.

## Estimated time
~3 hours

## Prerequisites
Day 93 (admin dashboard with conversations list). At least one `Lead` + `KanbanCard` row in the DB — seed some manually via Prisma Studio for testing.

## Where to put your code
In `ai-folio`. New files under `src/app/admin/kanban/` and `src/components/admin/`.

## Explanation

**`@dnd-kit`** is the standard drag-and-drop library for React. It supports keyboard accessibility, works with Server Components (the DnD parts are Client Components), and handles the tricky pointer/touch event normalisation. You use three pieces: `DndContext` (sets up the drag environment), `useDroppable` (makes a column a drop target), and `useDraggable` (makes a card draggable).

**Fractional indexing** for card ordering: when you move a card between positions A and B, set `order = (A.order + B.order) / 2`. No renumbering. After many moves, orders look like `0.25, 0.375, 0.4375` — that's fine. If the gap gets too small (< 0.00001), renumber the column (rarely needed).

**Optimistic update pattern with `useOptimistic`** (React 19 / available in Next.js 14 via canary): update the local state immediately when the user drops a card, then fire the Server Action. If the Server Action fails, React reverts to the pre-optimistic state. The user sees instant feedback; the server catches up.

In Laravel terms: the Kanban board is like a drag-and-drop Trello clone where each `PATCH` to update the column is a Laravel Form Request hitting a controller — but here it's a Server Action called directly from the Client Component, no fetch layer needed.

## Step-by-step

### 1. Install @dnd-kit

```bash
pnpm add @dnd-kit/core @dnd-kit/utilities
```

### 2. Server Action — move a card

```ts name=src/app/admin/kanban/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { KanbanColumn } from '@prisma/client';

const MoveCardSchema = z.object({
  cardId: z.string().cuid(),
  column: z.nativeEnum(KanbanColumn),
  order: z.number(),
});

export async function moveKanbanCard(data: z.infer<typeof MoveCardSchema>) {
  const parsed = MoveCardSchema.safeParse(data);
  if (!parsed.success) throw new Error('Invalid card move data');

  await prisma.kanbanCard.update({
    where: { id: parsed.data.cardId },
    data: { column: parsed.data.column, order: parsed.data.order },
  });

  revalidatePath('/admin/kanban');
}
```

### 3. Kanban page — load cards grouped by column (Server Component)

```tsx name=src/app/admin/kanban/page.tsx
import { prisma } from '@/lib/db';
import { KanbanBoard } from '@/components/admin/kanban-board';
import type { KanbanColumn } from '@prisma/client';

const COLUMNS: KanbanColumn[] = ['new', 'reviewing', 'contacted', 'closed'];

export default async function KanbanPage() {
  const cards = await prisma.kanbanCard.findMany({
    orderBy: { order: 'asc' },
    include: {
      lead: {
        include: {
          conversation: {
            select: { intent: true, leadScore: true, visitorEmail: true, createdAt: true },
          },
        },
      },
    },
  });

  const grouped = COLUMNS.reduce(
    (acc, col) => {
      acc[col] = cards.filter((c) => c.column === col);
      return acc;
    },
    {} as Record<KanbanColumn, typeof cards>,
  );

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Kanban</h1>
      <KanbanBoard initialCards={grouped} columns={COLUMNS} />
    </div>
  );
}
```

### 4. KanbanBoard Client Component

```tsx name=src/components/admin/kanban-board.tsx
'use client';

import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { KanbanColumn } from '@prisma/client';
import { KanbanColumnArea } from './kanban-column';
import { KanbanCardItem } from './kanban-card-item';
import { moveKanbanCard } from '@/app/admin/kanban/actions';

type Card = {
  id: string;
  column: KanbanColumn;
  order: number;
  lead: {
    score: number;
    intent: string;
    conversation: {
      intent: string | null;
      leadScore: number | null;
      visitorEmail: string | null;
      createdAt: Date;
    };
  };
};

interface KanbanBoardProps {
  initialCards: Record<KanbanColumn, Card[]>;
  columns: KanbanColumn[];
}

export function KanbanBoard({ initialCards, columns }: KanbanBoardProps) {
  const [cardsByColumn, setCardsByColumn] = useState(initialCards);
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const targetColumn = over.id as KanbanColumn;

    const sourceColumn = (
      Object.keys(cardsByColumn) as KanbanColumn[]
    ).find((col) => cardsByColumn[col].some((c) => c.id === cardId));

    if (!sourceColumn || sourceColumn === targetColumn) return;

    const card = cardsByColumn[sourceColumn].find((c) => c.id === cardId)!;
    const targetCards = cardsByColumn[targetColumn];
    const newOrder =
      targetCards.length === 0
        ? 1
        : targetCards[targetCards.length - 1].order + 1;

    // Optimistic update
    setCardsByColumn((prev) => ({
      ...prev,
      [sourceColumn]: prev[sourceColumn].filter((c) => c.id !== cardId),
      [targetColumn]: [
        ...prev[targetColumn],
        { ...card, column: targetColumn, order: newOrder },
      ].sort((a, b) => a.order - b.order),
    }));

    setActiveCard(null);

    // Persist
    await moveKanbanCard({ cardId, column: targetColumn, order: newOrder });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => {
        const card = Object.values(cardsByColumn)
          .flat()
          .find((c) => c.id === e.active.id);
        setActiveCard(card ?? null);
      }}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveCard(null)}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <KanbanColumnArea key={col} column={col} cards={cardsByColumn[col]} />
        ))}
      </div>

      <DragOverlay>
        {activeCard && <KanbanCardItem card={activeCard} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}
```

### 5. Column and card components

```tsx name=src/components/admin/kanban-column.tsx
'use client';

import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { KanbanCardItem } from './kanban-card-item';
import type { KanbanColumn } from '@prisma/client';

const columnLabels: Record<KanbanColumn, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  contacted: 'Contacted',
  closed: 'Closed',
};

type Card = Parameters<typeof KanbanCardItem>[0]['card'];

export function KanbanColumnArea({
  column,
  cards,
}: {
  column: KanbanColumn;
  cards: Card[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column });

  return (
    <div className="flex w-64 shrink-0 flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{columnLabels[column]}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
          {cards.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'min-h-32 rounded-lg border-2 border-dashed p-2 transition-colors',
          isOver ? 'border-primary bg-primary/5' : 'border-transparent',
        )}
      >
        {cards.map((card) => (
          <KanbanCardItem key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
```

```tsx name=src/components/admin/kanban-card-item.tsx
'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type Card = {
  id: string;
  lead: {
    score: number;
    conversation: {
      intent: string | null;
      leadScore: number | null;
      visitorEmail: string | null;
      createdAt: Date;
    };
  };
};

export function KanbanCardItem({
  card,
  isDragging = false,
}: {
  card: Card;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: card.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'mb-2 cursor-grab rounded-lg border bg-card p-3 text-sm shadow-sm',
        isDragging && 'opacity-50',
      )}
    >
      <div className="mb-1 font-medium">
        {'★'.repeat(card.lead.score)}{'☆'.repeat(5 - card.lead.score)}
      </div>
      {card.lead.conversation.intent && (
        <p className="mb-1 text-xs text-muted-foreground">
          {card.lead.conversation.intent.replace('_', ' ')}
        </p>
      )}
      {card.lead.conversation.visitorEmail && (
        <p className="truncate text-xs text-muted-foreground">
          {card.lead.conversation.visitorEmail}
        </p>
      )}
    </div>
  );
}
```

## Test it

```bash
pnpm dev
```

Seed a test lead manually in Prisma Studio (`npx prisma studio`):
1. Create a `Conversation` row.
2. Create a `Lead` row linked to it (`conversationId`, `score: 5`, `intent: job_offer`, `status: new`).
3. Create a `KanbanCard` row linked to the lead (`column: new`, `order: 1`).
4. Visit `/admin/kanban` — card appears in the "New" column.
5. Drag the card to "Reviewing" — it moves immediately (optimistic update).
6. Refresh the page — card stays in "Reviewing" (persisted via Server Action).

## Mini-task
Add a click-to-expand feature: clicking a card (not dragging) navigates to `/admin/conversations/:conversationId`. Use the `leadId` → `lead.conversationId` relationship to build the URL.

## Glossary
- **`DndContext`** — root provider from `@dnd-kit/core`; manages drag state and fires events.
- **`useDroppable`** — hook that makes an element a drop target; gives `isOver` for hover styling.
- **`useDraggable`** — hook that makes an element draggable; gives `transform` for CSS movement.
- **`DragOverlay`** — renders a clone of the dragged item at the cursor position while dragging.
- **Fractional indexing** — ordering strategy where new positions get `(prev + next) / 2`; avoids renumbering.

## Resources
- [@dnd-kit — Getting started](https://docs.dndkit.com/introduction/getting-started)
- [@dnd-kit — Droppable](https://docs.dndkit.com/api-documentation/droppable)
- [Fractional indexing](https://www.figma.com/blog/realtime-editing-of-ordered-sequences/)

## Checklist
- [ ] `@dnd-kit/core` and `@dnd-kit/utilities` installed
- [ ] `moveKanbanCard` Server Action updates `KanbanCard.column` and `order`
- [ ] Kanban page loads cards grouped by column from DB (Server Component)
- [ ] Cards drag between columns with visual feedback (`isOver` highlighting)
- [ ] Optimistic update moves card immediately on drop
- [ ] Server Action persists the move and `revalidatePath` refreshes on next visit
- [ ] `pnpm build` passes
