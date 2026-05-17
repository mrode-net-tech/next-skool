# Day 112 — Redis setup

## Goal
Harden the Redis configuration for `ai-folio`: connection pooling, error handling, production URLs, and understanding what Redis stores (queue jobs, session cache). After this day Redis is production-ready and you know how to monitor it.

## Estimated time
~1.5 hours

## Prerequisites
Day 111 (BullMQ basics, ioredis installed). Day 102 (Redis in docker-compose).

## Where to put your code
In `ai-folio`.

## Explanation

**ioredis** is the Redis client BullMQ uses internally. You can also use it directly for general-purpose caching — rate limiting, session storage, temporary data. In `ai-folio`, Redis serves two roles: BullMQ's job store and a general cache for expensive operations (e.g., caching GitHub API responses for 5 minutes to avoid rate limits).

**Connection management**: BullMQ requires separate ioredis connections for Queue and Worker because a Worker connection enters a blocking state (`BRPOP`). Reusing the same connection causes the queue's non-blocking commands to hang. Always create a new connection instance for each BullMQ entity.

**Upstash Redis** is a managed, serverless Redis service that works well with Next.js (it supports HTTP-based Redis via `@upstash/redis`). For production on Fly.io the alternatives are: a managed Upstash instance, or a dedicated Redis machine on Fly. Either is simpler than running your own Redis in production.

In Laravel terms, Redis in `ai-folio` plays the same role as Laravel's Redis facade: cache driver + queue driver, both pointing at the same connection but used through different abstractions.

## Step-by-step

### 1. Expand the Redis connection factory

```ts name=src/lib/redis.ts
import { Redis, type RedisOptions } from 'ioredis';

const REDIS_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: null,   // required by BullMQ
  enableReadyCheck: false,      // skip initial PING check — BullMQ handles reconnection
  lazyConnect: false,
};

const getRedisUrl = (): string => {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL environment variable is not set');
  return url;
};

export const createRedisConnection = (): Redis =>
  new Redis(getRedisUrl(), REDIS_OPTIONS);

// Singleton for non-BullMQ use (general caching)
// Do NOT pass this instance to BullMQ — it would conflict with blocking commands
let _redis: Redis | null = null;

export const getRedis = (): Redis => {
  if (!_redis || _redis.status === 'end') {
    _redis = new Redis(getRedisUrl(), {
      ...REDIS_OPTIONS,
      maxRetriesPerRequest: 3,   // non-BullMQ usage can retry
    });

    _redis.on('error', (err) => {
      console.error('[redis] connection error:', err.message);
    });
  }
  return _redis;
};
```

`getRedis()` returns a singleton for ad-hoc cache operations. `createRedisConnection()` returns a fresh connection for each BullMQ Queue or Worker.

### 2. Add a cache helper

```ts name=src/lib/cache.ts
import { getRedis } from '@/lib/redis';

export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const redis = getRedis();
  const cached = await redis.get(key);

  if (cached) {
    return JSON.parse(cached) as T;
  }

  const fresh = await fetcher();
  await redis.setex(key, ttlSeconds, JSON.stringify(fresh));
  return fresh;
}
```

Usage — cache GitHub API responses (Day 97):

```ts
const repos = await getCached(
  'github:repos',
  300,  // 5 minutes
  () => fetchGitHubRepos()
);
```

### 3. Add Redis health to the health endpoint

```ts name=src/app/api/health/route.ts
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [dbResult, redisPing] = await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      getRedis().ping(),
    ]);

    return NextResponse.json({
      status: 'ok',
      db: 'ok',
      redis: redisPing === 'PONG' ? 'ok' : 'error',
    });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: (err as Error).message },
      { status: 503 }
    );
  }
}
```

### 4. Configure Redis for production (Upstash)

Sign up at upstash.com, create a Redis database, copy the connection string.

```bash name=.env.local
REDIS_URL=rediss://default:<password>@<host>.upstash.io:6379
```

Note `rediss://` (TLS) for Upstash. The `redis://` scheme is for local non-TLS connections. ioredis handles TLS automatically based on the scheme.

For Fly.io, set the secret:

```bash
flyctl secrets set REDIS_URL="rediss://..." --app ai-folio
```

### 5. Monitor Redis with redis-cli

```bash
# Connect to the Compose Redis
docker-compose exec redis redis-cli

# Inside redis-cli:
INFO server          # version, memory, uptime
INFO stats           # command count, hits, misses
DBSIZE               # total keys
KEYS bull:*          # BullMQ keys (queues, jobs)
TTL bull:embeddings:wait   # check BullMQ's wait list TTL
```

To watch live commands:

```bash
docker-compose exec redis redis-cli MONITOR
```

`MONITOR` streams every Redis command in real time — useful for debugging BullMQ's internal calls.

### 6. Add REDIS_URL to docker-compose

The `app` service already has `REDIS_URL: redis://redis:6379` (Day 102). Confirm the worker service (Day 115) will also receive this env var.

## Test it

```bash
curl http://localhost:3000/api/health
```

Expected:

```json
{"status":"ok","db":"ok","redis":"ok"}
```

Verify caching:

```bash
# First call — fetches fresh data
curl http://localhost:3000/api/github-repos

# Check cache in Redis
docker-compose exec redis redis-cli GET "github:repos"
# Should return JSON string

# Second call — served from cache (faster)
time curl http://localhost:3000/api/github-repos
```

## Mini-task
Add a `GET /api/admin/queue-stats` Route Handler that returns BullMQ queue depths (waiting, active, completed, failed) for both `embeddingQueue` and `emailQueue`. Use `queue.getJobCounts()`. Protect it with the Auth.js session check from Day 92.

## Glossary
- **ioredis** — Node.js Redis client; used by BullMQ internally; also usable directly for caching.
- **`maxRetriesPerRequest: null`** — disables per-request retry limit; required for BullMQ blocking connections.
- **`SETEX key ttl value`** — Redis command that sets a key with an expiry in seconds; used for cache TTL.
- **`MONITOR`** — Redis command that streams all commands received by the server in real time.
- **Upstash** — managed serverless Redis with HTTP API and Redis-compatible connection string; works in serverless/edge environments.
- **`rediss://`** — Redis connection scheme with TLS; standard for managed Redis services.

## Resources
- [BullMQ — ioredis connection](https://docs.bullmq.io/guide/connections)
- [ioredis — GitHub](https://github.com/redis/ioredis)
- [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted)
- [Redis — MONITOR command](https://redis.io/docs/latest/commands/monitor/)

## Checklist
- [ ] `createRedisConnection()` returns fresh connections for BullMQ
- [ ] `getRedis()` returns a singleton for ad-hoc caching
- [ ] `getCached()` helper caches arbitrary async data with TTL
- [ ] `/api/health` reports Redis status alongside DB status
- [ ] Production `REDIS_URL` (Upstash TLS) set as Fly.io secret
- [ ] `docker-compose exec redis redis-cli MONITOR` shows BullMQ commands during job processing
