# Week 20 — MVP Polish + Deploy

**Goal:** Complete the `ai-folio` MVP. Add email notifications, live GitHub project data, admin analytics, AI draft replies — then ship to production on Vercel + Neon.

## Days

- [Day 96 — Email notifications (Resend)](./day-96-email-notifications.md)
- [Day 97 — GitHub API integration (auto-pull projects)](./day-97-github-api.md)
- [Day 98 — Analytics tab](./day-98-analytics-tab.md)
- [Day 99 — AI draft-reply feature](./day-99-ai-draft-reply.md)
- [Day 100 — MVP polish + production deploy](./day-100-mvp-polish-deploy.md)

## Outcome

`ai-folio` is live in production:
- High-value leads (score >= 4) trigger an HTML email via Resend with the full transcript and admin link
- `/projects` pulls live data from the GitHub API, merged with pinned metadata, cached 1 hour via ISR
- `/admin/analytics` shows conversations per day, intent distribution, and score histogram via Recharts
- Admin conversation detail has a "Generate draft reply" button — Claude streams an editable reply via `useCompletion`
- Deployed to Vercel + Neon (serverless Postgres + pgvector); all smoke tests passing
- Phase 5 complete — `ai-folio` is your live, AI-powered portfolio
