# Day 57 — Utility-first thinking

## Goal
Move beyond basic Tailwind usage: learn `clsx` + `tailwind-merge` for conditional classes, extract reusable component variants, and understand when NOT to use utilities.

## Estimated time
~1.5 hours

## Prerequisites
Day 56 — Tailwind installed and basic classes applied.

## Where to put your code
In `my-web`.

## Explanation

The most common pain point with utility classes is **conditional styling**: `className={done ? 'opacity-50 line-through' : 'opacity-100'}`. This gets unwieldy fast. **`clsx`** is a tiny helper that conditionally joins class names. **`tailwind-merge`** solves the merge conflict problem: if you pass `p-4` from outside and `p-2` inside the component, which wins? Without `tailwind-merge`, both classes land in the DOM and the cascade decides — unpredictably. `tailwind-merge` deduplicates Tailwind classes intelligently, keeping the last one.

**Component variants** are the pattern for building design-system primitives: a `<Button>` that accepts `variant="primary" | "danger" | "ghost"` and applies the right Tailwind classes internally. The **`cva`** (class-variance-authority) library formalises this pattern with TypeScript types.

The Laravel analogy: utility composition is like building SQL queries with the query builder — you assemble each part explicitly. `cva` is like creating Eloquent scopes: named, reusable, typed.

## Step-by-step

### 1. Install helpers

```bash
npm install clsx tailwind-merge class-variance-authority
```

### 2. Create a `cn` utility

```ts name=src/lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Use it everywhere instead of raw string concatenation:

```tsx
// Before
className={`flex items-center gap-3 px-4 py-3 ${task.done ? 'opacity-50' : ''}`}

// After
className={cn('flex items-center gap-3 px-4 py-3', task.done && 'opacity-50')}
```

### 3. Build a `Button` component with `cva`

```tsx name=src/components/ui/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import type { ButtonHTMLAttributes } from 'react';

const buttonVariants = cva(
  // Base classes always applied
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-sky-600 text-white hover:bg-sky-700',
        secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
        danger: 'bg-red-600 text-white hover:bg-red-700',
        ghost: 'hover:bg-slate-100 text-slate-600',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4',
        lg: 'h-10 px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface Props
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: Props) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
```

Usage:
```tsx
<Button variant="primary">Save</Button>
<Button variant="danger" size="sm">Delete</Button>
<Button variant="ghost" size="icon">✕</Button>
```

### 4. Build a reusable `Input` component

```tsx name=src/components/ui/Input.tsx
import { cn } from '@/lib/cn';
import { forwardRef, type InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <input
          ref={ref}
          className={cn(
            'flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {error && (
          <span className="text-xs text-red-600" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
```

`forwardRef` passes the DOM ref through — required when this component is used with React Hook Form's `register` (which needs to set the ref).

Update `NewTaskForm` to use the new `Input` and `Button`:

```tsx
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

// ...
<Input
  id="title"
  {...register('title')}
  error={errors.title?.message}
  placeholder="Task title"
/>
<Button type="submit" disabled={isSubmitting || !isDirty}>
  {isSubmitting ? 'Saving…' : 'Create task'}
</Button>
```

### 5. When to extract a class to a component vs stay in markup

Extract when:
- The same visual pattern repeats 3+ times with the same intent.
- The element has interactive behavior (Button, Input, Modal).

Stay inline when:
- It's structural layout (the flex wrapper around a form row).
- It's a one-off style for a specific page.

Tailwind's `@apply` directive lets you write semantic CSS classes that expand to utilities — but resist using it. It defeats the purpose (you're back to naming things) and is harder to maintain than component extraction.

## Test it

```bash
npm run dev
```

Verify:
- `Button variant="danger"` renders red.
- `Button disabled` shows 50% opacity and ignores clicks.
- `Input` with `error` shows red border + error text.

```bash
npx tsc --noEmit
```

TypeScript should infer valid `variant` and `size` values from `cva` — passing `variant="invalid"` should be a type error.

## Mini-task
Create a `<Badge variant="low" | "medium" | "high">` component using `cva` that shows priority with colored backgrounds. Use it in the task list.

## Glossary
- **`cn`** — helper combining `clsx` (conditional classes) + `tailwind-merge` (conflict resolution).
- **`clsx`** — conditionally joins class strings; ignores falsy values.
- **`tailwind-merge`** — resolves Tailwind class conflicts (last matching wins).
- **`cva`** — class-variance-authority; typed variant API for component primitives.
- **`forwardRef`** — lets a parent pass a `ref` to a child's DOM element.

## Resources
- [clsx](https://github.com/lukeed/clsx)
- [tailwind-merge](https://github.com/dcastil/tailwind-merge)
- [class-variance-authority](https://cva.style/docs)

## Checklist
- [ ] `cn` utility created in `src/lib/cn.ts`
- [ ] All conditional classNames use `cn` instead of string concatenation
- [ ] `Button` component with `variant` + `size` props and TypeScript types
- [ ] `Input` component with `forwardRef` and `error` prop
- [ ] `NewTaskForm` uses `Button` and `Input`
- [ ] `npx tsc --noEmit` catches invalid variant values
