# Day 55 — msw for API mocking in tests

## Goal
Set up Mock Service Worker (msw) to intercept HTTP requests in tests, write integration tests for components that use TanStack Query, and eliminate network calls from the test suite.

## Estimated time
~2 hours

## Prerequisites
Day 51–54 — TanStack Query hooks in use. Day 45 — Vitest + RTL setup.

## Where to put your code
In `my-web`.

## Explanation

**Mock Service Worker (msw)** intercepts fetch/XHR calls at the network layer using a Service Worker in the browser or Node's `http` module in tests. This is fundamentally different from mocking `fetch` manually — msw lets your component code run exactly as it would in production (same API client, same TanStack Query hooks), but receives fake responses from your handlers instead of a real server.

The benefit over `vi.mock('@/api/tasks', ...)`: you test the full component + API client + TanStack Query pipeline. The only thing you replace is the network response. Bugs in your API client or query key setup are caught; with function mocks they'd be hidden.

The Laravel analogy: it's like using Laravel's `Http::fake()` in tests — you don't hit a real server, but the HTTP client code runs normally.

## Step-by-step

### 1. Install

```bash
npm install -D msw
```

### 2. Create request handlers

```ts name=src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';
import type { Task } from '@/types/task';

const BASE = 'http://localhost:3000';

export const mockTasks: Task[] = [
  { id: '1', title: 'Buy milk', done: false, priority: 1 },
  { id: '2', title: 'Write tests', done: false, priority: 3 },
  { id: '3', title: 'Deploy', done: true, priority: 2 },
];

export const handlers = [
  http.get(`${BASE}/tasks`, () => {
    return HttpResponse.json({
      items: mockTasks,
      nextCursor: null,
    });
  }),

  http.get(`${BASE}/tasks/:id`, ({ params }) => {
    const task = mockTasks.find((t) => t.id === params['id']);
    if (!task) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(task);
  }),

  http.post(`${BASE}/tasks`, async ({ request }) => {
    const body = await request.json() as Partial<Task>;
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: body.title ?? '',
      done: false,
      priority: body.priority ?? 2,
    };
    return HttpResponse.json(newTask, { status: 201 });
  }),

  http.delete(`${BASE}/tasks/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.patch(`${BASE}/tasks/:id`, async ({ params, request }) => {
    const body = await request.json() as Partial<Task>;
    const task = mockTasks.find((t) => t.id === params['id']);
    if (!task) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({ ...task, ...body });
  }),
];
```

### 3. Set up the msw server for Node (Vitest)

```ts name=src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### 4. Start/stop the server in test setup

```ts name=src/test/setup.ts
import '@testing-library/jest-dom';
import { server } from '@/mocks/server';
import { afterAll, afterEach, beforeAll } from 'vitest';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: 'error'` makes any unhandled request fail the test — forces you to declare all needed handlers explicitly.

### 5. Test `TasksPage` with TanStack Query

TanStack Query hooks need `QueryClientProvider` in tests. Create a test wrapper:

```tsx name=src/test/test-utils.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,         // don't retry on errors in tests
        staleTime: Infinity,  // never go stale during a test
      },
    },
  });
}

interface WrapperProps {
  children: ReactNode;
  initialEntries?: string[];
}

export function TestProviders({ children, initialEntries = ['/'] }: WrapperProps) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}
```

### 6. Write `TasksPage` integration tests

```tsx name=src/pages/TasksPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { mockTasks } from '@/mocks/handlers';
import { TasksPage } from './TasksPage';
import { TestProviders } from '@/test/test-utils';

function renderTasksPage() {
  return render(
    <TestProviders initialEntries={['/tasks']}>
      <TasksPage />
    </TestProviders>
  );
}

describe('TasksPage', () => {
  it('shows task titles after loading', async () => {
    renderTasksPage();

    expect(screen.getByRole('status')).toBeInTheDocument(); // spinner

    await waitFor(() => {
      expect(screen.getByText('Buy milk')).toBeInTheDocument();
      expect(screen.getByText('Write tests')).toBeInTheDocument();
    });
  });

  it('shows error when API fails', async () => {
    server.use(
      http.get('http://localhost:3000/tasks', () =>
        HttpResponse.json({ message: 'Server error' }, { status: 500 })
      )
    );

    renderTasksPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 500');
  });

  it('shows empty state when no tasks', async () => {
    server.use(
      http.get('http://localhost:3000/tasks', () =>
        HttpResponse.json({ items: [], nextCursor: null })
      )
    );

    renderTasksPage();

    await waitFor(() => {
      expect(screen.getByText(/0/)).toBeInTheDocument();
    });
  });
});
```

`server.use(...)` inside a test overrides the default handler for that test only. `afterEach(() => server.resetHandlers())` in setup restores defaults.

### 7. Run tests

```bash
npm test
```

Expected: all tests pass. No real network calls are made.

## Test it

```bash
npm test -- --reporter=verbose src/pages/TasksPage.test.tsx
```

## Mini-task
Write a test that adds a task: type in `AddTaskForm`, submit, and assert the new task title appears in the list. The msw POST handler already supports this — use `server.use` to verify the new task appears.

## Glossary
- **msw** — Mock Service Worker; intercepts fetch at the network layer.
- **`setupServer`** — msw function creating a Node HTTP interceptor for Vitest.
- **`server.use`** — overrides handlers for a single test.
- **`server.resetHandlers`** — restores base handlers after each test.
- **`onUnhandledRequest: 'error'`** — fails tests on unexpected network calls.

## Resources
- [msw docs](https://mswjs.io/docs/)
- [msw — Node.js integration](https://mswjs.io/docs/integrations/node)
- [Testing with TanStack Query](https://tanstack.query.gg/docs/framework/react/guides/testing)

## Checklist
- [ ] `msw` installed
- [ ] Handlers defined for GET list, GET detail, POST, DELETE, PATCH
- [ ] `server.listen/resetHandlers/close` wired into Vitest setup
- [ ] `TestProviders` wrapper provides `QueryClient` + `MemoryRouter`
- [ ] `TasksPage` tests: success, error, empty state
- [ ] All tests pass with no real network calls
