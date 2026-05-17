# Day 114 — Scheduled digest email (weekly lead summary)

## Goal
Use BullMQ's repeatable jobs to send a weekly email digest of high-scoring leads. After this day the portfolio owner receives an automated summary every Monday morning without any manual action.

## Estimated time
~2 hours

## Prerequisites
Day 113 (embedding worker running). Day 96 (Resend email integration). Day 95 (lead scoring with generateObject).

## Where to put your code
In `ai-folio`.

## Explanation

**Repeatable jobs** in BullMQ are jobs with a cron schedule. BullMQ stores the schedule in Redis and re-enqueues the job automatically at each interval. Unlike a system cron job (which runs a shell command), BullMQ cron jobs run inside your Node.js process and have access to your full application — Prisma, the Claude API, your services. In Laravel terms, this is `$schedule->job(new WeeklyDigestJob)->weekly()`.

**Why BullMQ for scheduling instead of Vercel Cron?** Vercel Cron invokes a Route Handler via HTTP — which means every job runs inside the Next.js serverless function runtime with a 10–300 second time limit. For a digest email that queries the DB, summarises with Claude, and sends email, the 300-second limit is fine. But for heavier jobs (re-indexing all embeddings), you want a long-running Node.js worker process with no timeout. BullMQ's worker process handles both.

**Email digest design:** query all conversations with `leadScore >= 4` from the past 7 days, group by intent, generate a short AI summary of each, format as HTML, send with Resend.

## Step-by-step

### 1. Define the digest email queue

```ts name=src/lib/queues/index.ts
// Add alongside embeddingQueue and emailQueue
export const schedulerQueue = new Queue('scheduler', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 60_000 },  // retry after 1 minute
    removeOnComplete: { count: 20 },
    removeOnFail: { count: 50 },
  },
});
```

### 2. Register the repeatable job at startup

Create a setup script that runs once when the worker process starts:

```ts name=src/workers/scheduler.ts
import { schedulerQueue } from '@/lib/queues';

export async function setupScheduledJobs() {
  // Remove any existing weekly-digest jobs before re-registering
  // This prevents duplicate schedules across worker restarts
  const existing = await schedulerQueue.getRepeatableJobs();
  for (const job of existing) {
    if (job.name === 'weekly-digest') {
      await schedulerQueue.removeRepeatableByKey(job.key);
    }
  }

  await schedulerQueue.add(
    'weekly-digest',
    {},   // no payload needed — the worker fetches its own data
    {
      repeat: {
        pattern: '0 8 * * 1',   // every Monday at 08:00 UTC
        tz: 'Europe/Warsaw',     // adjust to your timezone
      },
    }
  );

  console.log('[scheduler] Weekly digest job registered');
}
```

### 3. Implement the digest logic

```ts name=src/lib/digest.ts
import { prisma } from '@/lib/prisma';
import { generateObject } from 'ai';
import { fastModel } from '@/lib/ai';
import { z } from 'zod';

const DigestSchema = z.object({
  summary: z.string().describe('2–3 sentence summary of the leads this week'),
  topOpportunity: z.string().describe('The single most promising lead and why'),
  recommendedActions: z.array(z.string()).max(3),
});

export async function buildWeeklyDigest() {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const leads = await prisma.conversation.findMany({
    where: {
      leadScore: { gte: 4 },
      createdAt: { gte: since },
    },
    orderBy: { leadScore: 'desc' },
    take: 20,
    include: { messages: { take: 3, orderBy: { createdAt: 'asc' } } },
  });

  if (leads.length === 0) {
    return null;
  }

  const leadsText = leads
    .map(
      (l, i) =>
        `Lead ${i + 1} (score ${l.leadScore}, intent: ${l.intent}):\n` +
        l.messages.map((m) => `  ${m.role}: ${m.content}`).join('\n')
    )
    .join('\n\n');

  const { object } = await generateObject({
    model: fastModel,
    schema: DigestSchema,
    prompt: `You are analysing leads from a portfolio website. Summarise the following ${leads.length} high-scoring conversations from the past week:\n\n${leadsText}`,
  });

  return { leads, ...object };
}
```

### 4. Create the digest email template

