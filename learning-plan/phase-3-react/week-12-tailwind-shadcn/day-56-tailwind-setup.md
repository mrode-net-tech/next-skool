# Day 56 — Tailwind CSS setup

## Goal
Install and configure Tailwind CSS v3 in `my-web`, understand utility-first class composition, and convert the task list to Tailwind-styled markup.

## Estimated time
~1.5 hours

## Prerequisites
Day 55 — `my-web` with msw tests. Node + npm.

## Where to put your code
In `my-web`.

## Explanation

**Tailwind CSS** is a utility-first CSS framework: instead of writing `.card { display: flex; padding: 1rem; }` in a stylesheet, you compose classes directly on elements: `className="flex p-4"`. There is no semantic CSS layer — the utility class IS the style. This eliminates the naming problem (what do I call this div?) and the specificity problem (why is this rule overriding that one?).

The Laravel analogy: if Bootstrap is like Eloquent (you call named methods), Tailwind is like raw SQL builder syntax — you assemble exactly what you need, nothing more. Both produce the same result; Tailwind gives more control at the cost of more classes in markup.

**PurgeCSS (built into Tailwind v3)** scans your source files and removes any unused utility class from the production CSS bundle. A full Tailwind stylesheet is ~3MB; a purged production bundle is typically under 10KB.

JIT (Just-In-Time) mode is the default in Tailwind v3 — classes are generated on-demand as you type them, so you can use arbitrary values like `w-[347px]` and they just work.

## Step-by-step

### 1. Install Tailwind

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

This creates `tailwind.config.js` and `postcss.config.js`.

### 2. Configure content paths

```js name=tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

The `content` array tells Tailwind where to scan for class names. Classes not found here are purged.

### 3. Add Tailwind directives to CSS

```css name=src/index.css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Delete any other content in `index.css` (the Vite default styles). Make sure `main.tsx` imports `'./index.css'`.

### 4. Convert `RootLayout` to Tailwind

```tsx name=src/layouts/RootLayout.tsx
import { NavLink, Outlet } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="bg-slate-800 text-slate-100 px-6 py-3">
        <nav className="flex gap-6 text-sm font-medium">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? 'text-sky-400' : 'text-slate-300 hover:text-white'
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/tasks"
            className={({ isActive }) =>
              isActive ? 'text-sky-400' : 'text-slate-300 hover:text-white'
            }
          >
            Tasks
          </NavLink>
        </nav>
      </header>

      <main className="flex-1 px-6 py-8">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>

      <footer className="px-6 py-3 text-xs text-slate-400 border-t border-slate-200">
        my-web © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
```

### 5. Convert `TasksPage` task list

```tsx name=src/pages/TasksPage.tsx
// (excerpt — inside the return)
<ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
  {tasks.map((task) => (
    <li
      key={task.id}
      className={`flex items-center gap-3 px-4 py-3 ${task.done ? 'opacity-50' : ''}`}
    >
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => toggleTask.mutate({ id: task.id, done: !task.done })}
        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
      />
      <Link
        to={`/tasks/${task.id}`}
        className="flex-1 text-sm text-slate-900 hover:text-sky-700"
      >
        {task.title}
      </Link>
      <button
        onClick={() => deleteTask.mutate(task.id)}
        className="text-slate-400 hover:text-red-500 transition-colors"
      >
        ✕
      </button>
    </li>
  ))}
</ul>
```

### 6. Tailwind class reference (most used)

| Category | Classes |
|---|---|
| Spacing | `p-4`, `px-6`, `py-3`, `mt-4`, `gap-3` |
| Flexbox | `flex`, `items-center`, `justify-between`, `flex-1` |
| Typography | `text-sm`, `font-medium`, `text-slate-900`, `text-sky-400` |
| Colors | `bg-white`, `bg-slate-800`, `border-slate-200` |
| Sizing | `h-4`, `w-4`, `min-h-screen` |
| Effects | `opacity-50`, `transition-colors`, `hover:text-red-500` |
| Border | `rounded-lg`, `border`, `divide-y` |

## Test it

```bash
npm run dev
```

The page should render with proper layout — dark nav header, white card list, hover effects. Check that no CSS file other than `index.css` is loaded (all styles come from Tailwind).

```bash
npm run build
```

Check `dist/assets/*.css` size — should be well under 50KB even with all utilities used.

## Mini-task
Style the `AddTaskForm` with Tailwind: the input should have `border rounded px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none` and the button `bg-sky-600 text-white px-4 py-2 rounded hover:bg-sky-700`.

## Glossary
- **Utility-first** — each class does one thing; compose them to build UI.
- **JIT mode** — Tailwind v3 default; generates classes on-demand, supports arbitrary values.
- **Content array** — paths Tailwind scans to find class names for purging.
- **`divide-y`** — adds `border-bottom` between child elements.
- **`focus:ring`** — adds a focus ring on keyboard focus; important for accessibility.

## Resources
- [Tailwind CSS docs](https://tailwindcss.com/docs)
- [Tailwind — Utility-First Fundamentals](https://tailwindcss.com/docs/utility-first)
- [Tailwind UI Palette](https://tailwindcss.com/docs/customizing-colors)

## Checklist
- [ ] Tailwind + postcss + autoprefixer installed
- [ ] `tailwind.config.js` content paths correct
- [ ] `@tailwind` directives in `index.css`
- [ ] `RootLayout` converted to Tailwind classes
- [ ] Task list styled with card, dividers, hover states
- [ ] `npm run build` produces small CSS bundle
