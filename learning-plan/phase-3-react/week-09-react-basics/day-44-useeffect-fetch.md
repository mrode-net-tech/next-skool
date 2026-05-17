# Day 44 — useEffect + fetch

## Goal
Use `useEffect` to fetch tasks from `my-api` on mount, handle loading and error states, and understand the dependency array.

## Estimated time
~1.5 hours

## Prerequisites
Day 43 — full task CRUD working locally. `my-api` running on port 3000.

## Where to put your code
In `my-web`.

## Explanation

**`useEffect`** lets a component perform side effects — anything that reaches outside React's render cycle: fetching data, setting up subscriptions, timers, or direct DOM manipulation. The Laravel analogy: think of it as a controller method that runs after the view has been sent. In React it runs after every render where its dependencies changed.

The **dependency array** (second argument) controls when the effect re-runs:
- `[]` — run once after first render (on mount). Equivalent to `componentDidMount`.
- `[id]` — re-run whenever `id` changes.
- Omitted — re-run after every render. Rarely what you want.

**Cleanup**: effects can return a function that React calls before running the effect again or before unmounting. Typical use: cancel a fetch, clear a timer, unsubscribe.

`useEffect` + `fetch` works for learning but has sharp edges at scale (race conditions, no caching, no deduplication). Day 51 replaces this with TanStack Query which solves all those problems. Today you learn the fundamentals; Day 51 you learn the right tool.

## Step-by-step

### 1. Enable CORS in `my-api`

`my-web` runs on port 5173; `my-api` on port 3000. Browsers block cross-origin requests by default.

```bash
# In my-api
npm install cors
npm install -D @types/cors
```

```ts name=src/app.ts
import cors from 'cors';

// Add before other middleware
app.use(cors({ origin: 'http://localhost:5173' }));
```

### 2. A typed API client module

```ts name=src/api/tasks.ts
import type { Task } from '@/types/task';

const BASE = 'http://localhost:3000';

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${BASE}/tasks`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Task[]>;
}

export async function createTask(title: string): Promise<Task> {
  const res = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, priority: 2 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Task>;
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`${BASE}/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
```

> `my-api` returns `userId` as required — for now, hardcode a test user id or remove the `userId` requirement from `my-api` temporarily. Day 71 (login flow) wires real auth.

### 3. Fetch on mount with loading + error states

```tsx name=src/App.tsx
import { useEffect, useState } from 'react';
import { TaskList } from '@/components/TaskList';
import { AddTaskForm } from '@/components/AddTaskForm';
import { fetchTasks, createTask, deleteTask } from '@/api/tasks';
import type { Task } from '@/types/task';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    fetchTasks()
      .then((data) => {
        if (!cancelled) setTasks(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []); // [] = run once on mount

  async function handleAdd(title: string) {
    try {
      const task = await createTask(title);
      setTasks((prev) => [...prev, task]);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  function handleToggle(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h1>Tasks</h1>
      <AddTaskForm onAdd={handleAdd} />
      <TaskList tasks={tasks} onToggle={handleToggle} onDelete={handleDelete} />
    </div>
  );
}

export default App;
```

The `cancelled` flag is a lightweight race-condition guard: if the component unmounts before the fetch finishes, you don't call `setState` on an unmounted component.

### 4. Understand the dependency array with an example

```tsx
// Refetch whenever userId changes
useEffect(() => {
  fetchTasks(userId).then(setTasks);
}, [userId]); // re-runs when userId value changes
```

Lint rule `react-hooks/exhaustive-deps` (comes with the React ESLint plugin) warns if you read a value inside an effect without listing it as a dependency. Trust the lint rule.

### 5. Install the React ESLint plugin

```bash
npm install -D eslint-plugin-react-hooks eslint-plugin-react-refresh
```

Add to `eslint.config.js` (Vite generates one):
```js name=eslint.config.js
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  // ... existing config
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
];
```

## Test it

1. Start `my-api`: `npm run dev` in `my-api/`.
2. Start `my-web`: `npm run dev` in `my-web/`.
3. Open `http://localhost:5173` — tasks from the database appear.
4. Add a task — it persists (survives page refresh).
5. Delete a task — removed from DB.

```bash
# Verify tasks in DB via api
curl http://localhost:3000/tasks
```

## Mini-task
Add a "Refresh" button that re-fetches tasks by calling a `refetch` function (extract the fetch logic outside `useEffect` and call it from both the effect and the button's `onClick`).

## Glossary
- **useEffect** — hook for side effects; runs after render.
- **Dependency array** — controls when an effect re-runs; `[]` means once on mount.
- **Cleanup function** — returned from effect; runs before next effect or on unmount.
- **Race condition** — two async operations racing; whichever finishes last wins (may be wrong). The `cancelled` flag prevents it.
- **CORS** — browser security mechanism blocking cross-origin requests without explicit server permission.

## Resources
- [React docs — useEffect](https://react.dev/reference/react/useEffect)
- [React docs — Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

## Checklist
- [ ] CORS enabled in `my-api`
- [ ] Tasks load from DB on page open
- [ ] Loading state shown while fetching
- [ ] Error state shown if fetch fails
- [ ] Add task persists to DB
- [ ] Delete task removes from DB
- [ ] `cancelled` flag prevents stale setState
