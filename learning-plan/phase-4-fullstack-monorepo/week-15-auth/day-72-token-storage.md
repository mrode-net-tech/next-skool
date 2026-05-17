# Day 72 — Token storage: httpOnly cookie vs localStorage

## Goal
Understand the security trade-offs between storing JWTs in `localStorage` vs `httpOnly` cookies, implement cookie-based storage for the access token, and switch `apps/web` to the cookie approach.

## Estimated time
~1.5 hours

## Prerequisites
Day 71 — login endpoints + login form storing to `localStorage`.

## Where to put your code
In `task-manager/apps/api/` and `apps/web/`.

## Explanation

This is a security-critical day. Read carefully — wrong token storage is one of the most common frontend vulnerabilities.

**localStorage** is accessible to any JavaScript on your page. If your app has an XSS vulnerability (e.g., from a compromised npm package, an unsanitised user input rendered as HTML, or a third-party script), the attacker can steal the token with `localStorage.getItem('accessToken')`. Stolen JWTs are credentials.

**httpOnly cookies** are set by the server and inaccessible to JavaScript. `document.cookie` cannot read them. The browser sends them automatically with every request to the matching domain. An XSS attack cannot steal the token — it can use the cookie but cannot exfiltrate it.

**CSRF** is the other side: cookies are sent automatically, so a forged request from another domain would include the cookie. Defence: `SameSite=Strict` or `SameSite=Lax` cookie attribute (modern browsers default to Lax) + a CSRF token for state-changing requests. In practice, `SameSite=Strict` + HTTPS makes CSRF nearly impossible.

**Decision for this project:** use `httpOnly` cookies for the access token. The refresh token is never sent to the browser at all (stored server-side in a DB or Redis). This is the approach used by Auth.js (Phase 5) and is the safest pattern available.

| | localStorage | httpOnly cookie |
|---|---|---|
| XSS vulnerability | Steals token | Cannot steal token |
| CSRF vulnerability | Immune (manual header) | Mitigated by SameSite |
| Mobile apps | Works | Complex (custom cookie handling) |
| Simplicity | Easy | Requires CORS `credentials: 'include'` |

## Step-by-step

### 1. Install cookie parser in `apps/api`

```bash
pnpm --filter @task-manager/api add cookie-parser
pnpm --filter @task-manager/api add -D @types/cookie-parser
```

```ts name=apps/api/src/app.ts
import cookieParser from 'cookie-parser';
app.use(cookieParser());
```

Update CORS config to allow credentials:

```ts name=apps/api/src/app.ts
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true, // Required for cookies to be sent cross-origin
}));
```

### 2. Set cookie on login/register

```ts name=apps/api/src/auth/auth.router.ts
function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
  const isProd = process.env.NODE_ENV === 'production';

  res.cookie('access_token', tokens.accessToken, {
    httpOnly: true,
    secure: isProd,         // HTTPS only in production
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes in ms
  });

  // Refresh token: longer-lived, stricter path
  res.cookie('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/auth/refresh',  // Only sent to the refresh endpoint
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

authRouter.post('/login', validateBody(LoginSchema), async (req, res) => {
  try {
    const result = await authService.login(req.body);
    setAuthCookies(res, result.tokens);
    // Return user but NOT tokens in response body
    res.json({ user: result.user });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    res.status(e.status ?? 500).json({ error: e.message });
  }
});
```

### 3. Update `authenticate` middleware to read from cookie

```ts name=apps/api/src/middleware/authenticate.ts
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  // Try cookie first, then Authorization header (for API clients/mobile)
  const token =
    (req.cookies as Record<string, string>)['access_token'] ??
    req.headers.authorization?.slice(7);

  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }

  try {
    const payload = authService.verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    (req as Request & { user: typeof user }).user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

### 4. Refresh token endpoint

```ts name=apps/api/src/auth/auth.router.ts
authRouter.post('/refresh', async (req, res) => {
  const refreshToken = (req.cookies as Record<string, string>)['refresh_token'];
  if (!refreshToken) {
    res.status(401).json({ error: 'Missing refresh token' });
    return;
  }

  try {
    const payload = authService.verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    const result = authService.buildAuthResponse(user);
    setAuthCookies(res, result.tokens);
    res.json({ user: result.user });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

Add `verifyRefreshToken` to `AuthService`:
```ts
verifyRefreshToken(token: string): { sub: string } {
  const payload = jwt.verify(token, config.JWT_SECRET) as { sub: string; type?: string };
  if (payload.type !== 'refresh') throw new Error('Not a refresh token');
  return payload;
}
```

### 5. Update `apps/web` — remove localStorage, add `credentials: 'include'`

```ts name=apps/web/src/api/client.ts
import createClient from 'openapi-fetch';
import type { paths } from '@task-manager/api-client';

export const apiClient = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  credentials: 'include', // Send cookies cross-origin
});
```

For the manual `apiFetch`:
```ts
export async function apiFetch<T>(path: string, schema: z.ZodType<T>, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include', // Always include cookies
  });
  // ...
}
```

### 6. Update `LoginPage` — no more localStorage

```ts name=apps/web/src/pages/LoginPage.tsx
async function onSubmit(data: LoginInput) {
  setApiError(null);
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include', // Receive and store cookie
  });

  if (!res.ok) {
    const body = await res.json() as { error: string };
    setApiError(body.error);
    return;
  }

  // No need to store token — cookie is set by the browser automatically
  navigate('/tasks');
}
```

### 7. Logout endpoint

```ts name=apps/api/src/auth/auth.router.ts
authRouter.post('/logout', (req, res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token', { path: '/auth/refresh' });
  res.json({ ok: true });
});
```

## Test it

```bash
# Login — check response headers for Set-Cookie
curl -c cookies.txt -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Password123"}' -v

# Use saved cookie
curl -b cookies.txt http://localhost:3000/tasks
```

In the browser: DevTools → Application → Cookies → `localhost` → verify `access_token` is `HttpOnly`.

## Mini-task
Implement `POST /auth/refresh` in the web app: a function `refreshTokens()` that hits the endpoint and updates the user state. Call it automatically when the app loads to restore the session.

## Glossary
- **httpOnly** — cookie attribute preventing JS access; immune to token theft via XSS.
- **`SameSite: Strict`** — cookie only sent on same-site requests; CSRF protection.
- **`credentials: 'include'`** — fetch option required to send/receive cookies cross-origin.
- **Refresh token** — long-lived token used only to obtain new access tokens.
- **CORS with credentials** — requires server `Access-Control-Allow-Credentials: true` and specific `Origin` (not `*`).

## Resources
- [MDN — Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [OWASP — JWT Security](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Pillar Security — JWT Storage](https://pillarsecurity.com/jwt-vs-session-cookies/)

## Checklist
- [ ] `cookie-parser` installed + wired in `app.ts`
- [ ] CORS `credentials: true` + specific origin
- [ ] `setAuthCookies` sets `httpOnly`, `sameSite: 'strict'`
- [ ] Refresh token on path `/auth/refresh` only
- [ ] `authenticate` middleware reads from cookie (or header)
- [ ] `apps/web` fetch calls use `credentials: 'include'`
- [ ] Login no longer stores to localStorage
- [ ] `POST /auth/logout` clears cookies
- [ ] Browser DevTools confirms `HttpOnly` flag on cookie
