# Day 100 — MVP polish + production deploy

## Goal
Polish the `ai-folio` MVP, fix any rough edges, and ship to production: Postgres on Neon (serverless, generous free tier), Next.js on Vercel. By end of day you have a real URL to share.

## Estimated time
~3 hours

## Prerequisites
Days 81–99 complete. GitHub repo for `ai-folio`. Vercel account (free). Neon account (free at neon.tech).

## Where to put your code
In `ai-folio`. Mostly config and small fixes — no major new feature code.

## Explanation

**Neon** is a serverless Postgres with a pgvector extension available. Free tier: 0.5 GB storage, auto-pause (DB sleeps after inactivity — wakes in ~2s). Perfect for a portfolio site with low traffic. Connection string looks like a normal Postgres URL; Prisma connects identically.

**Vercel** deploys Next.js with zero config — it auto-detects Next.js, runs `pnpm build`, and serves the output. Environment variables are set in the Vercel dashboard. Each push to `main` triggers a deploy. Preview URLs are created for every PR.

**Polishing checklist** before shipping: TypeScript errors (`pnpm typecheck`), ESLint warnings (`pnpm lint`), missing `alt` attributes, broken links, mobile layout issues, missing `loading.tsx` on any slow page, console errors in the browser.

In Laravel terms: this is like running `php artisan optimize`, setting `APP_ENV=production` in `.env`, and deploying to Forge — except Vercel handles the server setup and Neon handles the DB provisioning automatically.

## Step-by-step

### 1. Pre-deploy checklist

Run these locally and fix all errors before pushing:

```bash
# Type checking
pnpm typecheck

# Lint
pnpm lint

# Production build (catches build-time errors)
pnpm build

# Start production server locally
pnpm start
```

Common issues to fix:
- `'use client'` missing on any component using hooks
- `alt=""` missing on `<img>` tags (use `alt=""` for decorative images)
- `async` Server Components returning void instead of JSX
- Prisma types not matching after schema changes

### 2. Set up Neon (serverless Postgres + pgvector)

1. Create account at neon.tech → New project.
2. Copy the connection string (looks like `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`).
3. In the Neon SQL editor, enable pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

4. Run Prisma migrations against Neon:

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

`migrate deploy` (not `migrate dev`) — applies pending migrations without creating new ones. Use this in CI and for production deploys.

5. Seed embeddings against the production DB:

```bash
DATABASE_URL="postgresql://..." pnpm seed:embeddings
```

### 3. Create the admin user in production

```bash
DATABASE_URL="postgresql://..." ADMIN_EMAIL=you@yourdomain.com ADMIN_PASSWORD=strongpassword123 npx tsx scripts/create-admin.ts
```

### 4. Generate a production Auth.js secret

```bash
openssl rand -hex 32
# Copy the output — this is AUTH_SECRET
```

### 5. Push code to GitHub

```bash
git add .
git commit -m "feat: ai-folio MVP complete"
git push origin main
```

### 6. Deploy to Vercel

1. Go to vercel.com → New project → Import from GitHub → select `ai-folio`.
2. Vercel detects Next.js automatically. Click "Deploy" — it will fail (missing env vars). That's expected.
3. Go to project settings → Environment Variables. Add all of these:

```
DATABASE_URL              = postgresql://... (Neon connection string)
AUTH_SECRET               = (the openssl output from step 4)
AUTH_URL                  = https://your-vercel-domain.vercel.app
AUTH_TRUST_HOST           = true
ANTHROPIC_API_KEY         = sk-ant-...
OPENAI_API_KEY            = sk-...
RESEND_API_KEY            = re_...
ADMIN_EMAIL               = you@yourdomain.com
RESEND_FROM               = onboarding@resend.dev  # until domain verified
GITHUB_USERNAME           = your-github-username
NEXT_PUBLIC_BASE_URL      = https://your-vercel-domain.vercel.app
```

4. Redeploy: Deployments → "Redeploy" on the failed deployment.
5. Build succeeds. Visit your Vercel URL.

### 7. Custom domain (optional)

Vercel project settings → Domains → Add domain. Add the DNS records Vercel provides to your domain registrar. Takes ~10 minutes to propagate.

Update env vars:
- `AUTH_URL` → `https://yourdomain.com`
- `NEXT_PUBLIC_BASE_URL` → `https://yourdomain.com`

Redeploy after updating env vars.

### 8. Smoke test production

Walk through every flow after deploy:

```
✅ Home page loads
✅ /about, /projects, /skills, /contact render
✅ /projects pulls from GitHub API (check real repos appear)
✅ Chat widget opens and sends a message
✅ Claude responds with CV context
✅ /admin/login works (use the credentials from step 3)
✅ /admin/conversations shows conversations from production
✅ /admin/kanban shows cards
✅ /admin/analytics renders charts
✅ Draft reply generates
✅ Email notification sent for high-score lead
```

### 9. Polish: dark mode meta tag

Add the `color-scheme` meta tag for proper dark mode on mobile browsers:

```tsx name=src/app/layout.tsx
// Add to the <html> tag:
<html lang="en" suppressHydrationWarning>
```

And update Tailwind config to support dark mode via class strategy (done on Day 60 in `my-web` — apply the same pattern here).

### 10. Polish: error tracking stub (Phase 6)

Add a comment in `src/app/global-error.tsx` so you don't forget:

```tsx name=src/app/global-error.tsx
'use client';

// Sentry integration added in Phase 6 (Day 116)
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <button onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  );
}
```

## Test it

After deploy:

```bash
# Test the public chat API against production
curl -X POST https://your-vercel-domain.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What stack do you use?"}],"sessionId":"test-123"}' \
  --no-buffer
```

Expect: streaming SSE response with CV-grounded answer.

## Final checklist for Phase 5

- [ ] `pnpm typecheck` passes — zero TypeScript errors
- [ ] `pnpm lint` passes — zero ESLint errors
- [ ] `pnpm build` passes locally
- [ ] Neon database provisioned with pgvector extension
- [ ] Prisma migrations applied to production DB
- [ ] Embeddings seeded in production
- [ ] All env vars set in Vercel dashboard
- [ ] Vercel deploy succeeds — green build
- [ ] All smoke tests pass on production URL
- [ ] `global-error.tsx` exists (stub for Phase 6 Sentry)
- [ ] Share the URL — Phase 5 complete 🎉

## Glossary
- **Neon** — serverless Postgres with pgvector support; free tier; auto-pause; connection string is a standard Postgres URL.
- **`prisma migrate deploy`** — applies pending migrations in production; does not generate new ones.
- **`AUTH_TRUST_HOST`** — Auth.js flag required when deploying to platforms that may report a different host; always set to `true` on Vercel.
- **ISR (Incremental Static Regeneration)** — Next.js mode: statically generated at build, refreshed in background after `revalidate` interval.
- **Smoke test** — minimal manual test of critical paths after deploy; confirms nothing catastrophically broken.

## Resources
- [Neon — Getting started](https://neon.tech/docs/get-started-with-neon/signing-up)
- [Neon — pgvector](https://neon.tech/docs/extensions/pgvector)
- [Vercel — Next.js deployment](https://vercel.com/docs/frameworks/nextjs)
- [Auth.js — Deployment](https://authjs.dev/getting-started/deployment)
- [Prisma — Deploy migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/applying-pending-migrations)
