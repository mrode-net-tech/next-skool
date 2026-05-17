# Day 132 — Push token registration + storage

## Goal
Store the push token in the ai-folio database (linked to the admin user) and update it on every app launch. After this day the backend can look up the current push token for any user — the foundation for server-initiated notifications.

## Estimated time
~1.5 hours

## Prerequisites
Day 131 (push token generated). Day 125 (JWT auth — user identity established).

## Where to put your code
Changes in both `ai-folio` (backend) and `ai-folio-mobile`.

## Explanation

**Why store the token in the database?** A push token can change — when the user reinstalls the app, when APNs rotates tokens, or when the user gets a new device. If the backend hardcodes a token, notifications stop working silently after any of these events. By sending the current token on every app launch and upserting it in the database, the backend always has a fresh token.

**Token per user, not per device:** `ai-folio` has one admin user (you). The token is stored on the `User` model. If you ever support multiple admin devices, you would store a `DeviceToken` model with `userId` + `token` + `platform`. For now, a single token per user is sufficient.

**Security:** the token registration endpoint requires a valid JWT (it's a `protectedProcedure`). An attacker cannot register their push token for your user account without your JWT.

## Step-by-step

### 1. Add pushToken field to the User model

```prisma name=prisma/schema.prisma
model User {
  // existing fields...
  pushToken   String?   @db.Text
  pushTokenUpdatedAt DateTime?
}
```

```bash
pnpm prisma migrate dev --name add-push-token
```

### 2. Add a registerPushToken tRPC procedure

```ts name=src/lib/trpc/routers/auth.ts
// Add to authRouter:
  registerPushToken: protectedProcedure
    .input(z.object({ token: z.string().startsWith('ExponentPushToken[') }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.jwtUser?.userId ?? ctx.session?.user?.id;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      await prisma.user.update({
        where: { id: userId },
        data: { pushToken: input.token, pushTokenUpdatedAt: new Date() },
      });

      return { registered: true };
    }),
```

### 3. Register the token in the mobile app after auth

Update the notifications setup in `app/_layout.tsx` to send the token to the backend:

```ts name=src/lib/notifications.ts
import { trpc } from './trpc';

// Call this after the user is authenticated
export async function syncPushToken() {
  const token = await registerForPushNotifications();
  if (!token) return;

  // Store locally for reference
  await SecureStore.setItemAsync('push_token', token);

  // Send to backend — the tRPC call attaches the JWT automatically
  // Note: cannot use React hooks here (this is not a component)
  // Use the vanilla tRPC client instead
  await trpcVanillaClient.auth.registerPushToken.mutate({ token });
}
```

Add a vanilla (non-React) tRPC client for use outside of components:

```ts name=src/lib/trpc.ts
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@ai-folio/trpc-client';
import { authStore } from './auth';
import { TRPC_URL } from './config';

// React hooks client (for components)
export { trpc } from '@ai-folio/trpc-client';

// Vanilla client (for services, utilities, outside of React)
export const trpcVanillaClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: TRPC_URL,
      headers: async () => {
        const token = await authStore.getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
```

Call `syncPushToken()` in the admin layout (after confirming the user is authenticated):

```tsx name=app/(admin)/_layout.tsx
import { syncPushToken } from '../../src/lib/notifications';

// In useEffect after auth check passes:
useEffect(() => {
  authStore.getToken().then((token) => {
    if (token) {
      syncPushToken().catch(console.error);
    } else {
      router.replace('/login');
    }
    setChecking(false);
  });
}, []);
```

### 4. Verify token storage

```bash
# Check the database
docker-compose exec postgres psql -U folio -d folio_dev \
  -c 'SELECT email, "pushToken", "pushTokenUpdatedAt" FROM "User";'
```

Expected: your user's row has a non-null `pushToken` starting with `ExponentPushToken[`.

### 5. Handle token rotation

When Expo issues a new token (after reinstall), `syncPushToken` sends the new token and the database upserts it. But the backend also needs to handle invalid token responses from the Expo push API (Day 133) — when Expo reports a `DeviceNotRegistered` error, clear the stored token:

```ts name=src/lib/push.ts
export async function clearPushTokenForUser(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { pushToken: null, pushTokenUpdatedAt: new Date() },
  });
}
```

## Test it

1. Open the app (authenticated)
2. Check the terminal — `[notifications] Push token registered` log appears
3. Verify in the database that `pushToken` is set
4. Reinstall the app, open again — a new token may be issued and the database record updates

```bash
# Confirm token in DB
docker-compose exec postgres psql -U folio -d folio_dev \
  -c 'SELECT "pushToken" FROM "User" LIMIT 1;'
```

## Mini-task
Add a `GET /api/admin/push-status` Route Handler (auth-gated) that returns whether the current user has a registered push token and when it was last updated. Display this in the Settings screen so you can see at a glance whether push notifications are configured.

## Glossary
- **Token rotation** — when APNs or FCM issues a new push token for a device; happens on reinstall, OS upgrade, or token refresh cycle.
- **`DeviceNotRegistered`** — Expo push error indicating the token is no longer valid; triggers cleanup.
- **Vanilla tRPC client** — `createTRPCClient` (not `createTRPCReact`); works outside of React components; no hooks.
- **`SecureStore`** — local encrypted storage; used here to cache the token locally in addition to persisting it on the server.

## Resources
- [Expo Notifications — token management](https://docs.expo.dev/push-notifications/push-notifications-setup/#get-a-push-notification-token)
- [tRPC — vanilla client](https://trpc.io/docs/client/vanilla)

## Checklist
- [ ] `pushToken` and `pushTokenUpdatedAt` fields added to `User` model
- [ ] `auth.registerPushToken` tRPC mutation saves token linked to authenticated user
- [ ] Vanilla tRPC client created for use outside React components
- [ ] `syncPushToken()` called after admin auth is confirmed
- [ ] Database row shows non-null `pushToken` after first app launch
- [ ] Reinstalling the app updates the token in the database