```ts name=src/lib/email/digest-template.ts
interface DigestData {
  summary: string;
  topOpportunity: string;
  recommendedActions: string[];
  leadsCount: number;
  weekStart: string;
}

export function renderDigestEmail(data: DigestData): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Weekly Lead Digest</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1a1a1a;">Weekly Lead Digest</h1>
  <p style="color: #666;">Week of ${data.weekStart} — ${data.leadsCount} high-scoring lead(s)</p>

  <h2>Summary</h2>
  <p>${data.summary}</p>

  <h2>Top Opportunity</h2>
  <p>${data.topOpportunity}</p>

  <h2>Recommended Actions</h2>
  <ul>
    ${data.recommendedActions.map((a) => `<li>${a}</li>`).join('')}
  </ul>

  <hr>
  <p style="color: #999; font-size: 12px;">
    View all leads at <a href="${process.env.NEXTAUTH_URL}/admin">your admin dashboard</a>
  </p>
</body>
</html>
  `.trim();
}
```

### 5. Wire the scheduler worker

```ts name=src/workers/embedding-worker.ts
import { Worker } from 'bullmq';
import { createRedisConnection } from '@/lib/redis';
import { buildWeeklyDigest } from '@/lib/digest';
import { renderDigestEmail } from '@/lib/email/digest-template';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const schedulerWorker = new Worker(
  'scheduler',
  async (job) => {
    if (job.name === 'weekly-digest') {
      console.log('[scheduler-worker] Building weekly digest...');
      const digest = await buildWeeklyDigest();

      if (!digest) {
        console.log('[scheduler-worker] No high-scoring leads this week — skipping email');
        return;
      }

      const html = renderDigestEmail({
        summary: digest.summary,
        topOpportunity: digest.topOpportunity,
        recommendedActions: digest.recommendedActions,
        leadsCount: digest.leads.length,
        weekStart: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
      });

      await resend.emails.send({
        from: 'digest@yourdomain.com',
        to: process.env.OWNER_EMAIL!,
        subject: `Weekly Lead Digest — ${digest.leads.length} new lead(s)`,
        html,
      });

      console.log(`[scheduler-worker] Digest sent to ${process.env.OWNER_EMAIL}`);
    }
  },
  { connection: createRedisConnection() }
);

export { schedulerWorker };
```

### 6. Trigger manually for testing

Do not wait until Monday to test. Add a Route Handler that enqueues the digest immediately:

```ts name=src/app/api/admin/trigger-digest/route.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { schedulerQueue } from '@/lib/queues';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return new Response('Unauthorized', { status: 401 });

  await schedulerQueue.add('weekly-digest', {});
  return NextResponse.json({ queued: true });
}
```

```bash
curl -X POST http://localhost:3000/api/admin/trigger-digest \
  -H "Cookie: next-auth.session-token=..."
```

## Test it

Start the worker with Resend credentials:

```bash
REDIS_URL=redis://localhost:6380 \
RESEND_API_KEY=re_... \
OWNER_EMAIL=you@example.com \
NEXTAUTH_URL=http://localhost:3000 \
pnpm worker
```

Trigger the digest manually:

```bash
curl -X POST http://localhost:3000/api/admin/trigger-digest \
  -H "Cookie: <your-session-cookie>"
```

Expected: email arrives within 30 seconds. Worker logs show `Digest sent to you@example.com`.

## Mini-task
Add a `monthly-summary` repeatable job on cron `'0 9 1 * *'` (first day of each month, 09:00). It should export a CSV of all conversations from the past month and attach it to the email using Resend's `attachments` API.

## Glossary
- **Repeatable job** — BullMQ job registered with a cron pattern; BullMQ re-enqueues it automatically at each scheduled time.
- **`removeRepeatableByKey`** — removes a scheduled job registration from Redis; call before re-registering to prevent duplicates on worker restart.
- **Cron pattern** — `'0 8 * * 1'` = minute 0, hour 8, any day-of-month, any month, day-of-week 1 (Monday).
- **`generateObject`** — Vercel AI SDK function that returns structured JSON validated against a Zod schema; used here to produce the digest summary.
- **`tz`** — timezone for cron interpretation; BullMQ supports IANA timezone names.

## Resources
- [BullMQ — repeatable jobs](https://docs.bullmq.io/guide/jobs/repeatable)
- [Resend — attachments](https://resend.com/docs/api-reference/emails/send-email#attachments)
- [crontab.guru — cron expression editor](https://crontab.guru/)

## Checklist
- [ ] `setupScheduledJobs()` registers weekly-digest on `'0 8 * * 1'` (Monday 08:00)
- [ ] Existing repeatable jobs removed before re-registering (prevents duplicates)
- [ ] `buildWeeklyDigest()` queries leads with `leadScore >= 4` from past 7 days
- [ ] `generateObject` produces structured summary, topOpportunity, recommendedActions
- [ ] `renderDigestEmail()` generates HTML email
- [ ] `POST /api/admin/trigger-digest` allows manual test trigger
- [ ] Email received via Resend with correct subject and content
