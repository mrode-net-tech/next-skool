# Day 42 — Components + Props

## Goal
Build composable React components with typed props, understand one-way data flow, and learn when to split a component into smaller pieces.

## Estimated time
~1.5 hours

## Prerequisites
Day 41 — `my-web` running with `@` alias.

## Where to put your code
In `my-web`.

## Explanation

**One-way data flow** means data travels down the tree: parent → child via props. Children never mutate props; they call callback props (functions) to ask the parent to change. This is the opposite mental model from two-way binding (Angular `[(ngModel)]`) but maps well to how a server-rendered form works: the server holds the truth, the form just displays it.

A **component** is any function whose name starts with a capital letter and returns JSX (or `null`). React does not care where the file lives — but convention is one component per file in `src/components/`.

**Prop drilling** is passing props through several layers of components just to reach a deeply nested child. It's the React equivalent of passing variables through multiple Blade `@include` partials. Day 51 (TanStack Query) and later state management tools solve this; for now, keep the tree shallow.

TypeScript prop types via `interface` give you autocomplete and catch mistakes at compile time, not at runtime in the browser.

## Step-by-step

### 1. A typed `TaskCard` component

```tsx name=src/components/TaskCard.tsx
interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: 1 | 2 | 3;
}

interface Props {
  task: Task;
  onToggle: (id: string) => void;
}

const PRIORITY_LABEL: Record<Task['priority'], string> = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
};

export function TaskCard({ task, onToggle }: Props) {
  return (
    <div style={{ opacity: task.done ? 0.5 : 1 }}>
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => onToggle(task.id)}
      />
      <span>{task.title}</span>
      <small> [{PRIORITY_LABEL[task.priority]}]</small>
    </div>
  );
}
```

### 2. A `TaskList` component that composes `TaskCard`

```tsx name=src/components/TaskList.tsx
import { TaskCard } from './TaskCard';

interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: 1 | 2 | 3;
}

interface Props {
  tasks: Task[];
  onToggle: (id: string) => void;
}

export function TaskList({ tasks, onToggle }: Props) {
  if (tasks.length === 0) {
    return <p>No tasks yet.</p>;
  }

  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id}>
          <TaskCard task={task} onToggle={onToggle} />
        </li>
      ))}
    </ul>
  );
}
```

> Note the `key` prop on `<li>`. React uses it to reconcile list items efficiently — always provide a stable, unique key (the DB id is perfect). Never use array index as key when the list can reorder.

### 3. Shared types file

Duplicating the `Task` interface is a smell. Extract it:

```ts name=src/types/task.ts
export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: 1 | 2 | 3;
}
```

Update both components to import from `@/types/task`.

### 4. Wire up in `App.tsx` with hardcoded data

```tsx name=src/App.tsx
import { useState } from 'react';
import { TaskList } from '@/components/TaskList';
import type { Task } from '@/types/task';

const INITIAL_TASKS: Task[] = [
  { id: '1', title: 'Buy milk', done: false, priority: 1 },
  { id: '2', title: 'Write tests', done: false, priority: 3 },
  { id: '3', title: 'Deploy', done: true, priority: 2 },
];

function App() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);

  function handleToggle(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  return (
    <div>
      <h1>Tasks</h1>
      <TaskList tasks={tasks} onToggle={handleToggle} />
    </div>
  );
}

export default App;
```

`useState` is explained in depth on Day 43 — today just treat it as a box that holds `tasks` and re-renders when you call `setTasks`.

### 5. Optional children prop

Components can accept arbitrary JSX via the special `children` prop:

```tsx name=src/components/Card.tsx
interface Props {
  title: string;
  children: React.ReactNode;
}

export function Card({ title, children }: Props) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
```

Usage:
```tsx
<Card title="My Tasks">
  <TaskList tasks={tasks} onToggle={handleToggle} />
</Card>
```

## Test it

Open `http://localhost:5173`. Click checkboxes — tasks should grey out. No TypeScript errors in the terminal.

Run type-check explicitly:
```bash
npx tsc --noEmit
```

## Mini-task
Add a `<PriorityBadge priority={task.priority} />` component that renders different colored `<span>` elements for Low / Medium / High. Use it inside `TaskCard`.

## Glossary
- **One-way data flow** — data flows down (parent → child via props); events flow up (child → parent via callback props).
- **key prop** — a stable unique string React uses to identify list items during re-renders.
- **children** — special prop that holds JSX passed between a component's opening and closing tags.
- **React.ReactNode** — the TypeScript type for anything renderable: JSX, string, number, null, array.

## Resources
- [React docs — Passing Props](https://react.dev/learn/passing-props-to-a-component)
- [React docs — Rendering Lists](https://react.dev/learn/rendering-lists)
- [React TypeScript cheatsheet — Props](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/basic_type_example)

## Checklist
- [ ] `Task` interface extracted to `src/types/task.ts`
- [ ] `TaskCard` and `TaskList` import from shared types
- [ ] Checkbox toggle works in the browser
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] Understand why `key` must be stable and unique
