# Day 81 — create-next-app (ai-folio)

## Goal
Bootstrap `ai-folio` — an AI-powered portfolio site — using Next.js 14 with the App Router, TypeScript, and Tailwind CSS. Understand the folder conventions and how Next.js differs from the Vite+React setup you used in `my-web`.

## Estimated time
~1 hour

## Prerequisites
Days 1–60 complete. Node 18+. `pnpm` installed globally.

## Where to put your code
New top-level project: `ai-folio/` (sibling of `my-api`, `my-web`, `task-manager`).

## Explanation

**Next.js** is a React meta-framework that adds server-side rendering, file-based routing, and — since version 13 — a new **App Router** built on React Server Components. In Laravel terms: Vite+React is a SPA with a separate API (two separate processes, CORS, JWTs); Next.js is more like a full Laravel app where templates and API routes live in the same codebase, some code runs server-side, and you have one unified deployment.

The **App Router** replaces the older Pages Router. Every folder under `app/` is a route segment. Drop a `page.tsx` in a folder and that URL exists. Add a `layout.tsx` and it wraps all children — exactly like a Blade master template that every child view `@extends`.

`create-next-app` scaffolds a project with TypeScript, Tailwind, ESLint, and the App Router pre-configured. Next.js uses a **hybrid rendering model**: by default every component inside `app/` is a **Server Component** — it runs on the server and ships zero JS to the browser. Add `'use client'` at the top of a file to opt into client React. Day 86 goes deep on this — for now just know the distinction exists.

## Step-by-step

### 1. Scaffold the project

```bash
pnpm create next-app@14 ai-folio \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
cd ai-folio
```

### 2. Understand the folder structure

```
ai-folio/
├── src/
│   └── app/
│       ├── layout.tsx        ← root layout (wraps every page)
│       ├── page.tsx          ← home route "/"
│       └── globals.css       ← Tailwind base styles
├── public/                   ← static assets served at "/"
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

There is no `index.html` or `main.tsx` entry point. Next.js generates the HTML; `layout.tsx` is the root.

### 3. Clean up the generated home page

```tsx name=src/app/page.tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold tracking-tight">Hi, I&apos;m [Your Name]</h1>
      <p className="text-lg text-gray-500">Full-stack engineer · Open to work</p>
    </main>
  );
}
```

### 4. Root layout — font and body class

```tsx name=src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ai-folio',
  description: 'AI-powered portfolio',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

`next/font/google` downloads the font at build time and serves it from your domain — no external requests at runtime, no FOUT.

### 5. Initialize shadcn/ui

```bash
pnpm dlx shadcn-ui@latest init
# Choose: Default style, Slate base color, CSS variables: yes
```

This writes `components.json`, updates `tailwind.config.ts`, and adds `src/lib/utils.ts` with the `cn()` helper.

### 6. Run the dev server

```bash
pnpm dev
```

Visit `http://localhost:3000`. You should see your heading.

## Test it

```bash
pnpm dev
# open http://localhost:3000
```

Then do a production build to confirm the scaffold is clean:

```bash
pnpm build
```

Expected: build succeeds, no TypeScript errors, no ESLint errors.

## Mini-task
Add a `src/app/icon.png` (any 32×32 PNG). Next.js picks it up automatically as the browser favicon — no `<link>` tag needed.

## Glossary
- **App Router** — Next.js routing where folders under `app/` define URL segments.
- **Server Component** — React component that runs on the server; ships no JS to the browser.
- **`layout.tsx`** — shared wrapper for all pages in the same folder and below.
- **`next/font`** — build-time font optimization; zero external font requests at runtime.
- **`shadcn/ui`** — copy-paste component library; components live in your repo, not in `node_modules`.

## Resources
- [Next.js — Installation](https://nextjs.org/docs/getting-started/installation)
- [Next.js — Project Structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [shadcn/ui — Next.js install](https://ui.shadcn.com/docs/installation/next)

## Checklist
- [ ] `ai-folio/` created with `create-next-app --app --typescript --tailwind`
- [ ] `src/app/layout.tsx` uses `Inter` from `next/font/google`
- [ ] Home page renders at `http://localhost:3000`
- [ ] `pnpm build` passes with no errors
- [ ] shadcn/ui initialized (`components.json` present)
