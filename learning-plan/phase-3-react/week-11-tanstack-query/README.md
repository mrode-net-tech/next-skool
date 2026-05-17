# Week 11 — TanStack Query

**Goal:** Replace manual `useEffect` + `useState` data fetching with TanStack Query. Add mutations, optimistic updates, cursor-based pagination, and msw API mocking in tests.

## Days

- [Day 51 — Query basics](./day-51-query-basics.md)
- [Day 52 — Mutations + cache invalidation](./day-52-mutations-invalidation.md)
- [Day 53 — Optimistic updates](./day-53-optimistic-updates.md)
- [Day 54 — Pagination](./day-54-pagination.md)
- [Day 55 — msw for mocking](./day-55-msw-mocking.md)

## Outcome

`my-web` now has:
- All API calls managed by TanStack Query (`useQuery`, `useMutation`)
- Cache invalidated automatically after create / update / delete
- Optimistic task-done toggle: checkbox flips instantly, reverts on error
- Tasks list paginated with a "Load more" button using `useInfiniteQuery`
- msw handlers mocking the `my-api` REST endpoints in Vitest + RTL tests
