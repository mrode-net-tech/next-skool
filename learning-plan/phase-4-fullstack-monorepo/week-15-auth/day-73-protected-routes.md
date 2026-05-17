# Day 73 — Protected routes (web)

## Goal
Build an auth context in `apps/web`, create a `<ProtectedRoute>` component that redirects unauthenticated users to `/login`, and implement `useCurrentUser` hook.

## Estimated time
~1.5 hours

## Prerequisites
Day 72 — httpOnly cookie auth working. React Router routes from Day 47.

## Where to put your code
In `task-manager/apps/web/src/`.

## Explanation

Client-side route protection works differently from server-side. In Laravel, a middleware redirects before the response reaches the browser. In React Router, the page component renders first, then checks auth — if you're not careful, protected content flickers before the redirect.

React Router v6's `loader` (from Day 50) can check auth before render and redirect before the component ever renders. Alternatively, a `<ProtectedRoute>` wrapper component renders `null` (or a spinner) while checking auth, then redirects or renders children.

**Auth context** stores the current user globally — it's the equivalent of Laravel's `Auth::user()`. Components anywhere in the tree can call `useCurrentUser()` to get the logged-in user without prop drilling.

The auth state initialises from the server: on page load, hit `GET /auth/me` to check if the cookie is valid. If it is, populate the context. If not, the user is guest.

## Step-by-step

### 1. Auth context

```tsx name=apps/web/src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@task-manager/types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from cookie on app load
    fetch(`${BASE}/auth/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() as Promise<{ user: User }> : null))
      .then((data) => { if (data) setUser(data.user); })
      .catch(() => {}) // No session — stay as guest
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await fetch(`${BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login: setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
```

Wrap in `main.tsx`:
```tsx
<ThemeProvider>
  <AuthProvider>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </AuthProvider>
</ThemeProvider>
```

### 2. Add `GET /auth/me` to the API

```ts name=apps/api/src/auth/auth.router.ts
import { authenticate } from '../middleware/authenticate';

authRouter.get('/me', authenticate, (req, res) => {
  const { passwordHash, ...user } = (req as Request & { user: { passwordHash: string } }).user;
  void passwordHash; // excluded from response
  res.json({ user });
});
```

### 3. `<ProtectedRoute>` component

```tsx name=apps/web/src/components/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from './ui/Spinner';

interface Props {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking session…" />;

  if (!user) {
    // Redirect to login, remembering where the user was going
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
```

### 4. Wire into the router

```tsx name=apps/web/src/router.tsx
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      {
        path: 'tasks',
        element: (
          <ProtectedRoute>
            <TasksLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <TasksPage />, loader: fetchTasks, errorElement: <p>Failed</p> },
          { path: ':id', element: <TaskDetailPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
```

### 5. Redirect back after login

```tsx name=apps/web/src/pages/LoginPage.tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Where the user was trying to go before being redirected
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/tasks';

  async function onSubmit(data: LoginInput) {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });

    if (!res.ok) {
      const body = await res.json() as { error: string };
      setApiError(body.error);
      return;
    }

    const { user } = await res.json() as { user: User };
    login(user); // Update auth context immediately
    navigate(from, { replace: true }); // Go to original destination
  }
  // ...
}
```

### 6. Nav bar shows user + logout

```tsx name=apps/web/src/layouts/RootLayout.tsx
import { useAuth } from '@/context/AuthContext';

function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return <Link to="/login" className="text-sm text-slate-300 hover:text-white">Sign in</Link>;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-300">{user.name ?? user.email}</span>
      <button
        onClick={() => void logout()}
        className="text-xs text-slate-400 hover:text-white"
      >
        Sign out
      </button>
    </div>
  );
}
```

## Test it

1. Open `/tasks` while logged out — redirected to `/login`.
2. Log in — redirected back to `/tasks`.
3. Refresh page — still logged in (cookie persists, `/auth/me` returns user).
4. Click "Sign out" — redirected to `/login`, `/tasks` is protected again.

## Mini-task
Add a `<GuestRoute>` component that redirects already-authenticated users away from `/login` to `/tasks`. (The inverse of `<ProtectedRoute>`.)

## Glossary
- **Auth context** — React context holding the current user and auth operations.
- **`<Navigate>`** — React Router component that redirects programmatically in JSX.
- **`location.state`** — data passed between routes; used here to remember pre-redirect destination.
- **`replace`** — navigate option that replaces history entry instead of pushing; prevents back-button returning to login.

## Resources
- [React Router — Authentication](https://reactrouter.com/en/main/start/tutorial#protecting-routes)
- [React — Context](https://react.dev/learn/passing-data-deeply-with-context)

## Checklist
- [ ] `AuthProvider` wraps the app, fetches `/auth/me` on load
- [ ] `useAuth()` hook returns `{ user, loading, login, logout }`
- [ ] `<ProtectedRoute>` redirects to `/login` when no user
- [ ] `<ProtectedRoute>` shows spinner while auth is loading
- [ ] Login redirects to original destination using `location.state`
- [ ] Nav bar shows user name + sign out button when logged in
- [ ] Refresh persists session via cookie + `/auth/me`
