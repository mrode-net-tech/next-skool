# Day 133 — BullMQ integration — push on high-score lead

## Goal
Send a push notification to the admin's phone when a new conversation scores 4 or 5. After this day, visiting the portfolio and chatting triggers a phone notification within seconds — the complete event pipeline from visitor to admin pocket.

## Estimated time
~2 hours

## Prerequisites
Day 132 (push token stored in DB). Day 113 (BullMQ embedding worker). Day 95 (lead scoring with generateObject).

## Where to put your code
In `ai-folio` (backend + BullMQ worker).

## Explanation

**The event pipeline:** visitor sends message → `/api/chat` saves conversation → BullMQ embedding job runs → after embedding, a lead scoring job runs → if score ≥ 4, a push notification job runs → Expo push API delivers to device.

**Why BullMQ for the push, not a direct API call in the route handler?** The push notification depends on the lead score, which depends on the embedding, which takes 1–3 seconds. The chain must be sequential but non-blocking. BullMQ job chaining (`job.moveToWaitingChildren`) or separate queues with dependencies handle this cleanly.

**Expo's push API** accepts an array of push messages and returns a receipt. You must check receipts asynchronously (they are not immediately available) for delivery errors like `DeviceNotRegistered`. Today you send the push synchronously for simplicity; Day 134 adds receipt checking.

## Step-by-step

### 1. Create a push notification service

```ts name=src/lib/push.ts
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { prisma } from './prisma';

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

export async function sendPushToAdmin(message: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<ExpoPushTicket[]> {
  // Fetch the admin user's push token
  const user = await prisma.user.findFirst({
    where: { role: 'admin', pushToken: { not: null } },
    select: { id: true, pushToken: true },
  });

  if (!user?.pushToken) {
    console.log('[push] No admin push token registered — skipping');
    return [];
  }

  if (!Expo.isExpoPushToken(user.pushToken)) {
    console.warn('[push] Invalid push token:', user.pushToken);
    return [];
  }

  const pushMessage: ExpoPushMessage = {
    to: user.pushToken,
    title: message.title,
    body: message.body,
    data: message.data,
    sound: 'default',
    priority: 'high',
    channelId: 'leads',   // Android channel from Day 131
  };

  const chunks = expo.chunkPushNotifications([pushMessage]);
  const tickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
    tickets.push(...chunkTickets);
  }

  return tickets;
}
```

Install the Expo server SDK:

```bash
pnpm add expo-server-sdk
```

### 2. Add a push notification queue

```ts name=src/lib/queues/index.ts
export const pushQueue = new Queue<{
  conversationId: string;
  leadScore: number;
  intent: string;
  preview: string;
}>('push-notifications', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});
```

### 3. Enqueue push after lead scoring

In the lead scoring flow (from Day 95), after `generateObject` returns a score ≥ 4:

```ts name=src/lib/lead-scoring.ts
import { pushQueue } from './queues';

export async function scoreAndNotify(conversationId: string, messages: Message[]) {
  const { object } = await generateObject({
    model: fastModel,
    schema: LeadScoreSchema,
    prompt: buildScoringPrompt(messages),
  });

  // Save score to DB
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { leadScore: object.score, intent: object.intent, summary: object.summary },
  });

  // Enqueue push for high-score leads
  if (object.score >= 4) {
    await pushQueue.add('send-push', {
      conversationId,
      leadScore: object.score,
      intent: object.intent,
      preview: messages[messages.length - 1]?.content?.slice(0, 100) ?? '',
    });
  }

  return object;
}
```

### 4. Implement the push worker

