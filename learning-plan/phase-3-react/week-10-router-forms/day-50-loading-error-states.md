# Day 50 — Loading + error states

## Goal
Build reusable loading spinners and error boundaries, handle async errors gracefully, and use React Router's `loader` / `errorElement` for route-level data loading.

## Estimated time
~1.5 hours

## Prerequisites
Day 49 — Zod form validation. Day 46 — React Router routes set up.

## Where to put your code
In `my-web`.

## Explanation

Every async operation has three states: **pending**, **success**, **error**. Until Day 51 (TanStack Query), you manage these manually with `useState`. The patterns here are universal — TanStack Query just automates them.

**React Error Boundaries** are class components (the only remaining use case for classes in React) that catch render errors in their subtree and display a fallback UI. They're the equivalent of Laravel's exception handler — they catch what would otherwise be an unhandled crash. Note: Error boundaries only catch errors during rendering, not inside event handlers or async callbacks (use try/catch there).

React Router v6.4+ ships **loaders** and **errorElement** — you can define data fetching at the route level and get the loaded data synchronously inside the component via `useLoaderData()`. This is optional but elegant: it co-locates data requirements with the route definition.

## Step-by-step

### 1. Reusable `Spinner` component

```tsx name=src/components/ui/Spinner.tsx
interface Props {
  label?: string;
}

export function Spinner({ label = 'Loading…' }: Props) {
  return (
    <div role="status" aria-label={label} style={{ textAlign: 'center', padding: '2rem' }}>
      <span aria-hidden="true">⏳</span>
      <p>{label}</p>
    </div>
  );
}
```

### 2. Reusable `ErrorMessage` component

```tsx name=src/components/ui/ErrorMessage.tsx
interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: Props) {
  return (
    <div role="alert" style={{ color: '#dc2626', padding: '1rem', border: '1px solid #fca5a5', borderRadius: '4px' }}>
      <strong>Error: </strong>{message}
      {onRetry && (
        <button onClick={onRetry} style={{ marginLeft: '1rem' }}>
          Retry
        </button>
      )}
    </div>
  );
}
```

### 3. React Error Boundary

```tsx name=src/components/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react';
import { ErrorMessage } from './ui/ErrorMessage';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <ErrorMessage
          message={this.state.error.message}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
```

Wrap pages in `RootLayout`:

```tsx name=src/layouts/RootLayout.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Inside the JSX:
<main style={{ flex: 1, padding: '1.5rem' }}>
  <ErrorBoundary>
    <Outlet />
  </ErrorBoundary>
</main>
```

### 4. Custom hook for async state

Repeated `[data, loading, error]` state is a candidate for a custom hook:

```ts name=src/hooks/useAsync.ts
import { useState, useCallback } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useAsync<T>(fn: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await fn();
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [fn]);

  return { ...state, execute };
}
```

### 5. React Router `loader` + `errorElement`

Switch to React Router's data API for the tasks page. This requires `createBrowserRouter` instead of `<BrowserRouter>`:

```tsx name=src/router.tsx
import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '@/layouts/RootLayout';
import { TasksLayout } from '@/layouts/TasksLayout';
import { TasksPage } from '@/pages/TasksPage';
import { TaskDetailPage } from '@/pages/TaskDetailPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { fetchTasks } from '@/api/tasks';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <h2>Welcome</h2> },
      {
        path: 'tasks',
        element: <TasksLayout />,
        children: [
          {
            index: true,
            element: <TasksPage />,
            loader: fetchTasks,
            errorElement: <p role="alert">Failed to load tasks.</p>,
          },
          { path: ':id', element: <TaskDetailPage /> },
        ],
      },
    ],
  },
]);
```

```tsx name=src/main.tsx
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
```

```tsx name=src/pages/TasksPage.tsx
import { useLoaderData } from 'react-router-dom';
import type { Task } from '@/types/task';

export function TasksPage() {
  const tasks = useLoaderData() as Task[];
  // No more loading/error state — the loader handled it
  return (
    <ul>
      {tasks.map((t) => <li key={t.id}>{t.title}</li>)}
    </ul>
  );
}
```

React Router runs the `loader` before rendering the route. If the loader throws, `errorElement` renders instead.

## Test it

1. Open `/tasks` — data loads, no manual loading state needed.
2. Kill `my-api` and refresh — error element renders.
3. Start `my-api` again, refresh — tasks load normally.

## Mini-task
Add a `<Suspense fallback={<Spinner />}>` wrapper around `<Outlet />` in `RootLayout`. React Router's data router integrates with Suspense — the spinner shows while a loader runs.

## Glossary
- **Error Boundary** — class component catching render errors in its subtree; shows fallback.
- **`loader`** — React Router function that fetches data before a route renders.
- **`useLoaderData`** — hook to read the data returned by the route's `loader`.
- **`errorElement`** — React Router fallback rendered when loader or component throws.
- **`createBrowserRouter`** — data-router API enabling loaders/actions; replaces `<BrowserRouter>`.

## Resources
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [React Router — Loaders](https://reactrouter.com/en/main/route/loader)
- [React Router — errorElement](https://reactrouter.com/en/main/route/error-element)

## Checklist
- [ ] `Spinner` and `ErrorMessage` components created
- [ ] `ErrorBoundary` wraps page content in `RootLayout`
- [ ] `createBrowserRouter` + `loader` configured for tasks route
- [ ] `useLoaderData` used in `TasksPage`
- [ ] Killing the API shows `errorElement`, not a crash
- [ ] Mini-task Suspense spinner added
