# Day 98 — Analytics tab

## Goal
Build the admin analytics page with three charts: conversations per day (last 30 days), intent distribution, and score histogram. Use Prisma aggregation queries for the data and Recharts for the visualisations.

## Estimated time
~2 hours

## Prerequisites
Day 97. Some `Conversation` rows in the DB (at least 5–10 for interesting charts — send a few test messages via the chat widget).

## Where to put your code
In `ai-folio`. New file: `src/app/admin/analytics/page.tsx` and chart components under `src/components/admin/charts/`.

## Explanation

**Prisma aggregation** — `prisma.conversation.groupBy()` works like SQL `GROUP BY`. Combined with `_count`, you get conversation counts per day, per intent, per score — in one query per chart. No raw SQL needed.

**Recharts** is the most popular React charting library. It is a Client Component library (uses `useEffect` internally for responsive sizing), so the chart components get `'use client'`. The data itself is fetched in a Server Component and passed down as props — the Server/Client split you practised on Day 86.

**The pattern:** Server Component page fetches all aggregated data → passes plain objects as props to Client Component charts. The page is a Server Component; the charts are Client Components. Zero client-side API calls.

In Laravel terms: the analytics page is like a `ReportController` that runs aggregate queries and passes arrays to a Blade view containing Vue/Alpine chart components. The controller owns the data; the client renders it.

## Step-by-step

### 1. Install Recharts

```bash
pnpm add recharts
pnpm add -D @types/recharts
```

### 2. Analytics data queries (server-side)

```ts name=src/lib/analytics.ts
import { prisma } from '@/lib/db';
import { startOfDay, subDays, format } from 'date-fns';

export interface DailyCount {
  date: string;
  count: number;
}

export interface IntentCount {
  intent: string;
  count: number;
}

export interface ScoreCount {
  score: number;
  count: number;
}

export async function getConversationsPerDay(days = 30): Promise<DailyCount[]> {
  const since = subDays(new Date(), days);

  const raw = await prisma.conversation.groupBy({
    by: ['createdAt'],
    where: { createdAt: { gte: since } },
    _count: { id: true },
  });

  // Bucket by day
  const byDay: Record<string, number> = {};

  for (let i = days - 1; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'MMM d');
    byDay[date] = 0;
  }

  for (const row of raw) {
    const date = format(startOfDay(row.createdAt), 'MMM d');
    byDay[date] = (byDay[date] ?? 0) + row._count.id;
  }

  return Object.entries(byDay).map(([date, count]) => ({ date, count }));
}

export async function getIntentDistribution(): Promise<IntentCount[]> {
  const raw = await prisma.conversation.groupBy({
    by: ['intent'],
    where: { intent: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  return raw.map((r) => ({
    intent: (r.intent ?? 'unknown').replace('_', ' '),
    count: r._count.id,
  }));
}

export async function getScoreDistribution(): Promise<ScoreCount[]> {
  const raw = await prisma.conversation.groupBy({
    by: ['leadScore'],
    where: { leadScore: { not: null } },
    _count: { id: true },
    orderBy: { leadScore: 'asc' },
  });

  // Fill in missing scores (1–5) with 0
  const byScore: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of raw) {
    if (r.leadScore) byScore[r.leadScore] = r._count.id;
  }

  return Object.entries(byScore).map(([score, count]) => ({
    score: Number(score),
    count,
  }));
}

export async function getOverviewStats() {
  const [total, scored, leads] = await Promise.all([
    prisma.conversation.count(),
    prisma.conversation.count({ where: { leadScore: { not: null } } }),
    prisma.lead.count(),
  ]);

  return { total, scored, leads };
}
```

### 3. Chart components (Client Components)

```tsx name=src/components/admin/charts/bar-chart.tsx
'use client';

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface SimpleBarChartProps {
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  color?: string;
}

export function SimpleBarChart({
  data,
  xKey,
  yKey,
  color = 'hsl(var(--primary))',
}: SimpleBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: 12,
          }}
        />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### 4. Analytics page (Server Component)

```tsx name=src/app/admin/analytics/page.tsx
import {
  getConversationsPerDay,
  getIntentDistribution,
  getScoreDistribution,
  getOverviewStats,
} from '@/lib/analytics';
import { SimpleBarChart } from '@/components/admin/charts/bar-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AnalyticsPage() {
  const [daily, intents, scores, stats] = await Promise.all([
    getConversationsPerDay(30),
    getIntentDistribution(),
    getScoreDistribution(),
    getOverviewStats(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Scored
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.scored}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leads created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.leads}</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversations per day */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversations — last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleBarChart data={daily} xKey="date" yKey="count" />
        </CardContent>
      </Card>

      {/* Intent distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Intent distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {intents.length > 0 ? (
              <SimpleBarChart
                data={intents}
                xKey="intent"
                yKey="count"
                color="hsl(var(--chart-2, 220 70% 50%))"
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No scored conversations yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Score histogram */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score histogram</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={scores}
              xKey="score"
              yKey="count"
              color="hsl(var(--chart-3, 140 60% 45%))"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

## Test it

```bash
pnpm dev
```

1. Send 5–10 test messages via the chat widget (mix of intents — simulate a recruiter, a collaborator, a random question).
2. Visit `/admin/analytics`.
3. Overview stats show correct counts.
4. Daily chart shows spikes on today's date.
5. Intent and score charts populate once scoring runs (wait a few seconds after chat).

```bash
pnpm build
```

6. Build passes — Recharts imports only in Client Components.

## Mini-task
Add a fourth stat card: "Avg lead score" using `prisma.conversation.aggregate({ _avg: { leadScore: true }, where: { leadScore: { not: null } } })`. Display the average with one decimal place.

## Glossary
- **`groupBy`** — Prisma aggregation method equivalent to SQL `GROUP BY`; use `_count`, `_sum`, `_avg` for aggregate values.
- **`Promise.all`** — runs multiple async operations in parallel; all four queries fire simultaneously.
- **Recharts `ResponsiveContainer`** — wrapper that makes the chart responsive to its parent's width; requires a parent with a defined width.
- **ISR chart data** — analytics data is fresh per request (no `revalidate` set); add `revalidate = 60` export if you want caching.

## Resources
- [Recharts — Getting started](https://recharts.org/en-US/guide/getting-started)
- [Prisma — `groupBy`](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#group-by)

## Checklist
- [ ] `recharts` installed
- [ ] `getConversationsPerDay`, `getIntentDistribution`, `getScoreDistribution` return correct data
- [ ] `Promise.all` runs all four queries in parallel
- [ ] Three charts render correctly (bar chart component reused for all)
- [ ] Chart components are `'use client'`; analytics page is a Server Component
- [ ] `pnpm build` passes