```ts name=src/workers/push-worker.ts
import { Worker } from 'bullmq';
import { createRedisConnection } from '@/lib/redis';
import { sendPushToAdmin } from '@/lib/push';

const INTENT_LABELS: Record<string, string> = {
  job_offer: 'Job Offer',
  collab: 'Collaboration',
  question: 'Question',
  spam: 'Spam',
};

export const pushWorker = new Worker(
  'push-notifications',
  async (job) => {
    const { conversationId, leadScore, intent, preview } = job.data;

    const intentLabel = INTENT_LABELS[intent] ?? 'New Lead';
    const stars = '★'.repeat(leadScore);

    const tickets = await sendPushToAdmin({
      title: `${intentLabel} ${stars}`,
      body: preview || 'Someone wants to connect.',
      data: { leadId: conversationId },
    });

    const errors = tickets.filter((t) => t.status === 'error');
    if (errors.length > 0) {
      console.error('[push-worker] Delivery errors:', errors);
    }

    console.log(`[push-worker] Push sent for lead ${conversationId} (score ${leadScore})`);
  },
  {
    connection: createRedisConnection(),
    concurrency: 5,
  }
);

pushWorker.on('failed', (job, err) => {
  console.error(`[push-worker] Job ${job?.id} failed: ${err.message}`);
});
```

Add `pushWorker` to `src/workers/index.ts`.

### 5. Set EXPO_ACCESS_TOKEN (optional but recommended)

The Expo push API works without an access token (unauthenticated) for development, but an access token prevents rate limiting in production.

Get one at expo.dev → Account Settings → Access Tokens:

```bash
flyctl secrets set EXPO_ACCESS_TOKEN="your-expo-access-token" --app ai-folio
```

## Test it

With all workers running:

```bash
REDIS_URL=redis://localhost:6380 pnpm worker
pnpm dev
```

Send a chat message that would score high (e.g., "I'd like to offer you a senior TypeScript role at our startup"):

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hi! We have a senior TypeScript position open and your ai-folio project impressed us. Would you be interested in discussing?"}],"conversationId":"test-push-1"}'
```

Expected sequence (visible in worker terminal):
1. `[embedding-worker] Processing job 1`
2. `[lead-scoring] Score: 5, Intent: job_offer`
3. `[push-worker] Push sent for lead test-push-1`

Expected on your phone: notification appears within 5–10 seconds. Tapping it opens the lead detail screen.

## Mini-task
Add receipt checking: store `ExpoPushTicket` IDs in Redis (using `getRedis().setex`). After 5 minutes (BullMQ repeatable job), check receipts via `expo.getPushNotificationReceiptsAsync`. If any receipt has `status: 'error'` and `details.error === 'DeviceNotRegistered'`, call `clearPushTokenForUser` from Day 132.

## Glossary
- **`expo-server-sdk`** — Node.js SDK for the Expo push API; handles chunking, token validation, and receipt fetching.
- **`Expo.isExpoPushToken`** — validates that a string is a properly formatted Expo push token before sending.
- **Push ticket** — immediate response from the Expo API; contains an `id` for receipt lookup but does NOT confirm delivery.
- **Push receipt** — async delivery confirmation; available 30 seconds after sending; indicates actual delivery status.
- **`chunkPushNotifications`** — splits a large array of messages into batches of 100 (Expo API limit per request).

## Resources
- [Expo — sending push notifications (server)](https://docs.expo.dev/push-notifications/sending-notifications/)
- [expo-server-sdk — npm](https://www.npmjs.com/package/expo-server-sdk)
- [Expo push receipts](https://docs.expo.dev/push-notifications/sending-notifications/#check-push-receipt)

## Checklist
- [ ] `expo-server-sdk` installed in `ai-folio`
- [ ] `sendPushToAdmin()` fetches admin push token from DB and sends via Expo API
- [ ] `pushQueue` defined in `src/lib/queues/index.ts`
- [ ] `scoreAndNotify()` enqueues a push job when `leadScore >= 4`
- [ ] `push-worker.ts` processes jobs and calls `sendPushToAdmin`
- [ ] `pushWorker` added to `src/workers/index.ts`
- [ ] Test chat message triggers notification on physical device within 10 seconds
- [ ] Tapping notification navigates to the correct lead detail screen
