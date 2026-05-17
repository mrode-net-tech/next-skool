# Day 46 — React Router

## Goal
Add client-side routing to `my-web` with React Router v6: define routes, navigate between pages, and read URL parameters.

## Estimated time
~1.5 hours

## Prerequisites
Day 45 — `my-web` with RTL tests passing.

## Where to put your code
In `my-web`.

## Explanation

**Client-side routing** means the browser never makes a full-page request when you navigate between "pages". JavaScript intercepts link clicks, updates the URL via the History API, and swaps out the rendered component. The server only serves `index.html` once; subsequent navigation is pure JS. Think of it as Laravel routes, but all executed in the browser — no server round-trips.

**React Router v6** introduces `<Routes>` + `<Route>` declarative config and the `<Outlet>` concept for nested layouts. The v6 API is significantly different from v5 — if you find old tutorials using `<Switch>`, ignore them.

`useParams` extracts `:id` segments from the URL (like Laravel's `$route->parameter('id')`). `useNavigate` lets you programmatically redirect (`navigate('/tasks')` instead of `<Link to="/tasks">`). `<Link>` is a replacement for `<a>` that doesn't reload the page.

## Step-by-step

### 1. Install React Router

```bash
npm install react-router-dom
```

### 2. Create page components

```tsx name=src/pages/TasksPage.tsx
export function TasksPage() {
  return <h2>Tasks</h2>;
}
```

```tsx name=src/pages/TaskDetailPage.tsx
import { useParams } from 'react-router-dom';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <h2>Task detail: {id}</h2>;
}
```

```tsx name=src/pages/NotFoundPage.tsx
export function NotFoundPage() {
  return <h2>404 — Page not found</h2>;
}
```

### 3. Set up the router in `main.tsx`

```tsx name=src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

### 4. Define routes in `App.tsx`

```tsx name=src/App.tsx
import { Routes, Route, Link } from 'react-router-dom';
import { TasksPage } from '@/pages/TasksPage';
import { TaskDetailPage } from '@/pages/TaskDetailPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function App() {
  return (
    <div>
      <nav>
        <Link to="/">Home</Link>{' '}
        <Link to="/tasks">Tasks</Link>
      </nav>

      <Routes>
        <Route path="/" element={<h1>Welcome</h1>} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}

export default App;
```

### 5. Move task list logic into `TasksPage`

Extract the `useEffect` + state management from Day 44's `App.tsx` into `TasksPage.tsx`:

```tsx name=src/pages/TasksPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TaskList } from '@/components/TaskList';
import { AddTaskForm } from '@/components/AddTaskForm';
import { fetchTasks, createTask, deleteTask } from '@/api/tasks';
import type { Task } from '@/types/task';

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTasks()
      .then((data) => { if (!cancelled) setTasks(data); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleAdd(title: string) {
    const task = await createTask(title);
    setTasks((prev) => [...prev, task]);
  }

  async function handleDelete(id: string) {
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h2>Tasks</h2>
      <AddTaskForm onAdd={handleAdd} />
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            <Link to={`/tasks/${task.id}`}>{task.title}</Link>
            <button onClick={() => handleDelete(task.id)}>✕</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 6. Programmatic navigation

```tsx name=src/pages/TaskDetailPage.tsx
import { useParams, useNavigate } from 'react-router-dom';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div>
      <h2>Task: {id}</h2>
      <button onClick={() => navigate('/tasks')}>← Back</button>
    </div>
  );
}
```

### 7. Configure Vite dev server for SPA fallback

When the user refreshes `/tasks/abc`, the dev server must serve `index.html` (not 404). Vite does this automatically in dev mode. For production (`nginx`, etc.) you need to configure `try_files $uri /index.html`.

## Test it

1. Open `http://localhost:5173` — welcome page.
2. Click "Tasks" link — `/tasks` renders task list.
3. Click a task title — `/tasks/<id>` renders detail.
4. Click "← Back" — returns to `/tasks`.
5. Navigate to `/nonexistent` — 404 page.

## Mini-task
Add a `<NavLink>` (instead of `<Link>`) to the nav so the active link gets a CSS class `active` (React Router adds this automatically on `<NavLink>`).

## Glossary
- **Client-side routing** — URL changes handled by JS, no server request.
- **`<Routes>` / `<Route>`** — declarative route tree; first match wins.
- **`useParams`** — hook returning URL params as `Record<string, string>`.
- **`useNavigate`** — hook returning an imperative navigation function.
- **`<Link>`** — replacement for `<a>` that uses the History API.

## Resources
- [React Router v6 docs](https://reactrouter.com/en/main)
- [React Router — Tutorial](https://reactrouter.com/en/main/start/tutorial)

## Checklist
- [ ] `react-router-dom` installed
- [ ] `<BrowserRouter>` wraps app in `main.tsx`
- [ ] `/`, `/tasks`, `/tasks/:id`, `*` routes defined
- [ ] Task titles link to detail pages
- [ ] `useNavigate` back button works
- [ ] 404 page renders for unknown URLs
