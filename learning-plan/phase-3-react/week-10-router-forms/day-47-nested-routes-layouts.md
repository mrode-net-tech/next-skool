# Day 47 — Nested routes + layouts

## Goal
Build a persistent layout (nav bar, sidebar) using React Router's `<Outlet>`, implement nested routes, and understand index routes.

## Estimated time
~1.5 hours

## Prerequisites
Day 46 — React Router routing working.

## Where to put your code
In `my-web`.

## Explanation

**Nested routes** in React Router v6 allow a parent route to render a layout shell and delegate the inner content to child routes via `<Outlet>`. This is the equivalent of Laravel's layout Blade templates (`@extends('layouts.app')` + `@yield('content')`) — the layout is defined once and child views fill in the slot.

Without nesting, every page has to repeat the nav bar. With nesting, the nav bar lives in a layout component and every route inside it gets the nav for free.

**Index routes** (`index` attribute on `<Route>`) are rendered when no child route is matched — they're the default child. Equivalent to a controller's `index()` method: the thing shown when no specific sub-resource is requested.

**Outlet context** (`useOutletContext`) lets a parent layout pass data down to child routes — useful for passing things like the current user, without prop drilling or global state.

## Step-by-step

### 1. Create a `RootLayout` component

```tsx name=src/layouts/RootLayout.tsx
import { NavLink, Outlet } from 'react-router-dom';

export function RootLayout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header style={{ background: '#1e293b', color: '#f8fafc', padding: '0.75rem 1.5rem' }}>
        <nav style={{ display: 'flex', gap: '1.5rem' }}>
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({ color: isActive ? '#38bdf8' : '#f8fafc', textDecoration: 'none' })}
          >
            Home
          </NavLink>
          <NavLink
            to="/tasks"
            style={({ isActive }) => ({ color: isActive ? '#38bdf8' : '#f8fafc', textDecoration: 'none' })}
          >
            Tasks
          </NavLink>
        </nav>
      </header>

      <main style={{ flex: 1, padding: '1.5rem' }}>
        <Outlet />
      </main>

      <footer style={{ padding: '0.5rem 1.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
        my-web © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
```

`<Outlet />` is the slot. Whatever child route matches gets rendered here.

### 2. Restructure routes with nesting

```tsx name=src/App.tsx
import { Routes, Route } from 'react-router-dom';
import { RootLayout } from '@/layouts/RootLayout';
import { TasksPage } from '@/pages/TasksPage';
import { TaskDetailPage } from '@/pages/TaskDetailPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function HomePage() {
  return <h2>Welcome to my-web</h2>;
}

function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<HomePage />} />
        <Route path="tasks">
          <Route index element={<TasksPage />} />
          <Route path=":id" element={<TaskDetailPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
```

Key points:
- The parent `<Route element={<RootLayout />}>` has no `path` — it's a layout-only route.
- `<Route index ...>` matches when the parent path matches exactly (no child segment).
- `<Route path="tasks">` is relative — it means `/tasks`, not a top-level `/tasks` vs `tasks`.

### 3. Nested tasks layout with sidebar

Add a sub-layout for the tasks section:

```tsx name=src/layouts/TasksLayout.tsx
import { Outlet, NavLink } from 'react-router-dom';

export function TasksLayout() {
  return (
    <div style={{ display: 'flex', gap: '1.5rem' }}>
      <aside style={{ width: '180px', borderRight: '1px solid #e2e8f0', paddingRight: '1rem' }}>
        <h3>Tasks</h3>
        <NavLink to="/tasks" end style={{ display: 'block' }}>All tasks</NavLink>
      </aside>
      <div style={{ flex: 1 }}>
        <Outlet />
      </div>
    </div>
  );
}
```

Wire into routes:

```tsx name=src/App.tsx
import { TasksLayout } from '@/layouts/TasksLayout';

// Inside <Routes>:
<Route path="tasks" element={<TasksLayout />}>
  <Route index element={<TasksPage />} />
  <Route path=":id" element={<TaskDetailPage />} />
</Route>
```

Now `/tasks` renders: RootLayout → TasksLayout → TasksPage.

### 4. Pass data via Outlet context

```tsx name=src/layouts/TasksLayout.tsx
import { Outlet, useOutletContext } from 'react-router-dom';

interface TasksContext {
  refetchTrigger: number;
}

export function TasksLayout() {
  // This could hold shared state for all tasks routes
  return (
    <div style={{ display: 'flex', gap: '1.5rem' }}>
      <aside style={{ width: '180px' }}>
        <h3>Tasks</h3>
      </aside>
      <div style={{ flex: 1 }}>
        <Outlet context={{ refetchTrigger: 0 } satisfies TasksContext} />
      </div>
    </div>
  );
}

// In a child route component:
export function useTasksContext() {
  return useOutletContext<TasksContext>();
}
```

Export `useTasksContext` from `TasksLayout.tsx` — child pages import it to get the shared context.

### 5. The `end` prop on `NavLink`

```tsx
<NavLink to="/tasks" end>Tasks</NavLink>
```

Without `end`, `/tasks/abc` would also activate the `/tasks` link (because the URL starts with `/tasks`). `end` requires an exact match.

## Test it

1. Navigate to `/` — layout renders, "Welcome" shown in main.
2. Navigate to `/tasks` — task list appears in the sidebar layout.
3. Click a task — `/tasks/:id` renders in the same layout.
4. Check nav: active link is highlighted.

## Mini-task
Add a `/tasks/new` route that renders a standalone `<NewTaskPage>` with the `AddTaskForm`. Make the sidebar include a "New task" link.

## Glossary
- **`<Outlet>`** — slot component; renders the matched child route's element.
- **Index route** — default child rendered when parent URL matches exactly.
- **Layout route** — a `<Route>` with `element` but no `path`; wraps children in a shared UI.
- **`end` prop** — on `<NavLink>`, requires exact URL match for `isActive`.
- **`useOutletContext`** — hook to read data passed to `<Outlet context={...}>`.

## Resources
- [React Router — Outlet](https://reactrouter.com/en/main/components/outlet)
- [React Router — Nested Routes](https://reactrouter.com/en/main/start/tutorial#nested-routes)

## Checklist
- [ ] `RootLayout` with nav + footer wraps all routes
- [ ] `TasksLayout` adds sidebar for `/tasks` section
- [ ] Index routes work for `/` and `/tasks`
- [ ] NavLink highlights active link correctly with `end`
- [ ] Mini-task `/tasks/new` route added
