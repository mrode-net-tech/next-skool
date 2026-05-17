# Day 75 — Logout

## Goal
Implement a complete, secure logout flow: clear cookies server-side, invalidate all TanStack Query caches, and handle the edge case where logout itself fails.

## Estimated time
~1 hour

## Prerequisites
Day 74 — token refresh working. Day 73 — `useAuth()` with `logout()`.

## Where to put your code
In `task-manager/apps/api/` and `apps/web/`.

## Explanation

Logout seems trivial — delete the cookie, done. But there are three things that go wrong if you don't think it through:

1. **Stale TanStack Query cache**: after logout, the cache still holds the previous user's tasks. If another user logs in on the same browser, they briefly see the previous user's data.
2. **In-flight requests**: a request may be in-flight when logout happens. The response arrives after logout — it shouldn't update the cache.
3. **Concurrent tabs**: if the user is logged in on two tabs and logs out in one, the other tab still shows protected content. `BroadcastChannel` solves this.

Today you implement all three.

## Step-by-step

### 1. Server-side logout (already done on Day 72)

```ts name=apps/api/src/auth/auth.router.ts
authRouter.post('/logout', (req, res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token', { path: '/auth/refresh' });
  res.json({ ok: true });
});
```

Verify this is wired up. Also add `authenticate` middleware if you want to log the logout event:

```ts
authRouter.post('/logout', authenticate, (req, res) => {
  // req.user available here for audit logging
  res.clearCookie('access_token');
  res.clearCookie('refresh_token', { path: '/auth/refresh' });
  res.json({ ok: true });
});
```

### 2. Full logout in `AuthContext` — clear query cache

```tsx name=apps/web/src/context/AuthContext.tsx
import { useQueryClient } from '@tanstack/react-query';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ... useEffect for session restore

  const broadcastChannel = new BroadcastChannel('auth');

  async function logout() {
    try {
      await fetch(`${BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      // Ignore network error — still clear local state
    }
    setUser(null);
    queryClient.clear(); // Wipe all cached data
    broadcastChannel.postMessage({ type: 'logout' });
  }

  // Listen for logout from other tabs
  useEffect(() => {
    const channel = new BroadcastChannel('auth');
    channel.onmessage = (event: MessageEvent<{ type: string }>) => {
      if (event.data.type === 'logout') {
        setUser(null);
        queryClient.clear();
      }
    };
    return () => channel.close();
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, loading, login: setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

`queryClient.clear()` removes all cached queries. The next navigation to a protected route triggers fresh fetches — no stale data from the previous user.

### 3. Cancel in-flight requests on logout

TanStack Query can cancel queries that are running when the cache is cleared:

```ts
// In logout():
queryClient.cancelQueries(); // Cancel all in-flight queries
queryClient.clear();         // Then clear the cache
```

`cancelQueries()` aborts fetch via `AbortController` if your `queryFn` supports it.

### 4. Logout button — confirm for safety

```tsx name=apps/web/src/layouts/RootLayout.tsx
function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  if (!user) return <NavLink to="/login">Sign in</NavLink>;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-300">{user.name ?? user.email}</span>
      <button
        onClick={() => void handleLogout()}
        className="text-xs text-slate-400 hover:text-white underline"
      >
        Sign out
      </button>
    </div>
  );
}
```

Navigate to `/login` with `replace: true` after logout so the user can't hit "back" to return to the protected page.

### 5. Auth flow summary

At this point the complete auth flow works:

```
Register → POST /auth/register → cookies set → redirect to /tasks
Login    → POST /auth/login    → cookies set → redirect to /tasks
           (15-min access token + 7-day refresh token)

Each request → cookie sent automatically → authenticate middleware validates
401 response → apiFetch intercepts → POST /auth/refresh → retry request
Refresh fail → session-expired event → user set to null → <ProtectedRoute> redirects to /login

Logout → POST /auth/logout → cookies cleared → queryClient.clear() → BroadcastChannel → redirect to /login
```

## Test it

1. Log in on two tabs.
2. Log out in Tab 1 — Tab 2 should also log out (BroadcastChannel).
3. Click "back" after logout in Tab 1 — `/tasks` redirects to `/login` again.
4. Check DevTools → Application → Cookies — both cookies are gone after logout.

## Mini-task
Add a `session-expired` page at `/session-expired` that explains "Your session has expired, please sign in again." Update the `auth:session-expired` event handler to navigate there instead of to `/login`.

## Glossary
- **`queryClient.clear()`** — removes all queries from the TanStack Query cache.
- **`BroadcastChannel`** — browser API for cross-tab communication within the same origin.
- **`cancelQueries()`** — aborts all in-flight TanStack Query fetches via AbortController.
- **`navigate(..., { replace: true })`** — replaces history entry so "back" doesn't return to the previous page.

## Resources
- [MDN — BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)
- [TanStack Query — `clear()`](https://tanstack.query.gg/docs/reference/QueryClient#queryclientclear)

## Checklist
- [ ] `POST /auth/logout` clears both cookies server-side
- [ ] `logout()` in AuthContext calls API + clears query cache + broadcasts
- [ ] BroadcastChannel listener logs out all open tabs
- [ ] Navigate to `/login` with `replace: true` after logout
- [ ] Back button after logout redirects to `/login` (protected route check)
- [ ] Cookies verified absent in DevTools after logout
