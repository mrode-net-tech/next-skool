# Day 119 — Post-deploy monitoring

## Goal
Set up active monitoring for the production `ai-folio` app: uptime checks, performance dashboards, and alert policies. After this day you know within minutes when something breaks in production — before users report it.

## Estimated time
~2 hours

## Prerequisites
Day 118 (production deploy live). Day 116 (Sentry integrated).

## Where to put your code
Configuration in external services; minor code changes in `ai-folio`.

## Explanation

**Monitoring layers** in a production app:
1. **Uptime monitoring** — is the app responding at all? (HTTP check every minute)
2. **Error tracking** — when it responds, does it crash? (Sentry)
3. **Performance monitoring** — when it works, is it slow? (Sentry Performance, or a separate APM)
4. **Log aggregation** — what happened before a crash? (Fly.io logs, or a log management service)

**Uptime monitoring** is the simplest and most important. Services like Better Uptime, Checkly, or UptimeRobot send an HTTP GET to your health endpoint every 1–5 minutes. If they get no response or a non-2xx status, they send you an alert. You set this up once and forget about it until something breaks.

**Fly.io metrics** (via the built-in Prometheus endpoint) expose Machine CPU, memory, and request latency. You can scrape them into Grafana Cloud (free tier) for dashboards. For most solo projects, the Fly.io dashboard is sufficient.

**Synthetic monitoring** (Checkly or Playwright Cloud) runs your Playwright tests against the live production URL on a schedule — not just "is the HTTP server up" but "does login work?", "does the chat respond?". This catches regression bugs that only appear in production configuration.

## Step-by-step

### 1. Set up uptime monitoring (Better Uptime — free tier)

1. Sign up at betteruptime.com
2. **New Monitor** → type: **HTTP**, URL: `https://ai-folio.fly.dev/api/health`
3. Check interval: 3 minutes
4. Expected status: 200
5. Alert after: 1 failed check
6. Alert channel: email (or Slack)

The health endpoint from Day 105 checks both Postgres and Redis — a single endpoint that confirms the full stack is working.

### 2. Enhance the health endpoint with more detail

```ts name=src/app/api/health/route.ts
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { NextResponse } from 'next/server';

export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = 'ok';
  } catch {
    checks.db = 'error';
  }

  try {
    const pong = await getRedis().ping();
    checks.redis = pong === 'PONG' ? 'ok' : 'error';
  } catch {
    checks.redis = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  const status = allOk ? 200 : 503;

  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status }
  );
}
```

The 503 status on any check failure tells uptime monitors to alert — even if the app HTTP server is up.

### 3. Configure Sentry performance alerts

In Sentry → **Alerts** → **Create Alert** → **Performance**:

- **Metric:** p95 response time
- **Condition:** `> 3000ms` for 5 minutes
- **Transaction:** `/api/chat` (the most latency-sensitive endpoint)
- **Notify:** email

This alerts you if the chat endpoint is slow — possibly due to Claude API latency, Postgres query regression, or memory pressure.

### 4. Set up Fly.io metrics dashboard

```bash
# View real-time metrics
flyctl metrics --app ai-folio

# Memory and CPU by process
flyctl status --app ai-folio
```

For a persistent dashboard:

1. In Fly.io dashboard → **Monitoring** → **Metrics**
2. Grafana-style dashboards are available in the paid tier
3. Free alternative: export metrics to Grafana Cloud

### 5. Log-based alerting

BullMQ worker failures emit to stdout (`console.error`). Fly.io logs are ephemeral — they disappear after ~24 hours. To persist them:

```bash
# Ship logs to Better Stack (Logtail) — free tier
flyctl extensions logtail create --app ai-folio
```

Or use the Fly.io log drain feature to ship to Papertrail, Datadog, or Better Stack. This lets you search historical logs and set up log-based alerts ("alert if ERROR appears more than 10 times per hour").

### 6. Create a runbook

```markdown name=docs/runbook.md
# ai-folio Production Runbook

## Incident response

### App down (health check failing)

1. `flyctl status --app ai-folio` — check which Machines are unhealthy
2. `flyctl logs --app ai-folio --follow` — look for startup errors
3. Check Sentry for recent exceptions
4. Common causes:
   - Missing env var: `flyctl secrets list --app ai-folio`
   - DB migration failed: `flyctl logs --app ai-folio` (look for `[migrate]`)
   - OOM: `flyctl vm status <machine-id>` — consider scaling memory

### Worker stopped processing

1. `flyctl logs --app ai-folio --process-group worker`
2. Check Redis: `redis-cli -u $REDIS_URL LLEN bull:embeddings:wait`
3. Restart worker: `flyctl machine restart <machine-id>`

### Rollback procedure

1. `flyctl releases --app ai-folio` — find last good release
2. `flyctl deploy --image <image-ref> --app ai-folio`

### Manual job trigger

```bash
curl -X POST https://ai-folio.fly.dev/api/admin/trigger-digest \
  -H "Cookie: <admin-session>"
```

## Contacts

- Fly.io status: status.flyio.net
- Anthropic API status: status.anthropic.com
- Upstash Redis status: upstash.com/status
```

## Test it

1. Open the Better Uptime dashboard — `https://ai-folio.fly.dev/api/health` should show green.
2. Temporarily break the health endpoint (comment out the `SELECT 1`), deploy, watch the alert fire within 3 minutes. Restore and redeploy.
3. Send 10 rapid chat messages to the production endpoint. Check Sentry Performance for the `/api/chat` p95 latency.

## Mini-task
Add a **Sentry Cron Monitor** for the weekly digest job. In `src/workers/scheduler-worker.ts`, wrap the job with a Sentry check-in:

```ts
const checkInId = Sentry.captureCheckIn({ monitorSlug: 'weekly-digest', status: 'in_progress' });
// ... do work ...
Sentry.captureCheckIn({ checkInId, monitorSlug: 'weekly-digest', status: 'ok' });
```

Sentry will alert you if the digest job does not run on schedule — catching cases where the worker is down on Monday morning.

## Glossary
- **Uptime monitor** — external service that periodically pings your health endpoint and alerts on failures.
- **Synthetic monitoring** — running automated browser/API tests against the live production URL on a schedule.
- **p95 latency** — the 95th percentile response time; 5% of requests are slower than this value.
- **Log drain** — a forwarding mechanism that ships all process stdout/stderr to an external log aggregation service.
- **Runbook** — documentation describing how to diagnose and resolve known incident types; reduces mean time to recovery.
- **Sentry Cron Monitor** — Sentry feature that tracks whether scheduled jobs run at the expected time.

## Resources
- [Better Uptime](https://betteruptime.com/)
- [Sentry — alerts](https://docs.sentry.io/product/alerts/)
- [Fly.io — log drains](https://fly.io/docs/reference/log-shipping/)
- [Sentry — cron monitors](https://docs.sentry.io/product/crons/)

## Checklist
- [ ] Better Uptime (or equivalent) monitors `https://ai-folio.fly.dev/api/health` every 3 minutes
- [ ] Health endpoint returns 503 if DB or Redis is down
- [ ] Sentry p95 performance alert configured for `/api/chat` > 3 seconds
- [ ] Log drain configured to persist Fly.io logs beyond 24 hours
- [ ] `docs/runbook.md` documents incident response steps
- [ ] Sentry Cron Monitor registered for `weekly-digest` job
