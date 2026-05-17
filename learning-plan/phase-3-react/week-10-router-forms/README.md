# Week 10 — Router + Forms

**Goal:** Add React Router for client-side navigation, build real forms with React Hook Form + Zod validation, and handle loading and error states correctly.

## Days

- [Day 46 — React Router v6](./day-46-react-router.md)
- [Day 47 — Nested routes + layouts](./day-47-nested-routes-layouts.md)
- [Day 48 — React Hook Form](./day-48-react-hook-form.md)
- [Day 49 — Zod resolvers](./day-49-zod-resolvers.md)
- [Day 50 — Loading + error states](./day-50-loading-error-states.md)

## Outcome

`my-web` now has:
- `/login`, `/register`, and `/tasks` routes with a shared authenticated layout
- Navigation between pages without full page reloads
- A login form and a create-task form validated with Zod schemas
- Field-level error messages displayed inline beneath each input
- A reusable `<Spinner>` and `<ErrorMessage>` component for async states
