# Day 58 — shadcn/ui setup

## Goal
Install shadcn/ui into `my-web`, understand how it differs from a component library, add Dialog and Select components, and integrate them with React Hook Form.

## Estimated time
~2 hours

## Prerequisites
Day 57 — `cn` utility, `cva` Button/Input, Tailwind v3 configured.

## Where to put your code
In `my-web`.

## Explanation

**shadcn/ui** is not a library you install as a dependency — it's a CLI that **copies component source code** into your project. Each component lands in `src/components/ui/` as a `.tsx` file you own. This is radical: you can read and modify every line, there's no hidden black-box, and there's no version mismatch to manage.

Under the hood, shadcn components use **Radix UI** (unstyled, accessible primitives) for behaviour (focus management, ARIA, keyboard navigation) and Tailwind for styling. Radix's Dialog, DropdownMenu, Select etc. handle all the accessibility work that's easy to miss: focus trapping, `aria-modal`, `Escape` to close, roving tabindex in lists.

The Laravel analogy: shadcn is like `php artisan make:model` — the CLI generates code into your project; the generated code is yours to modify. A traditional component library like MUI is more like a Composer package you don't touch.

## Step-by-step

### 1. Add required shadcn dependencies

shadcn's CLI will install what it needs, but first set up the `tsconfig.json` path alias `@` (already done on Day 41) and add `tailwindcss-animate`:

```bash
npm install tailwindcss-animate
npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-label lucide-react
```

Update `tailwind.config.js`:

```js name=tailwind.config.js
import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
    },
  },
  plugins: [animate],
};
```

Add CSS variables to `index.css`:

```css name=src/index.css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}

* {
  border-color: hsl(var(--border));
}

body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}
```

### 2. Add shadcn `Dialog` component manually

Create the component (this is what the shadcn CLI would generate):

```tsx name=src/components/ui/dialog.tsx
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

function DialogOverlay({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  );
}

function DialogContent({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg',
          className
        )}
        {...props}
      >
        {children}
        <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5', className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title className={cn('text-lg font-semibold', className)} {...props} />
  );
}

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose };
```

### 3. Add `Label` component

```tsx name=src/components/ui/label.tsx
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/cn';

function Label({ className, ...props }: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
      {...props}
    />
  );
}

export { Label };
```

### 4. Use Dialog to create "New Task" modal

```tsx name=src/pages/TasksPage.tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { NewTaskForm } from '@/components/NewTaskForm';

// Inside TasksPage return:
<div className="mb-4 flex items-center justify-between">
  <h2 className="text-xl font-semibold">Tasks</h2>
  <Dialog>
    <DialogTrigger asChild>
      <Button size="sm">+ New task</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create a new task</DialogTitle>
      </DialogHeader>
      <NewTaskForm
        onSubmit={async (values) => {
          await createTask.mutateAsync(values);
        }}
        onCancel={() => {/* close dialog */}}
      />
    </DialogContent>
  </Dialog>
</div>
```

### 5. Integrate `Select` with React Hook Form via `Controller`

Radix's `Select` is not a native `<select>` element, so RHF's `register` won't work. Use `Controller`:

```tsx name=src/components/NewTaskForm.tsx
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Select from '@radix-ui/react-select';
import { ChevronDown } from 'lucide-react';
import { CreateTaskSchema, type CreateTaskInput } from '@/schemas/task.schema';

// In the form:
<Controller
  control={control}
  name="priority"
  render={({ field }) => (
    <Select.Root
      value={String(field.value)}
      onValueChange={(val) => field.onChange(Number(val))}
    >
      <Select.Trigger className="flex h-9 items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
        <Select.Value />
        <ChevronDown className="h-4 w-4 opacity-50" />
      </Select.Trigger>
      <Select.Content className="z-50 rounded-md border bg-white shadow-md">
        <Select.Item value="1" className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-100">Low</Select.Item>
        <Select.Item value="2" className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-100">Medium</Select.Item>
        <Select.Item value="3" className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-100">High</Select.Item>
      </Select.Content>
    </Select.Root>
  )}
/>
```

## Test it

1. Click "+ New task" — modal opens with focus inside.
2. Press `Escape` — modal closes (Radix handles this).
3. Tab through the form fields — focus order is correct.
4. Submit — task created, modal closes.

## Mini-task
Wire the Dialog's `open` state so it closes automatically after a successful `createTask` mutation. Use a `useState<boolean>` for `open` and pass it to `<Dialog open={open} onOpenChange={setOpen}>`.

## Glossary
- **shadcn/ui** — CLI that copies Radix + Tailwind component source into your project.
- **Radix UI** — unstyled, accessible primitive components (handles ARIA, focus, keyboard).
- **`Controller`** — RHF wrapper for controlled third-party components that need `value` + `onChange`.
- **`asChild`** — Radix prop that merges its behaviour onto the child component instead of adding a DOM element.
- **CSS variables** — `hsl(var(--primary))` allows dynamic theming without Tailwind config changes.

## Resources
- [shadcn/ui docs](https://ui.shadcn.com/)
- [Radix UI — Dialog](https://www.radix-ui.com/primitives/docs/components/dialog)
- [RHF — Controller](https://react-hook-form.com/docs/usecontroller/controller)

## Checklist
- [ ] Tailwind CSS variables added to `index.css`
- [ ] `Dialog` component created from Radix primitives
- [ ] `Label` component created
- [ ] "+ New task" button opens Dialog modal
- [ ] Dialog closes on `Escape` (Radix default)
- [ ] `Select` for priority uses `Controller`
- [ ] Mini-task: Dialog closes after successful mutation
