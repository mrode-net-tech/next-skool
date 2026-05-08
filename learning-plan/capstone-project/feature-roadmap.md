# Habit Tracker — feature roadmap

Features are listed in the **order you build them**. Don't skip ahead.

## MVP — Phase 5 (Weeks 17–20)

1. **Auth (email + password)** — sign up, log in, log out via Auth.js.
2. **Create / edit / delete habits** — name, frequency (daily/weekly), color, icon.
3. **Mark habit done for today** — one click; idempotent per day.
4. **Streak per habit** — number of consecutive completed days.
5. **Weekly grid view** — Mon–Sun grid of done/not done per habit.
6. **Dashboard** — today's habits, with a one-click "done" button.
7. **Settings page** — change name, change password.

**Definition of done for MVP:** Deployed to Vercel, real Postgres on Railway, you can sign up with a fresh account and log a habit.

## Production — Phase 6 (Weeks 21–24)

8. **Dockerized** — web app and worker have Dockerfiles, `docker-compose` for local dev.
9. **CI pipeline** — GitHub Actions runs lint, typecheck, tests on each PR.
10. **Auto-deploy** — merging to `main` deploys to Vercel + Railway.
11. **BullMQ + Redis** — background queue running in a separate worker.
12. **Daily reminder email** — every morning the worker emails users about today's habits.
13. **Habit categories** — group habits, filter dashboard by category.
14. **Statistics page** — charts (recharts) for completion rate per habit.
15. **Achievements** — unlock badges (e.g. 7-day streak, 30-day streak).
16. **Cover image upload** — each habit has an optional image (S3 or local in dev).
17. **Sentry** — errors from web and worker tracked in production.
18. **OpenAPI docs** — reference REST endpoints documented in Swagger UI.

## Future ideas — post-plan

- **Stripe subscriptions** — "Pro" tier with unlimited habits and richer analytics.
- **Social features** — friends, shared habits, leaderboards.
- **Mobile app** — React Native or Expo.
- **AI insights** — weekly summary generated from completion patterns.
- **Integrations** — Google Calendar, Apple Health.
