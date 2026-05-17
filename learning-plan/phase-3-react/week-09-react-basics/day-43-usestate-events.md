# Day 43 — useState + Events

## Goal
Master React's `useState` hook, handle user events correctly, and understand why state updates are asynchronous and must be immutable.

## Estimated time
~1.5 hours

## Prerequisites
Day 42 — `TaskList` + `TaskCard` components.

## Where to put your code
In `my-web`.

## Explanation

**`useState`** is React's mechanism for local component state — data that lives inside a component and triggers a re-render when it changes. The Laravel analogy: it's like a controller property that causes the view to re-render whenever it's assigned. Unlike a plain variable, React tracks `useState` values between renders.

A critical invariant: **never mutate state directly** (`tasks.push(...)` breaks React). Always replace with a new value (`setTasks([...tasks, newTask])`). React uses `Object.is` equality to decide whether to re-render; mutating an object keeps the same reference so React sees no change.

**Events** in React are synthetic wrappers around native DOM events. `onChange` on an `<input>` fires on every keystroke (unlike native `change` which fires on blur in some browsers). Always use React's camelCase event names (`onClick`, `onSubmit`, `onChange`).

The **functional updater form** `setState(prev => ...)` is important when the new state depends on the old one. It prevents stale-closure bugs where you'd be reading an outdated value of state.

## Step-by-step

### 1. Counter — simplest possible state

```tsx name=src/components/Counter.tsx
import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount((n) => n + 1)}>+</button>
      <button onClick={() => setCount((n) => n - 1)}>−</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}
```

`useState(0)` returns `[currentValue, setter]`. TypeScript infers the type as `number` from the initial value.

### 2. Controlled input

A **controlled input** is one where React drives the value — the opposite of a native input where the DOM holds the truth.

```tsx name=src/components/AddTaskForm.tsx
import { useState } from 'react';

interface Props {
  onAdd: (title: string) => void;
}

export function AddTaskForm({ onAdd }: Props) {
  const [title, setTitle] = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New task..."
      />
      <button type="submit">Add</button>
    </form>
  );
}
```

`e.preventDefault()` stops the browser's default form submission (a full-page GET/POST). Same concept as `return false` or `Event::fake()` in Laravel tests.

### 3. Wire form into `App.tsx`

```tsx name=src/App.tsx
import { useState } from 'react';
import { TaskList } from '@/components/TaskList';
import { AddTaskForm } from '@/components/AddTaskForm';
import type { Task } from '@/types/task';

const INITIAL_TASKS: Task[] = [
  { id: '1', title: 'Buy milk', done: false, priority: 1 },
  { id: '2', title: 'Write tests', done: false, priority: 3 },
];

function App() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);

  function handleToggle(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  function handleAdd(title: string) {
    const newTask: Task = {
      id: crypto.randomUUID(),
      title,
      done: false,
      priority: 2,
    };
    setTasks((prev) => [...prev, newTask]);
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

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

### 4. Add delete to `TaskCard`

Extend `TaskCard` props to accept `onDelete`:

```tsx name=src/components/TaskCard.tsx
import type { Task } from '@/types/task';

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TaskCard({ task, onToggle, onDelete }: Props) {
  return (
    <div style={{ opacity: task.done ? 0.5 : 1 }}>
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => onToggle(task.id)}
      />
      <span>{task.title}</span>
      <button onClick={() => onDelete(task.id)}>✕</button>
    </div>
  );
}
```

Update `TaskList` to thread `onDelete` down to each `TaskCard`.

### 5. State that should NOT be in `useState`

Rule of thumb: if you can compute it from existing state, don't store it. Example — "number of done tasks":

```tsx
// Derived — no useState needed
const doneCount = tasks.filter((t) => t.done).length;
```

Putting `doneCount` in its own `useState` creates a sync bug: you'd have to remember to update it every time `tasks` changes.

## Test it

1. Add a task via the form — it appears in the list.
2. Click the checkbox — opacity drops.
3. Click ✕ — task disappears.
4. `npx tsc --noEmit` — no errors.

## Mini-task
Add a "Clear done" button in `App.tsx` that removes all tasks where `done === true`. Use the functional updater form.

## Glossary
- **useState** — hook returning `[value, setter]`; setting triggers re-render.
- **Controlled input** — input whose `value` is driven by React state.
- **Functional updater** — `setState(prev => next)` form; safe when new state depends on old.
- **Synthetic event** — React's cross-browser wrapper over native DOM events.

## Resources
- [React docs — State: A Component's Memory](https://react.dev/learn/state-a-components-memory)
- [React docs — Responding to Events](https://react.dev/learn/responding-to-events)
- [React docs — Updating Arrays in State](https://react.dev/learn/updating-arrays-in-state)

## Checklist
- [ ] Counter renders and updates correctly
- [ ] `AddTaskForm` is controlled (value + onChange)
- [ ] Adding a task appends it to the list
- [ ] Deleting removes only that task
- [ ] "Clear done" mini-task implemented
- [ ] `npx tsc --noEmit` passes
