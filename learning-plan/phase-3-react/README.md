# Phase 3 — React Frontend (Weeks 9–12)

**Goal:** Build `my-web` — a React SPA that consumes the `my-api` backend from Phase 2, tested with RTL + msw, styled with Tailwind and shadcn/ui.

## Outcome at the end of phase 3

You have a working **Task Manager web app** (`my-web`):
- Vite + React 18 + TypeScript project
- React Router v6 with nested layouts and protected routes
- React Hook Form + Zod for client-side form validation
- TanStack Query for server state: fetching, mutations, optimistic updates, pagination
- msw for mocking API responses in tests
- Tailwind CSS + shadcn/ui component library
- Vitest + RTL test suite covering forms and query interactions

## Weeks

| Week | Topic | Folder |
| ---- | ----- | ------ |
| 9 | React basics | [`week-09-react-basics`](./week-09-react-basics/) |
| 10 | Router + forms | [`week-10-router-forms`](./week-10-router-forms/) |
| 11 | TanStack Query | [`week-11-tanstack-query`](./week-11-tanstack-query/) |
| 12 | Tailwind + shadcn/ui | [`week-12-tailwind-shadcn`](./week-12-tailwind-shadcn/) |

## Mindset for a Laravel dev entering this phase

**State lives in JavaScript, not the server.** In Laravel you hit a route, the controller fetches data, and Blade renders HTML — the server owns all state. In React the component tree owns UI state; network calls are asynchronous side effects. TanStack Query is your cache layer between the two worlds.

**Components are functions.** No classes, no lifecycle methods you have to remember. Props go in, JSX comes out. When something changes (user clicks, data arrives), React re-renders only the affected subtree.

**Testing UI is different.** PHP unit tests assert on return values. RTL tests assert on what the *user sees and does* — rendered text, ARIA roles, click events. This is a mindset shift, and it's a good one.
