# Week 17 — Next.js Basics

**Goal:** Bootstrap `ai-folio` with Next.js 14 App Router. Build the portfolio skeleton: layout, navigation, and all static content pages with proper SEO.

## Days

- [Day 81 — create-next-app (ai-folio)](./day-81-create-next-app.md)
- [Day 82 — App Router + portfolio layout](./day-82-app-router-layout.md)
- [Day 83 — Portfolio sections (About / Projects / Skills)](./day-83-portfolio-sections.md)
- [Day 84 — Loading + error UI](./day-84-loading-error-ui.md)
- [Day 85 — Metadata + SEO](./day-85-metadata-seo.md)

## Outcome

`ai-folio` project with:
- Vite-free Next.js 14 App Router project (`pnpm dev` runs at `localhost:3000`)
- Root layout with `Inter` font, Navbar (Client Component), Footer
- `/about`, `/projects`, `/skills`, `/contact` pages — Server Components with static data
- `loading.tsx` skeleton + `error.tsx` boundary + `not-found.tsx` for every major route
- `metadata` exports on every page; `sitemap.ts` and `robots.ts` auto-generated
- shadcn/ui initialized, `pnpm build` passes
