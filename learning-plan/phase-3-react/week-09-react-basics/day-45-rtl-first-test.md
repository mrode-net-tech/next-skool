# Day 45 — RTL: first component test

## Goal
Set up Vitest + React Testing Library, write your first component tests, and understand the RTL philosophy: test behavior the user sees, not implementation details.

## Estimated time
~2 hours

## Prerequisites
Day 44 — `my-web` with `TaskCard`, `TaskList`, `AddTaskForm`.

## Where to put your code
In `my-web`.

## Explanation

**React Testing Library (RTL)** renders components into a real (jsdom) DOM and exposes queries that mirror how a user interacts with the page: find by role, label, text — not by CSS class or component name. This philosophy comes from the principle that tests should break when behavior breaks, not when implementation details change.

**Vitest** is Vite's native test runner. It reuses Vite's config (same aliases, same transforms), so TypeScript and JSX just work. The API is Jest-compatible: `describe`, `it`, `expect`.

The Laravel analogy: RTL tests are like Laravel's Dusk browser tests (user-level interactions), not unit tests on a single method. But they run in milliseconds because jsdom simulates the DOM in Node without a real browser.

**`@testing-library/user-event`** simulates realistic user interactions (type, click, tab) with proper event sequences. Prefer it over `fireEvent` for interaction tests.

## Step-by-step

### 1. Install dependencies

```bash
npm install -D vitest @vitest/coverage-v8 jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### 2. Configure Vitest

```ts name=vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
```

### 3. Setup file

```ts name=src/test/setup.ts
import '@testing-library/jest-dom';
```

This extends Vitest's `expect` with matchers like `toBeInTheDocument()`, `toHaveTextContent()`, `toBeChecked()`.

### 4. Add test script to `package.json`

```json name=package.json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "coverage": "vitest run --coverage"
  }
}
```

### 5. First test — `TaskCard`

```tsx name=src/components/TaskCard.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TaskCard } from './TaskCard';
import type { Task } from '@/types/task';

const task: Task = {
  id: 'abc',
  title: 'Write tests',
  done: false,
  priority: 2,
};

describe('TaskCard', () => {
  it('renders the task title', () => {
    render(<TaskCard task={task} onToggle={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Write tests')).toBeInTheDocument();
  });

  it('calls onToggle with task id when checkbox clicked', async () => {
    const onToggle = vi.fn();
    render(<TaskCard task={task} onToggle={onToggle} onDelete={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onToggle).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledWith('abc');
  });

  it('calls onDelete with task id when delete button clicked', async () => {
    const onDelete = vi.fn();
    render(<TaskCard task={task} onToggle={vi.fn()} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole('button', { name: /✕/i }));

    expect(onDelete).toHaveBeenCalledWith('abc');
  });

  it('renders checkbox checked when task is done', () => {
    render(
      <TaskCard task={{ ...task, done: true }} onToggle={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
```

### 6. Test — `AddTaskForm`

```tsx name=src/components/AddTaskForm.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AddTaskForm } from './AddTaskForm';

describe('AddTaskForm', () => {
  it('calls onAdd with trimmed title on submit', async () => {
    const onAdd = vi.fn();
    render(<AddTaskForm onAdd={onAdd} />);

    await userEvent.type(screen.getByPlaceholderText(/new task/i), '  Buy milk  ');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(onAdd).toHaveBeenCalledWith('Buy milk');
  });

  it('clears the input after submit', async () => {
    render(<AddTaskForm onAdd={vi.fn()} />);
    const input = screen.getByPlaceholderText(/new task/i);

    await userEvent.type(input, 'Some task');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(input).toHaveValue('');
  });

  it('does not call onAdd when input is blank', async () => {
    const onAdd = vi.fn();
    render(<AddTaskForm onAdd={onAdd} />);

    await userEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(onAdd).not.toHaveBeenCalled();
  });
});
```

### 7. Run tests

```bash
npm test
```

Expected output:
```
✓ src/components/TaskCard.test.tsx (4)
✓ src/components/AddTaskForm.test.tsx (3)

Test Files  2 passed (2)
Tests       7 passed (7)
```

### 8. Key RTL queries reference

| Query | Finds by | Use when |
|---|---|---|
| `getByRole` | ARIA role | buttons, inputs, headings — prefer this |
| `getByText` | visible text | paragraphs, labels |
| `getByPlaceholderText` | placeholder | inputs without a label |
| `getByLabelText` | `<label>` or `aria-label` | form fields |
| `findBy*` | async version | waits for element to appear |
| `queryBy*` | doesn't throw | asserting element is absent |

Rule: prefer `getByRole` — it's the most robust and closest to how assistive technology works.

## Test it

```bash
npm test -- --reporter=verbose
```

All 7 tests green. Change a test assertion to confirm failures work as expected.

## Mini-task
Add a test that renders `TaskList` with two tasks and asserts both titles appear. Then add a test asserting the "No tasks yet." message renders when the list is empty.

## Glossary
- **RTL** — React Testing Library; queries the DOM from a user's perspective.
- **jsdom** — browser-like DOM environment that runs in Node.
- **vi.fn()** — Vitest mock function; tracks calls and arguments.
- **getByRole** — RTL query using ARIA roles; most semantic and recommended.
- **userEvent** — simulates realistic browser interactions (fires full event sequence).

## Resources
- [Testing Library — Core queries](https://testing-library.com/docs/queries/byrole)
- [Vitest docs](https://vitest.dev/guide/)
- [Common mistakes with RTL](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Checklist
- [ ] Vitest + RTL + jsdom installed and configured
- [ ] `src/test/setup.ts` imports `@testing-library/jest-dom`
- [ ] `TaskCard` tests: render, toggle, delete, done state
- [ ] `AddTaskForm` tests: submit, clear, blank guard
- [ ] All tests pass with `npm test`
- [ ] Mini-task `TaskList` tests written and passing
