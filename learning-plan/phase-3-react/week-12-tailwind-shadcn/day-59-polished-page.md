# Day 59 — Build a polished page

## Goal
Apply everything from Weeks 9–12 to build a complete, polished Tasks dashboard: layout, forms, loading states, TanStack Query data, shadcn Dialog, Tailwind styling — all integrated.

## Estimated time
~2.5 hours

## Prerequisites
Days 41–58 — all Phase 3 components and hooks in place.

## Where to put your code
In `my-web`.

## Explanation

This day is integration, not new concepts. You pull together every tool from Phase 3 into one coherent UI. The goal is a page that looks like something you'd put in a portfolio — not a tutorial demo.

The pattern: data from TanStack Query → rendered with shadcn/Tailwind components → mutations wired to RHF forms inside Dialogs → loading/error states handled gracefully.

## Step-by-step

### 1. Final `TasksPage` layout

```tsx name=src/pages/TasksPage.tsx
import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchTasksPage } from '@/api/tasks';
import { taskKeys } from '@/api/query-keys';
import { useCreateTask, useDeleteTask, useToggleTask } from '@/api/task.mutations';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { NewTaskForm } from '@/components/NewTaskForm';
import { cn } from '@/lib/cn';
import type { CreateTaskInput } from '@/schemas/task.schema';

const PRIORITY_MAP = {
  1: { label: 'Low', variant: 'low' },
  2: { label: 'Medium', variant: 'medium' },
  3: { label: 'High', variant: 'high' },
} as const;

export function TasksPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: taskKeys.list(),
      queryFn: fetchTasksPage,
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    });

  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();
  const toggleTask = useToggleTask();

  const tasks = data?.pages.flatMap((p) => p.items) ?? [];
  const done = tasks.filter((t) => t.done).length;

  async function handleCreate(values: CreateTaskInput) {
    await createTask.mutateAsync(values);
    setDialogOpen(false);
  }

  if (isLoading) return <Spinner label="Loading tasks…" />;
  if (isError) return <ErrorMessage message={(error as Error).message} />;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {done} of {tasks.length} completed
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">+ New task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new task</DialogTitle>
            </DialogHeader>
            <NewTaskForm
              onSubmit={handleCreate}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Progress bar */}
      {tasks.length > 0 && (
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-sky-500 transition-all duration-500"
            style={{ width: `${Math.round((done / tasks.length) * 100)}%` }}
          />
        </div>
      )}

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center">
          <p className="text-slate-500">No tasks yet. Create one above.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-sm">
          {tasks.map((task) => {
            const priority = PRIORITY_MAP[task.priority as 1 | 2 | 3];
            return (
              <li
                key={task.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 transition-colors',
                  task.done && 'opacity-50'
                )}
              >
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => toggleTask.mutate({ id: task.id, done: !task.done })}
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <Link
                  to={`/tasks/${task.id}`}
                  className={cn(
                    'flex-1 text-sm font-medium text-slate-800 hover:text-sky-700',
                    task.done && 'line-through'
                  )}
                >
                  {task.title}
                </Link>
                <Badge variant={priority.variant as 'low' | 'medium' | 'high'}>
                  {priority.label}
                </Badge>
                <button
                  onClick={() => deleteTask.mutate(task.id)}
                  disabled={deleteTask.isPending}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  aria-label="Delete task"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Load more */}
      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
```

### 2. `Badge` component with priority variants

```tsx name=src/components/ui/Badge.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        low: 'bg-slate-100 text-slate-600',
        medium: 'bg-amber-100 text-amber-700',
        high: 'bg-red-100 text-red-700',
        default: 'bg-sky-100 text-sky-700',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

interface Props
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: Props) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```

### 3. Task detail page — polished

```tsx name=src/pages/TaskDetailPage.tsx
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchTask } from '@/api/tasks';
import { taskKeys } from '@/api/query-keys';
import { useToggleTask, useDeleteTask } from '@/api/task.mutations';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

const PRIORITY_MAP = { 1: 'low', 2: 'medium', 3: 'high' } as const;
const PRIORITY_LABEL = { 1: 'Low', 2: 'Medium', 3: 'High' } as const;

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toggleTask = useToggleTask();
  const deleteTask = useDeleteTask();

  const { data: task, isLoading, isError, error } = useQuery({
    queryKey: taskKeys.detail(id!),
    queryFn: () => fetchTask(id!),
    enabled: Boolean(id),
  });

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorMessage message={(error as Error).message} />;
  if (!task) return null;

  async function handleDelete() {
    await deleteTask.mutateAsync(task!.id);
    navigate('/tasks');
  }

  return (
    <div className="mx-auto max-w-lg">
      <button
        onClick={() => navigate('/tasks')}
        className="mb-4 text-sm text-slate-500 hover:text-slate-900"
      >
        ← Back to tasks
      </button>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <h1 className={`text-xl font-bold ${task.done ? 'line-through text-slate-400' : 'text-slate-900'}`}>
            {task.title}
          </h1>
          <Badge variant={PRIORITY_MAP[task.priority as 1 | 2 | 3]}>
            {PRIORITY_LABEL[task.priority as 1 | 2 | 3]}
          </Badge>
        </div>

        <p className="mt-2 text-sm text-slate-500">
          Status: <span className="font-medium">{task.done ? 'Completed' : 'Pending'}</span>
        </p>

        <div className="mt-6 flex gap-2">
          <Button
            variant="secondary"
            onClick={() => toggleTask.mutate({ id: task.id, done: !task.done })}
          >
            {task.done ? 'Mark pending' : 'Mark done'}
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={deleteTask.isPending}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
```

## Test it

```bash
npm run dev
```

Verify:
- Progress bar animates as tasks are toggled.
- Dialog opens/closes correctly; form resets after submit.
- Detail page shows task with correct badge color.
- Delete from detail navigates back to list.

```bash
npm test && npx tsc --noEmit
```

## Mini-task
Add a filter bar above the task list with buttons: "All", "Pending", "Done". Clicking filters the displayed tasks client-side (no API call needed — filter the `tasks` array).

## Checklist
- [ ] `Badge` component with priority variants
- [ ] `TasksPage` shows progress bar + task count
- [ ] Dialog opens, submits, closes correctly
- [ ] Detail page has polished layout with action buttons
- [ ] Tests pass, no TypeScript errors
