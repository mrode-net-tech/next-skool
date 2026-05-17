# Week 15 — Auth Integration

**Goal:** Wire the JWT authentication from `apps/api` into `apps/web` end-to-end: login form → token storage → protected routes → 401 handling with silent refresh → logout.

## Days

- [Day 71 — Login flow end-to-end](./day-71-login-flow-e2e.md)
- [Day 72 — Token storage tradeoffs](./day-72-token-storage.md)
- [Day 73 — Protected routes (web)](./day-73-protected-routes.md)
- [Day 74 — 401 handling + silent refresh](./day-74-401-handling-refresh.md)
- [Day 75 — Logout](./day-75-logout.md)

## Outcome

`task-manager` now has:
- Login form POSTs credentials to `apps/api`, receives access + refresh tokens
- Access token stored in memory (or httpOnly cookie); refresh token in httpOnly cookie
- React Router `<ProtectedRoute>` redirects unauthenticated users to `/login`
- Axios (or fetch) interceptor silently refreshes the access token on 401
- Logout clears tokens and redirects to `/login`
- All task CRUD routes in the web app work end-to-end with a real authenticated user
