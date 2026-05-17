# Day 82 — App Router + portfolio layout

## Goal
Build the site-wide navigation shell and wire the top-level routes (`/`, `/about`, `/projects`, `/skills`, `/contact`). Understand how nested layouts compose and how to share UI across pages without prop-drilling.

## Estimated time
~1.5 hours

## Prerequisites
Day 81 (`ai-folio` bootstrapped, shadcn/ui initialized).

## Where to put your code
In `ai-folio`.

## Explanation

**Nested layouts** are the App Router's most important concept. `app/layout.tsx` wraps every page. If you add `app/about/layout.tsx`, it wraps only the `/about` subtree — and it renders *inside* the root layout, like nested Blade layouts. You can have as many levels as you need. Each layout receives `children` as a prop; Next.js injects the matching page there.

**Route groups** let you share a layout without affecting the URL. A folder wrapped in `(parentheses)` is invisible in the URL — `app/(marketing)/about/page.tsx` maps to `/about`, not `/marketing/about`. Useful for grouping pages that share a shell (navbar + footer) from pages that don't (the admin area, for example).

**Server Components by default.** Layouts and pages are Server Components unless you add `'use client'`. The `<Navbar>` you'll build today is interactive (mobile menu toggle), so it will be a Client Component. The layout itself stays server-side — only the interactive parts opt in.

In Laravel terms: this is like having `layouts/app.blade.php` for public pages and `layouts/admin.blade.php` for the dashboard, both extending `layouts/base.blade.php`, with the route group corresponding to the controller namespace.

## Step-by-step

### 1. Create route pages (empty shells for now)

```bash
mkdir -p src/app/about src/app/projects src/app/skills src/app/contact
```

```tsx name=src/app/about/page.tsx
export default function AboutPage() {
  return <h1 className="text-3xl font-bold">About</h1>;
}
```

```tsx name=src/app/projects/page.tsx
export default function ProjectsPage() {
  return <h1 className="text-3xl font-bold">Projects</h1>;
}
```

```tsx name=src/app/skills/page.tsx
export default function SkillsPage() {
  return <h1 className="text-3xl font-bold">Skills</h1>;
}
```

```tsx name=src/app/contact/page.tsx
export default function ContactPage() {
  return <h1 className="text-3xl font-bold">Contact</h1>;
}
```

### 2. Navbar component (Client Component — uses state for mobile menu)

```tsx name=src/components/navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/',         label: 'Home' },
  { href: '/about',    label: 'About' },
  { href: '/projects', label: 'Projects' },
  { href: '/skills',   label: 'Skills' },
  { href: '/contact',  label: 'Contact' },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b bg-background">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold">
          ai-folio
        </Link>

        {/* Desktop links */}
        <ul className="hidden gap-6 md:flex">
          {links.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  pathname === href ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Mobile toggle */}
        <button
          className="md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <ul className="flex flex-col gap-2 border-t px-4 py-4 md:hidden">
          {links.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className="block py-1 text-sm font-medium"
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
```

Install the `lucide-react` icon package:

```bash
pnpm add lucide-react
```

### 3. Footer component (Server Component — no interactivity)

```tsx name=src/components/footer.tsx
export function Footer() {
  return (
    <footer className="border-t py-6 text-center text-sm text-muted-foreground">
      © {new Date().getFullYear()} ai-folio · Built with Next.js
    </footer>
  );
}
```

### 4. Update root layout to include Navbar and Footer

```tsx name=src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'ai-folio', template: '%s | ai-folio' },
  description: 'AI-powered portfolio site',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={cn(inter.className, 'flex min-h-screen flex-col')}>
        <Navbar />
        <main className="container mx-auto flex-1 px-4 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

Add the `cn` import at the top:

```tsx
import { cn } from '@/lib/utils';
```

## Test it

```bash
pnpm dev
```

- Visit `/`, `/about`, `/projects`, `/skills`, `/contact` — each shows the navbar and footer.
- On mobile viewport (DevTools), the hamburger menu opens and closes.
- Active link is styled differently from inactive ones.

## Mini-task
Add a "Chat" link to the navbar that will eventually open the chat widget. Point it to `/chat` with a stub page for now.

## Glossary
- **Nested layout** — a `layout.tsx` that wraps only its own subtree, composing inside the parent layout.
- **Route group** — folder in `(parentheses)`; groups routes without adding a URL segment.
- **`usePathname`** — Client Component hook returning the current URL path; used for active-link styling.
- **`'use client'`** — directive that opts a file (and its imports) into client-side React.

## Resources
- [Next.js — Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages)
- [Next.js — Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)
- [Next.js — Link component](https://nextjs.org/docs/app/api-reference/components/link)

## Checklist
- [ ] `/about`, `/projects`, `/skills`, `/contact` pages exist and render
- [ ] `Navbar` is a Client Component with active-link highlighting
- [ ] Mobile hamburger menu opens and closes
- [ ] `Footer` is a Server Component
- [ ] Root layout wraps all pages with Navbar + `<main>` + Footer
- [ ] `pnpm build` passes
