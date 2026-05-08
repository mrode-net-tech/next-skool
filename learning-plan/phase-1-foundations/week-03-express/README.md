# Week 3 — Express + tests

**Goal:** Build your first HTTP API with Express, validate input with **Zod**, and write integration tests with **Supertest**.

## Days

- [Day 11 — Install Express](./day-11-install-express.md)
- [Day 12 — HTTP client + JSON](./day-12-http-client-json.md)
- [Day 13 — POST + req.body](./day-13-post-req-body.md)
- [Day 14 — Zod validation](./day-14-zod-validation.md)
- [Day 15 — Folder structure + Supertest](./day-15-structure-supertest.md)

## Outcome

A folder `exercises/phase-1/week-03-express/my-api/` with:
- Express server in TypeScript
- `GET /tasks`, `POST /tasks`, `GET /tasks/:id`, `DELETE /tasks/:id`
- Zod-validated request bodies
- A clean folder structure (`routes/`, `controllers/`, `services/`)
- Supertest integration tests (the suite stays green throughout phases 2–8)

> **Important:** the `my-api` project you start this week is the same one you keep extending **all the way through Phase 2** (Weeks 4–8). Don't recreate it later.
