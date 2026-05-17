# Day 116 — Sentry integration

## Goal
Integrate Sentry into `ai-folio` for error tracking and performance monitoring. After this day, every unhandled exception — in Next.js Server Components, Route Handlers, and the BullMQ worker — creates a Sentry issue with full context (stack trace, user, breadcrumbs).

## Estimated time
~2 hours

## Prerequisites
Day 115 (worker running in production). A Sentry account (free tier is sufficient).

## Where to put your code
In `ai-folio`.

## Explanation

**Error tracking** is the production equivalent of your local dev server's terminal. Without it, you learn about crashes from user complaints. With Sentry you get notified immediately with a full stack trace, the user who triggered it, the browser/OS, recent network requests, and a replay of what the user did. In Laravel terms, Sentry replaces `dd()` and `Log::error()` with a searchable dashboard.

**Next.js + Sentry** (`@sentry/nextjs`) uses a Next.js instrumentation hook (`instrumentation.ts`) to register Sentry on both the Node.js runtime and the Edge runtime. It patches `fetch`, wraps Server Components, and captures errors from Route Handlers — all without manual `try/catch` everywhere.

**Performance monitoring** (tracing) attaches timing spans to database queries, HTTP requests, and custom operations. Sentry's dashboard shows p50/p95/p99 latencies. For `ai-folio`, the most valuable traces are: chat endpoint (time to first token), embedding job (queue wait + vector generation), and lead scoring.

## Step-by-step

### 1. Install and initialise Sentry

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

The wizard creates:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `instrumentation.ts`
- Updates `next.config.ts` to wrap with `withSentryConfig`

Review each file. The wizard sets a `NEXT_PUBLIC_SENTRY_DSN` env var — move it to `SENTRY_DSN` (server-only; no need to expose to the browser) unless you want browser error tracking.

### 2. Configure Sentry

```ts name=sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',

  integrations: [
    Sentry.prismaIntegration(),  // traces Prisma queries
  ],
});
```

`tracesSampleRate: 0.1` in production traces 10% of requests — enough for performance data without overwhelming the Sentry quota.

```ts name=sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,     // disable client-side tracing — keep quota for server traces
  enabled: process.env.NODE_ENV === 'production',
});
```

### 3. Add Sentry to the Next.js config

```ts name=next.config.ts
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default withSentryConfig(nextConfig, {
  org: 'your-sentry-org',
  project: 'ai-folio',
  silent: true,       // suppress build logs
  widenClientFileUpload: true,
  hideSourceMaps: true,        // source maps uploaded to Sentry, not served to users
  disableLogger: true,
  automaticVercelMonitors: false,
});
```

### 4. Add Sentry to the BullMQ worker

```ts name=src/workers/index.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,   // trace all worker jobs — lower volume
  environment: process.env.NODE_ENV,
});

// Wrap the worker processor with Sentry error capture
import { Worker } from 'bullmq';

const wrappedProcessor = Sentry.wrapWithMonitor(
  async (job: Job) => {
    return Sentry.startSpan(
      { name: `bullmq.${job.queueName}.${job.name}`, op: 'queue.process' },
      () => processor(job)
    );
  },
  { monitorSlug: 'embedding-worker' }
);
```

For simpler error capture without full tracing:

```ts name=src/workers/embedding-worker.ts
import * as Sentry from '@sentry/node';

// In the worker's failed event:
worker.on('failed', (job, err) => {
  Sentry.captureException(err, {
    extra: { jobId: job?.id, jobData: job?.data, queueName: 'embeddings' },
  });
  console.error(`[embedding-worker] Job ${job?.id} failed: ${err.message}`);
});
```

### 5. Set environment variables

```bash name=.env.local
SENTRY_DSN=https://...@o....ingest.sentry.io/...
SENTRY_AUTH_TOKEN=sntrys_...  # for source map upload during build
```

Add to Fly.io:

```bash
flyctl secrets set \
  SENTRY_DSN="https://...@o....ingest.sentry.io/..." \
  SENTRY_AUTH_TOKEN="sntrys_..." \
  --app ai-folio
```

### 6. Verify Sentry is receiving errors

```ts name=src/app/api/test-sentry/route.ts
export async function GET() {
  throw new Error('Sentry test error from api/test-sentry');
}
```

```bash
curl http://localhost:3000/api/test-sentry
```

Open the Sentry dashboard — the error should appear within 30 seconds with a full stack trace. Delete this Route Handler after testing.

## Test it

Deploy to production:

```bash
git push origin main
```

After deploy, trigger a known error path (e.g., a bad API request). Open the Sentry dashboard → **Issues** → confirm the error appears with:
- Stack trace pointing to your source (not compiled JS — Sentry decodes via uploaded source maps)
- Environment: `production`
- Request URL and method

Also check **Performance** → confirm traces appear for the chat endpoint.

## Mini-task
Configure a Sentry Alert: **Alerts** → **Create Alert** → trigger when an issue exceeds 5 occurrences in 1 hour → notify via email. Test it by hitting the error endpoint 5 times. You should receive an alert email within a few minutes.

## Glossary
- **DSN** — Data Source Name; Sentry URL that your app sends events to; unique per project.
- **Trace sample rate** — fraction of requests that have full distributed tracing enabled; 0.1 = 10%.
- **Source map** — file mapping compiled JS positions back to TypeScript source; Sentry uses it to show readable stack traces.
- **Prisma integration** — Sentry plugin that automatically traces Prisma queries and includes them in performance spans.
- **`withSentryConfig`** — Next.js config wrapper that patches `next build` to upload source maps to Sentry.

## Resources
- [Sentry — Next.js guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry — BullMQ integration](https://docs.sentry.io/platforms/node/configuration/integrations/bull/)
- [Sentry — performance monitoring](https://docs.sentry.io/product/performance/)

## Checklist
- [ ] `@sentry/nextjs` installed; `sentry.server.config.ts`, `sentry.client.config.ts` created
- [ ] `instrumentation.ts` registers Sentry on the Node runtime
- [ ] `next.config.ts` wrapped with `withSentryConfig`
- [ ] Worker `failed` event captures exceptions to Sentry
- [ ] `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` set locally and as Fly.io secrets
- [ ] Test error appears in Sentry dashboard with source-mapped stack trace
- [ ] Alert configured for high-frequency errors
