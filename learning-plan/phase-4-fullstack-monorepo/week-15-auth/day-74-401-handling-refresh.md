# Day 74 — 401 handling + token refresh

## Goal
Automatically refresh the access token when the API returns 401, implement the token refresh flow in the `apiFetch` client, and handle refresh failure by redirecting to login.

## Estimated time
~1.5 hours

## Prerequisites
Day 73 — protected routes. Day 72 — refresh token endpoint.

## Where to put your code
In `task-manager/apps/web/src/api/`.

## Explanation

Access tokens expire (15 minutes on Day 71). When they expire, every API call returns 401. Without automatic refresh, the user gets logged out every 15 minutes — terrible UX.

The fix: intercept 401 responses, silently call `POST /auth/refresh` to get a new access token (which sets a new `access_token` cookie), then retry the original request. If the refresh also fails (refresh token expired or revoked), redirect to login.

This pattern is called a **refresh interceptor**. It's the client-side equivalent of Laravel's middleware automatically renewing a session.

The tricky part: **concurrent requests**. If three requests all return 401 simultaneously, you don't want three parallel refresh calls. You want one refresh, then replay all three original requests. The solution is a singleton promise: if a refresh is already in progress, new 401 responses wait for the existing refresh to finish.

## Step-by-step

### 1. Refresh manager (singleton pattern)

```ts name=apps/web/src/api/refresh.ts
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let refreshPromise: Promise<boolean> | null = null;

export async function refreshTokens(): Promise<boolean> {
  // If a refresh is already in progress, wait for it
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null; // Reset after completion
    });

  return refreshPromise;
}
```

### 2. Update `apiFetch` with 401 retry

```ts name=apps/web/src/api/client.ts
import { z } from 'zod';
import { refreshTokens } from './refresh';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchOnce(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
}

export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  options?: RequestInit
): Promise<T> {
  let res = await fetchOnce(path, options);

  // Automatic token refresh on 401
  if (res.status === 401) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      res = await fetchOnce(path, options); // Retry with new cookie
    }
  }

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new ApiError(res.status, message, body);
  }

  return schema.parse(body);
}
```

### 3. Handle refresh failure — redirect to login

When refresh also returns 401 (refresh token expired), `refreshed` is `false`. The retry `apiFetch` throws `ApiError` with `status: 401`. Components need to react to this.

Option A: catch 401 in TanStack Query and trigger logout:

```ts name=apps/web/src/main.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 401 — refresh already attempted
        if (error instanceof ApiError && error.status === 401) return false;
        return failureCount < 1;
      },
    },
  },
});
```

Option B: global event approach — `apiFetch` dispatches a custom event when refresh fails, `AuthProvider` listens and calls `logout()`:

```ts name=apps/web/src/api/client.ts
// After failed refresh + failed retry:
if (!res.ok && res.status === 401) {
  window.dispatchEvent(new CustomEvent('auth:session-expired'));
}
```

```tsx name=apps/web/src/context/AuthContext.tsx
useEffect(() => {
  function handleSessionExpired() {
    setUser(null);
    // Router redirect is handled by <ProtectedRoute> reacting to user = null
  }
  window.addEventListener('auth:session-expired', handleSessionExpired);
  return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
}, []);
```

Option B is cleaner: no coupling between TanStack Query config and auth logic.

### 4. Test the refresh flow manually

Short-circuit the access token expiry for testing:

```ts name=apps/api/src/shared/config.ts
JWT_EXPIRES_IN: z.string().default('10s'), // 10 seconds for dev testing
```

1. Log in — access token lasts 10 seconds.
2. Wait 12 seconds.
3. Navigate to `/tasks` — watch the Network tab: see a `POST /auth/refresh` followed by the retried `GET /tasks`.

Restore to `15m` after testing.

### 5. TanStack Query integration

TanStack Query retries failed queries automatically. On 401, it would retry (and fail) multiple times before showing an error. Prevent this:

```ts
defaultOptions: {
  queries: {
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        return false;
      }
      return failureCount < 2;
    },
  },
}
```

## Test it

```bash
# In two terminals:
# Terminal 1: Start API with short token expiry
JWT_EXPIRES_IN=5s pnpm --filter @task-manager/api dev

# Terminal 2: Watch network in browser
# 1. Login, see tasks load
# 2. Wait 6 seconds
# 3. Navigate — see /auth/refresh fire, then tasks load again
```

## Mini-task
Add a `401 Interceptor Test` component accessible at `/dev/auth-test` (development only) with a button "Expire session now" that calls `POST /dev/expire-session` (an API endpoint you add that clears the access_token cookie without touching the refresh_token). Verify the refresh flow works end-to-end.

## Glossary
- **Refresh interceptor** — client-side logic catching 401 responses and transparently refreshing the token.
- **Singleton promise** — pattern ensuring only one refresh runs at a time; others wait for it.
- **`window.dispatchEvent`** — browser event bus; avoids coupling between API layer and React context.
- **TanStack Query `retry`** — function deciding whether to retry failed queries; must short-circuit on auth errors.

## Resources
- [TanStack Query — Error handling](https://tanstack.query.gg/docs/framework/react/guides/query-retries)
- [MDN — CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent)

## Checklist
- [ ] `refreshTokens()` singleton promise prevents concurrent refresh calls
- [ ] `apiFetch` retries original request after successful refresh
- [ ] `auth:session-expired` custom event dispatched on refresh failure
- [ ] `AuthProvider` listens for event and clears user state
- [ ] `<ProtectedRoute>` redirects when user becomes null
- [ ] TanStack Query configured not to retry on 401/403
- [ ] Short-token manual test confirmed refresh flow works
