# Week 5 — Authentication (JWT)

**Goal:** Add real authentication to `my-api`. Users register with a hashed password, log in to receive a JWT access token, and protected routes verify the token on every request.

## Days

- [Day 21 — bcrypt + POST /auth/register](./day-21-bcrypt-register.md)
- [Day 22 — POST /auth/login returning JWT](./day-22-login-jwt.md)
- [Day 23 — Auth middleware (verify JWT)](./day-23-auth-middleware.md)
- [Day 24 — Protected routes + user-scoped tasks](./day-24-protected-routes.md)
- [Day 25 — Refresh token flow + full Supertest suite](./day-25-refresh-tokens.md)

## Outcome

The `my-api` project now has:
- `POST /auth/register` — creates a user with a bcrypt-hashed password
- `POST /auth/login` — returns a short-lived JWT access token + a refresh token
- `POST /auth/refresh` — exchanges a valid refresh token for a new access token
- `POST /auth/logout` — invalidates the refresh token
- All `GET|POST|PATCH|DELETE /tasks` routes require a valid `Authorization: Bearer <token>` header
- Tasks are scoped to the authenticated user — you can only see and manage your own
