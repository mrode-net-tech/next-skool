# Day 60 — Theme + dark mode

## Goal
Implement dark mode via Tailwind's `darkMode: 'class'` strategy, build a theme toggle that persists in `localStorage`, and finish Phase 3 with a production-ready `my-web`.

## Estimated time
~1.5 hours

## Prerequisites
Day 59 — polished task page. CSS variables in `index.css`.

## Where to put your code
In `my-web`.

## Explanation

Tailwind's **`darkMode: 'class'`** strategy applies dark styles when the `dark` class is on the `<html>` element. This gives you full control — you decide when to toggle dark mode, not the browser's `prefers-color-scheme` media query (though you can read that too as an initial default).

**CSS custom properties** (variables) are the cleanest way to implement theming: define light and dark values for each token once, then every component using `text-slate-900` automatically gets the right color in both modes. With Tailwind's `dark:` variant you add dark alternatives inline: `className="bg-white dark:bg-slate-900"`.

**`localStorage`** persists the user's preference across sessions. The preference is read before the first render to avoid a flash of wrong theme (FOUC). The trick: read `localStorage` in a `<script>` tag in `index.html` that runs before React hydrates.

## Step-by-step

### 1. Add dark CSS variables to `index.css`

```css name=src/index.css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }

  * { border-color: hsl(var(--border)); }
  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
  }
}
```

### 2. Anti-FOUC script in `index.html`

Add this before `<body>` — it runs synchronously, setting the class before React loads:

```html name=index.html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>my-web</title>
    <script>
      (function () {
        const stored = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (stored === 'dark' || (!stored && prefersDark)) {
          document.documentElement.classList.add('dark');
        }
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 3. Theme context

```tsx name=src/context/ThemeContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggle() {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
```

Wrap in `main.tsx`:

```tsx name=src/main.tsx
import { ThemeProvider } from '@/context/ThemeContext';

// Inside render:
<ThemeProvider>
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
</ThemeProvider>
```

### 4. Theme toggle button in `RootLayout`

```tsx name=src/layouts/RootLayout.tsx
import { useTheme } from '@/context/ThemeContext';

// Inside the nav:
function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="rounded p-1 text-slate-400 hover:text-white transition-colors"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

// Add <ThemeToggle /> to the end of <nav>
```

### 5. Add `dark:` variants to key components

Update `RootLayout`:
```tsx
<div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
```

Update `TasksPage` task list:
```tsx
<ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
```

Update task list item:
```tsx
<Link className="flex-1 text-sm font-medium text-slate-800 hover:text-sky-700 dark:text-slate-200 dark:hover:text-sky-400">
```

Update `Button` variants in `Button.tsx`:
```tsx
secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
ghost: 'hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-400',
```

### 6. Phase 3 final checklist

At this point `my-web` has:
- Vite + React 18 + TypeScript
- React Router v6 with nested layouts
- React Hook Form + Zod validation
- TanStack Query with mutations + optimistic updates + pagination
- msw for test mocking
- Tailwind CSS + shadcn Dialog
- Dark mode with localStorage persistence

```bash
npm run build
npm test
npx tsc --noEmit
```

All three should pass clean.

## Test it

1. Toggle dark mode — page switches, preference persists on refresh.
2. `npm run build` — no errors, CSS bundle < 20KB.
3. `npm test` — all tests green.

## Mini-task
Add `prefers-color-scheme` media query listener so if the user changes their OS theme while the app is open, it updates automatically (use `window.matchMedia(...).addEventListener('change', ...)`).

## Glossary
- **`darkMode: 'class'`** — Tailwind strategy: apply dark styles when `<html class="dark">`.
- **`dark:` variant** — Tailwind prefix for styles active only in dark mode.
- **FOUC** — Flash Of Unstyled Content; prevented by running theme script before React renders.
- **CSS custom property** — `var(--token)` values that change between `:root` and `.dark` rulesets.

## Resources
- [Tailwind — Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [Tailwind — Using CSS Variables](https://tailwindcss.com/docs/customizing-colors#using-css-variables)

## Checklist
- [ ] `.dark` CSS variables defined for all tokens
- [ ] Anti-FOUC script in `index.html`
- [ ] `ThemeProvider` + `useTheme` hook
- [ ] Toggle button in nav persists preference
- [ ] Key components have `dark:` variants
- [ ] `npm run build` + `npm test` + `npx tsc --noEmit` all pass
- [ ] Phase 3 complete — 20 lessons, full working app
