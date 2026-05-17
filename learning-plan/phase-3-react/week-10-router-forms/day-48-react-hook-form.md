# Day 48 — React Hook Form

## Goal
Replace the manual controlled-input form with React Hook Form (RHF), understand register/handleSubmit/formState, and manage a multi-field form correctly.

## Estimated time
~1.5 hours

## Prerequisites
Day 47 — nested routes working. Familiarity with `useState` controlled inputs.

## Where to put your code
In `my-web`.

## Explanation

**React Hook Form** manages form state outside React's render cycle — via refs, not `useState`. This means inputs don't cause re-renders on every keystroke, which matters for large forms. The Laravel analogy: it's like having a `FormRequest` that validates on submit and reports errors per field, but running entirely in the browser.

The core API is three things from `useForm`:
- **`register`** — connects an input to RHF. Pass the returned `ref` + event handlers to the input.
- **`handleSubmit`** — wraps your submit handler; it validates first and only calls your function if valid.
- **`formState`** — reactive object with `errors`, `isSubmitting`, `isDirty`, `isValid`.

RHF uses **uncontrolled inputs** by default (the DOM owns the value) but exposes a `Controller` wrapper for cases where a third-party component needs a `value` prop (e.g., shadcn Select, Datepicker). You'll use `Controller` on Day 58.

## Step-by-step

### 1. Install

```bash
npm install react-hook-form
```

### 2. Replace `AddTaskForm` with RHF

```tsx name=src/components/AddTaskForm.tsx
import { useForm } from 'react-hook-form';

interface FormValues {
  title: string;
}

interface Props {
  onAdd: (title: string) => Promise<void>;
}

export function AddTaskForm({ onAdd }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { title: '' },
  });

  async function onSubmit(data: FormValues) {
    await onAdd(data.title.trim());
    reset();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <input
          {...register('title', {
            required: 'Title is required',
            minLength: { value: 1, message: 'Title cannot be blank' },
            maxLength: { value: 200, message: 'Title too long' },
          })}
          placeholder="New task..."
        />
        {errors.title && <span role="alert">{errors.title.message}</span>}
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Adding...' : 'Add'}
      </button>
    </form>
  );
}
```

`register('title', rules)` returns `{ name, ref, onChange, onBlur }`. The spread `{...register(...)}` passes all of them to the input at once.

### 3. A full `NewTaskForm` with multiple fields

```tsx name=src/components/NewTaskForm.tsx
import { useForm } from 'react-hook-form';
import type { Task } from '@/types/task';

interface FormValues {
  title: string;
  priority: '1' | '2' | '3'; // HTML selects return strings
}

interface Props {
  onSubmit: (values: { title: string; priority: 1 | 2 | 3 }) => Promise<void>;
  onCancel: () => void;
}

export function NewTaskForm({ onSubmit, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    defaultValues: { title: '', priority: '2' },
  });

  async function handleValid(data: FormValues) {
    await onSubmit({
      title: data.title.trim(),
      priority: Number(data.priority) as 1 | 2 | 3,
    });
  }

  return (
    <form onSubmit={handleSubmit(handleValid)}>
      <div>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          {...register('title', {
            required: 'Title is required',
            maxLength: { value: 200, message: 'Max 200 characters' },
          })}
        />
        {errors.title && <span role="alert">{errors.title.message}</span>}
      </div>

      <div>
        <label htmlFor="priority">Priority</label>
        <select id="priority" {...register('priority')}>
          <option value="1">Low</option>
          <option value="2">Medium</option>
          <option value="3">High</option>
        </select>
      </div>

      <button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? 'Saving...' : 'Create task'}
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
```

Note: `!isDirty` keeps the submit button disabled until the user changes something — good UX for edit forms.

### 4. Use `NewTaskForm` in `NewTaskPage`

```tsx name=src/pages/NewTaskPage.tsx
import { useNavigate } from 'react-router-dom';
import { NewTaskForm } from '@/components/NewTaskForm';
import { createTask } from '@/api/tasks';

export function NewTaskPage() {
  const navigate = useNavigate();

  async function handleSubmit(values: { title: string; priority: 1 | 2 | 3 }) {
    await createTask(values.title, values.priority);
    navigate('/tasks');
  }

  return (
    <div>
      <h2>New Task</h2>
      <NewTaskForm onSubmit={handleSubmit} onCancel={() => navigate('/tasks')} />
    </div>
  );
}
```

Update `src/api/tasks.ts` `createTask` to accept priority:

```ts name=src/api/tasks.ts
export async function createTask(title: string, priority = 2): Promise<Task> {
  const res = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, priority }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Task>;
}
```

## Test it

Update `AddTaskForm.test.tsx` — errors and isSubmitting behavior:

```tsx name=src/components/AddTaskForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AddTaskForm } from './AddTaskForm';

describe('AddTaskForm', () => {
  it('shows error when submitted with empty input', async () => {
    render(<AddTaskForm onAdd={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Title is required');
  });

  it('calls onAdd and resets after valid submit', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddTaskForm onAdd={onAdd} />);

    await userEvent.type(screen.getByPlaceholderText(/new task/i), 'Buy milk');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('Buy milk'));
    expect(screen.getByPlaceholderText(/new task/i)).toHaveValue('');
  });
});
```

```bash
npm test
```

## Mini-task
Add an `edit` form for an existing task. Pre-populate `defaultValues` from the task prop. The form should only be submittable when `isDirty` (the user changed something).

## Glossary
- **`register`** — connects a native input to RHF; returns `ref + event handlers`.
- **`handleSubmit`** — validates then calls your function; blocks submit on errors.
- **`formState.errors`** — per-field error map, populated by validation rules.
- **`isDirty`** — true when any field value differs from `defaultValues`.
- **`isSubmitting`** — true while the async submit handler is running.

## Resources
- [React Hook Form docs](https://react-hook-form.com/)
- [RHF — useForm API](https://react-hook-form.com/docs/useform)
- [RHF — Validation rules](https://react-hook-form.com/docs/useform/register)

## Checklist
- [ ] `react-hook-form` installed
- [ ] `AddTaskForm` uses RHF with validation
- [ ] Validation error renders when title empty
- [ ] `isSubmitting` disables button while request runs
- [ ] `NewTaskForm` has title + priority fields
- [ ] `NewTaskPage` navigates to `/tasks` on success
- [ ] Tests pass with `npm test`
