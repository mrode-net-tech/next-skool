# Day 49 — Zod resolvers

## Goal
Integrate Zod schemas into React Hook Form via `@hookform/resolvers`, share validation logic between the API and the client, and test form validation with RTL.

## Estimated time
~1.5 hours

## Prerequisites
Day 48 — `NewTaskForm` with RHF. Day 19 — Zod in `my-api`.

## Where to put your code
In `my-web`.

## Explanation

On Day 19 you used Zod in `my-api` to validate request bodies. React Hook Form supports external validators via **resolvers** — adapters that run any validation library and map its output to RHF's error format. `@hookform/resolvers/zod` wraps a Zod schema as an RHF resolver.

The key benefit: **a single Zod schema serves as the source of truth** for both the API (server) and the form (client). When you tighten a rule — say, reducing max title length from 200 to 100 — you change it once in the shared schema and both sides enforce it. In Phase 4 (Day 67) you'll extract these schemas into `packages/types` so both apps import from the same package.

Zod's `.infer<typeof Schema>` replaces manually written TypeScript interface types for form values — the shape is derived from the schema automatically.

## Step-by-step

### 1. Install

```bash
npm install @hookform/resolvers
```

Zod is already installed from Day 41 setup — if not: `npm install zod`.

### 2. Define a shared task schema

```ts name=src/schemas/task.schema.ts
import { z } from 'zod';

export const CreateTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Max 200 characters'),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  done: z.boolean().optional(),
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
```

`z.union([z.literal(1), z.literal(2), z.literal(3)])` matches `my-api`'s schema exactly — same values, same errors.

### 3. Rewrite `NewTaskForm` with Zod resolver

```tsx name=src/components/NewTaskForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateTaskSchema, type CreateTaskInput } from '@/schemas/task.schema';

interface Props {
  onSubmit: (values: CreateTaskInput) => Promise<void>;
  onCancel: () => void;
}

export function NewTaskForm({ onSubmit, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateTaskInput>({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: { title: '', priority: 2 },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          {...register('title')}
          aria-describedby={errors.title ? 'title-error' : undefined}
        />
        {errors.title && (
          <span id="title-error" role="alert">
            {errors.title.message}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="priority">Priority</label>
        <select id="priority" {...register('priority', { valueAsNumber: true })}>
          <option value={1}>Low</option>
          <option value={2}>Medium</option>
          <option value={3}>High</option>
        </select>
        {errors.priority && (
          <span role="alert">{errors.priority.message}</span>
        )}
      </div>

      <button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? 'Saving…' : 'Create task'}
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
```

`valueAsNumber: true` on the select causes RHF to cast the string `"1"/"2"/"3"` to numbers before validation — Zod then sees actual numbers and `z.literal(1)` matches.

### 4. Zod `.superRefine` for cross-field validation

When one field's validity depends on another, use `superRefine`:

```ts name=src/schemas/task.schema.ts
export const DateRangeSchema = z
  .object({
    start: z.string().min(1, 'Start date required'),
    end: z.string().min(1, 'End date required'),
  })
  .superRefine((data, ctx) => {
    if (data.start > data.end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be after start date',
        path: ['end'],
      });
    }
  });
```

RHF maps the `path` to the correct field's `errors` entry.

### 5. Test form validation with RTL

```tsx name=src/components/NewTaskForm.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { NewTaskForm } from './NewTaskForm';

describe('NewTaskForm validation', () => {
  it('shows error when title is empty', async () => {
    render(<NewTaskForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Title is required');
  });

  it('calls onSubmit with correct shape when valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<NewTaskForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/title/i), 'Buy milk');
    await userEvent.click(screen.getByRole('button', { name: /create/i }));

    await vi.waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ title: 'Buy milk', priority: 2 })
    );
  });

  it('enforces max length', async () => {
    render(<NewTaskForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/title/i), 'A'.repeat(201));
    await userEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Max 200 characters');
  });
});
```

```bash
npm test
```

### 6. Keep API + client schemas in sync

Right now schemas are duplicated between `my-api/src/tasks/schemas.ts` and `my-web/src/schemas/task.schema.ts`. This is acceptable during Phase 3. In Phase 4, `packages/types` centralises them — both `my-api` and `my-web` import from the same package.

## Test it

1. Submit the new task form empty — "Title is required" error appears immediately.
2. Type 201 characters — "Max 200 characters" error appears.
3. Fill valid title, submit — form submits without error.

## Mini-task
Add an `EditTaskSchema` that makes `title` optional (for partial edits) and write a test verifying that an empty `EditTaskForm` submission is valid (no errors).

## Glossary
- **resolver** — RHF adapter bridging an external validator (Zod, Yup, etc.) to RHF's error format.
- **`z.infer`** — TypeScript utility extracting the type a Zod schema represents.
- **`valueAsNumber`** — RHF register option; casts the string value to a number before validation.
- **`superRefine`** — Zod method for custom/cross-field validation with full access to the context.
- **`aria-describedby`** — links an input to its error message for screen readers.

## Resources
- [@hookform/resolvers docs](https://github.com/react-hook-form/resolvers)
- [Zod docs](https://zod.dev/)
- [RHF + Zod example](https://react-hook-form.com/get-started#SchemaValidation)

## Checklist
- [ ] `@hookform/resolvers` installed
- [ ] `CreateTaskSchema` in `src/schemas/task.schema.ts`
- [ ] `NewTaskForm` uses `zodResolver`
- [ ] `select` uses `valueAsNumber: true` for numeric priority
- [ ] Error messages come from Zod messages, not RHF rules
- [ ] All three validation tests pass
- [ ] Mini-task `EditTaskSchema` implemented
