# Day 79 — Deploy web (Vercel)

## Goal
Deploy `apps/web` to Vercel, configure the `VITE_API_URL` environment variable to point to the production API, and verify the full production stack works end-to-end.

## Estimated time
~1.5 hours

## Prerequisites
Day 78 — `apps/api` deployed to Railway with a live URL.

## Where to put your code
Vercel config files in `apps/web/` and monorepo root.

## Explanation

**Vercel** is the standard deployment target for Vite/React apps. It deploys static assets (the `dist/` folder) to a CDN with edge caching and automatic HTTPS. Deploy takes ~30 seconds.

For a monorepo, Vercel needs to know:
1. Which subdirectory to deploy (`apps/web`)
2. The build command (`pnpm turbo build --filter=@task-manager/web`)
3. The output directory (`apps/web/dist`)

**Environment variables** in Vite must be set at **build time** — `VITE_API_URL` is inlined into the bundled JS during `vite build`. It's not read at runtime like a Node.js `process.env`. This means changing the API URL requires a rebuild and redeploy.

For the `httpOnly` cookie auth to work cross-origin in production, both the API URL and the web URL must be configured in each other's CORS/credentials settings.

## Step-by-step

### 1. Add `vercel.json` to the monorepo root

```json name=vercel.json
{
  "version": 2,
  "projects": [
    {
      "name": "task-manager-web",
      "root": "apps/web",
      "framework": "vite",
      "buildCommand": "cd ../.. && pnpm turbo build --filter=@task-manager/web",
      "outputDirectory": "dist",
      "installCommand": "cd ../.. && pnpm install"
    }
  ]
}
```

Alternatively (simpler): configure directly in the Vercel dashboard without `vercel.json`.

### 2. Deploy via Vercel CLI

```bash
npm i -g vercel
cd apps/web
vercel
```

The CLI asks:
- Root directory? `apps/web` (or configure from repo root)
- Framework? Vite (auto-detected)
- Build command? Accept default or set `pnpm turbo build --filter=@task-manager/web`
- Output directory? `dist`

### 3. Set environment variables in Vercel

In the Vercel dashboard → Project → Settings → Environment Variables:

```
VITE_API_URL = https://your-api.up.railway.app
```

Scope: "Production" only (don't expose prod API to preview deployments).

For preview deployments (PRs), use a staging API or localhost:
```
VITE_API_URL = https://staging-api.up.railway.app  (Preview)
VITE_API_URL = https://your-api.up.railway.app     (Production)
```

### 4. Update `apps/api` CORS for production

Set `CORS_ORIGIN` in Railway to your Vercel URL:
```
CORS_ORIGIN = https://task-manager-web.vercel.app
```

Cookies need `Secure` flag in production (already handled in Day 72):
```ts
secure: process.env.NODE_ENV === 'production',
```

### 5. SPA routing — catch-all in Vercel

React Router uses client-side routing. When a user visits `https://your-app.vercel.app/tasks` directly, Vercel must serve `index.html` (not a 404). Configure this:

```json name=apps/web/public/_redirects
/*    /index.html    200
```

Or via `vercel.json` in `apps/web`:

```json name=apps/web/vercel.json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Vite also needs the `base` option if deploying to a subpath — not needed if deploying to the root of the Vercel project.

### 6. Verify the production stack

```bash
# API health
curl https://your-api.up.railway.app/health

# Register via production
curl -X POST https://your-api.up.railway.app/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"prod@example.com","password":"ProdPass123"}'

# Open in browser
open https://task-manager-web.vercel.app
```

Full flow to test:
1. Visit the production URL.
2. Click "Sign in" — login form loads.
3. Register or login with test credentials.
4. Create a task — it persists to Railway Postgres.
5. Refresh page — task still there (cookie + DB).

### 7. Preview deployments

Every PR to `main` gets an automatic preview URL from Vercel (e.g., `task-manager-web-git-feat-xyz.vercel.app`). Preview deployments use the environment variables scoped to "Preview". This lets you test features in production-like conditions before merging.

### 8. Redeploy on API change

If the API URL changes (e.g., new Railway service):
1. Update `VITE_API_URL` in Vercel settings.
2. Trigger a redeploy: Vercel dashboard → Deployments → "Redeploy" latest.

## Test it

1. Open `https://task-manager-web.vercel.app` in a private browser window.
2. Register, login, create a task, toggle done, delete.
3. Close and reopen — session persists.
4. Open DevTools → Network — tasks load from `https://your-api.up.railway.app`.

## Mini-task
Add `VITE_APP_VERSION` env var set to `$(git rev-parse --short HEAD)` in the Vercel build. Display it in the footer: `v{import.meta.env.VITE_APP_VERSION}`. This lets you verify which commit is deployed.

## Glossary
- **Build-time env var** — `VITE_*` vars inlined into the bundle at build time; not changeable at runtime.
- **CDN edge** — Vercel serves static assets from the nearest datacentre to the user.
- **SPA catch-all** — rewrite `/*` → `/index.html` so deep links work on refresh.
- **Preview deployment** — Vercel auto-deploy for PRs; has its own URL and env vars.

## Resources
- [Vercel — Monorepo support](https://vercel.com/docs/monorepos)
- [Vite — Env Variables](https://vitejs.dev/guide/env-and-mode)
- [Vercel — Environment Variables](https://vercel.com/docs/projects/environment-variables)

## Checklist
- [ ] Vercel project created for `apps/web`
- [ ] `VITE_API_URL` set to production Railway URL
- [ ] Railway `CORS_ORIGIN` set to Vercel URL
- [ ] SPA catch-all configured (`_redirects` or `vercel.json`)
- [ ] Login works on production URL
- [ ] Task CRUD works end-to-end in production
- [ ] Private window test confirms session persists
