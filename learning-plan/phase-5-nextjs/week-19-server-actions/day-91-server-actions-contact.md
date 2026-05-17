# Day 91 — Server Actions (contact form)

## Goal
Build the contact form using Next.js Server Actions — functions that run on the server and are called directly from Client Components without writing a Route Handler. Understand how Server Actions replace the classic `fetch → API route → handler` pattern for form submissions.

## Estimated time
~2 hours

## Prerequisites
Day 90 (chat widget + RAG working). Prisma and DB running.

## Where to put your code
In `ai-folio`.

## Explanation

**Server Actions** are async functions marked `'use server'`. Next.js turns them into encrypted POST endpoints automatically — you never write the Route Handler. A Client Component can call a Server Action directly: import the function, pass it to a `<form action={...}>`, and Next.js handles the serialisation, the network call, and the response.

In Laravel terms: a Server Action is like a Form Request + Controller method merged into one function, wired directly to the form's submit handler — no explicit route definition, no CSRF token management (Next.js handles it), and the function runs in the server process.

The `useActionState` hook (React 19 / Next.js 14 has `useFormState` from `react-dom`) manages action state: pending, errors, and the return value. `useFormStatus` gives you a `pending` boolean inside the form for disabling the submit button while the action runs.

**Why use Server Actions instead of a Route Handler?**
- No boilerplate: no `fetch()`, no JSON serialisation, no status codes.
- Form data arrives already parsed.
- Validation errors returned as plain objects — no `Response.json(...)`.
- Works with progressive enhancement: the form works even without JavaScript.

## Step-by-step

### 1. Contact form Server Action

```ts name=src/app/contact/actions.ts
'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';

const ContactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000),
});

export interface ContactFormState {
  success: boolean;
  errors?: {
    name?: string[];
    email?: string[];
    message?: string[];
    root?: string[];
  };
}

export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const raw = {
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
  };

  const parsed = ContactSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    // Store in DB for admin visibility (optional — remove if you only want email)
    await prisma.conversation.create({
      data: {
        sessionId: `contact-form-${Date.now()}`,
        intent: 'general_question',
        visitorEmail: parsed.data.email,
        messages: {
          create: {
            role: 'user',
            content: `Contact form submission from ${parsed.data.name} (${parsed.data.email}):\n\n${parsed.data.message}`,
          },
        },
      },
    });

    return { success: true };
  } catch {
    return {
      success: false,
      errors: { root: ['Failed to send message. Please try again.'] },
    };
  }
}
```

### 2. Contact form Client Component

```tsx name=src/app/contact/contact-form.tsx
'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { submitContactForm, type ContactFormState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Sending…' : 'Send message'}
    </Button>
  );
}

const initialState: ContactFormState = { success: false };

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactForm, initialState);

  if (state.success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <p className="font-medium text-green-800">Message sent! I&apos;ll be in touch soon.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.errors?.root && (
        <p className="text-sm text-red-500">{state.errors.root[0]}</p>
      )}

      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
        {state.errors?.name && (
          <p className="text-xs text-red-500">{state.errors.name[0]}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
        {state.errors?.email && (
          <p className="text-xs text-red-500">{state.errors.email[0]}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" name="message" rows={5} required />
        {state.errors?.message && (
          <p className="text-xs text-red-500">{state.errors.message[0]}</p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
```

Add shadcn components:

```bash
pnpm dlx shadcn-ui@latest add textarea label
```

### 3. Contact page (Server Component shell)

```tsx name=src/app/contact/page.tsx
import type { Metadata } from 'next';
import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch.',
};

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-lg">
      <h1 className="mb-2 text-3xl font-bold">Get in touch</h1>
      <p className="mb-8 text-muted-foreground">
        Fill in the form and I&apos;ll reply within 24 hours.
      </p>
      <ContactForm />
    </section>
  );
}
```

### 4. Understand the `useActionState` signature

```ts
const [state, formAction, isPending] = useActionState(
  action,       // (prevState, formData) => Promise<State>
  initialState, // State
);
```

- `state` — whatever the action returned last (or `initialState` before first submit).
- `formAction` — pass this to `<form action={formAction}>`.
- `isPending` — `true` while the action is running (alternative to `useFormStatus`).

The action receives `formData` as a native `FormData` object — `formData.get('name')` returns the raw string. Zod validates and narrows the type.

## Test it

```bash
pnpm dev
```

1. Visit `http://localhost:3000/contact`.
2. Submit with empty fields — see validation errors appear without a page reload.
3. Submit with valid data — see the success message.
4. Check `Conversation` table in the DB: `npx prisma studio`.

## Mini-task
Add a `revalidatePath('/admin')` call inside the action after the DB write (import from `next/cache`). This tells Next.js to re-render the admin conversations list next time it's visited, showing the new contact message immediately.

## Glossary
- **Server Action** — `'use server'` async function; called from a form or Client Component; runs on the server.
- **`useActionState`** — React hook that manages a Server Action's return value across submissions.
- **`useFormStatus`** — hook inside a form component that reads the parent form's pending state.
- **Progressive enhancement** — the form works without JavaScript because `<form action={serverAction}>` degrades to a standard HTML form POST.

## Resources
- [Next.js — Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [React — `useActionState`](https://react.dev/reference/react/useActionState)
- [React — `useFormStatus`](https://react.dev/reference/react-dom/hooks/useFormStatus)

## Checklist
- [ ] `submitContactForm` is a `'use server'` action in `contact/actions.ts`
- [ ] Zod validation returns field-level errors
- [ ] `ContactForm` is a Client Component using `useActionState`
- [ ] Submit button shows "Sending…" while pending (via `useFormStatus`)
- [ ] Success state shows confirmation message (no page reload)
- [ ] Submission creates a `Conversation` row in the DB
- [ ] `pnpm build` passes
