# Day 125 — Auth — JWT tokens for mobile

## Goal
Implement authentication in `ai-folio-mobile`. After this day the app has a login screen, stores a JWT token securely, attaches it to every tRPC request, and redirects unauthenticated users to login. The ai-folio backend issues tokens via a new tRPC procedure.

## Estimated time
~2.5 hours

## Prerequisites
Day 124 (tRPC client connected). Day 92 (Auth.js setup in ai-folio).

## Where to put your code
Changes in both `ai-folio` (backend) and `ai-folio-mobile`.

## Explanation

**Why not use Auth.js sessions for mobile?** Auth.js sessions use HTTP-only cookies. Cookies work in browsers but are awkward in React Native — `fetch` in RN does not persist cookies across app restarts, and managing cookie jars manually is fragile. The standard mobile auth pattern is **JWT access tokens**: the app exchanges credentials for a token, stores it securely, and sends it in the `Authorization: Bearer <token>` header on every request.

**`expo-secure-store`** is the right place to store the JWT. It uses iOS Keychain and Android Keystore — the same encrypted storage that banking apps use. Never store tokens in `AsyncStorage` (unencrypted) or `useState` (lost on app restart).

**Token flow:**
1. User enters email + password on the Login screen
2. Mobile app calls `auth.login` tRPC mutation
3. Backend verifies credentials, returns a signed JWT
4. Mobile stores the JWT in SecureStore
5. Every subsequent tRPC request includes `Authorization: Bearer <jwt>`
6. `protectedProcedure` on the backend verifies the token (not the Auth.js session)

The web admin continues to use Auth.js sessions — you add JWT support alongside it, not instead of it.

## Step-by-step

### 1. Add JWT support to the ai-folio backend

```bash
cd ai-folio
pnpm add jsonwebtoken
pnpm add -D @types/jsonwebtoken
```

Add `JWT_SECRET` to `.env.local`:

```bash name=.env.local
JWT_SECRET=a-different-long-random-secret-from-nextauth
```

### 2. Create a mobile auth tRPC router

```ts name=src/lib/trpc/routers/auth.ts
import { z } from 'zod';
import { router, publicProcedure } from '../init';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRY = '7d';

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const user = await prisma.user.findUnique({ where: { email: input.email } });

      if (!user || !user.password) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(input.password, user.password);
      if (!valid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: JWT_EXPIRY,
      });

      return { token, user: { id: user.id, email: user.email, name: user.name } };
    }),

  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.jwtUser) return null;
    return ctx.jwtUser;
  }),
});
```

### 3. Update the context to accept both session and JWT

```ts name=src/lib/trpc/init.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';

interface JwtPayload {
  userId: string;
  email: string;
}

export async function createContext(opts: FetchCreateContextFnOptions) {
  const session = await getServerSession(authOptions);

  // JWT auth for mobile clients
  let jwtUser: JwtPayload | null = null;
  const authHeader = opts.req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      jwtUser = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET!) as JwtPayload;
    } catch {
      // Invalid or expired token — jwtUser stays null
    }
  }

  return { session, jwtUser };
}

type Context = Awaited<ReturnType<typeof createContext>>;
const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  // Accept either a web session or a mobile JWT
  if (!ctx.session && !ctx.jwtUser) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx });
});
```

Add `authRouter` to the root router:

```ts name=src/lib/trpc/router.ts
import { authRouter } from './routers/auth';
// ...existing imports

export const appRouter = router({
  auth: authRouter,
  conversations: conversationsRouter,
  leads: leadsRouter,
});
```

### 4. Install SecureStore in ai-folio-mobile

```bash
cd ai-folio-mobile
npx expo install expo-secure-store
```

### 5. Create an auth store

```ts name=src/lib/auth.ts
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'ai_folio_jwt';

export const authStore = {
  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },

  async setToken(token: string): Promise<void> {
    return SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async clearToken(): Promise<void> {
    return SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};
```

### 6. Inject the token into tRPC requests

Update the tRPC client to attach the JWT header:

```ts name=src/lib/trpc.ts
import { authStore } from './auth';

export const trpcClient = trpc.createClient({
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

### 7. Create the login screen

```tsx name=app/login.tsx
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { trpc } from '../src/lib/trpc';
import { authStore } from '../src/lib/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      await authStore.setToken(data.token);
      router.replace('/(admin)/conversations');
    },
    onError: (err) => {
      Alert.alert('Login failed', err.message);
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Login</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Pressable
        style={[styles.button, loginMutation.isPending && styles.buttonDisabled]}
        onPress={() => loginMutation.mutate({ email, password })}
        disabled={loginMutation.isPending}
      >
        <Text style={styles.buttonText}>
          {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 32, textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
    padding: 12, fontSize: 16, marginBottom: 16,
  },
  button: { backgroundColor: '#000', padding: 16, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

### 8. Guard admin routes

```tsx name=app/(admin)/_layout.tsx
import { useEffect, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authStore } from '../../src/lib/auth';
import { ActivityIndicator, View } from 'react-native';

export default function AdminLayout() {
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    authStore.getToken().then((token) => {
      if (!token) router.replace('/login');
      setChecking(false);
    });
  }, []);

  if (checking) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  }

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#000' }}>
      <Tabs.Screen name="conversations" options={{ title: 'Leads', tabBarIcon: ({ color }) => <Ionicons name="chatbubbles" size={24} color={color} /> }} />
      <Tabs.Screen name="kanban" options={{ title: 'Kanban', tabBarIcon: ({ color }) => <Ionicons name="grid" size={24} color={color} /> }} />
      <Tabs.Screen name="leads" options={{ href: null }} />
    </Tabs>
  );
}
```

## Test it

1. Open the app — it should redirect to `/login` (no token stored)
2. Enter valid admin credentials → redirects to conversations tab
3. Kill and reopen the app — should go directly to conversations (token persisted in SecureStore)
4. From the settings screen, clear the token and confirm redirect to login

```bash
# Verify the JWT is issued correctly
curl -X POST 'http://192.168.1.100:3000/api/trpc/auth.login' \
  -H "Content-Type: application/json" \
  -d '{"0":{"json":{"email":"admin@example.com","password":"yourpassword"}}}'
```

Expected: JSON response with `token` and `user` fields.

## Mini-task
Add token expiry handling: when a tRPC call returns a `UNAUTHORIZED` error (expired token), the app should clear the stored token and redirect to `/login`. Implement this as a TanStack Query `onError` callback in the `QueryClient` default options.

## Glossary
- **JWT (JSON Web Token)** — self-contained signed token; the server verifies the signature to confirm authenticity without a database lookup.
- **`expo-secure-store`** — Expo API for encrypted key-value storage backed by iOS Keychain and Android Keystore.
- **`Authorization: Bearer`** — HTTP header convention for token-based auth; the server reads and verifies the token from this header.
- **`TRPCError({ code: 'UNAUTHORIZED' })`** — tRPC error that maps to HTTP 401; client receives it as a thrown error in `useMutation.onError`.
- **`useMutation`** — tRPC hook for non-idempotent operations (POST/PUT/DELETE equivalent); returns `mutate`, `isPending`, `onSuccess`, `onError`.

## Resources
- [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [tRPC — error handling](https://trpc.io/docs/server/error-handling)
- [jsonwebtoken — npm](https://www.npmjs.com/package/jsonwebtoken)

## Checklist
- [ ] `JWT_SECRET` env var set in `ai-folio`'s `.env.local` and Fly.io secrets
- [ ] `auth.login` tRPC mutation issues a signed JWT on valid credentials
- [ ] `createContext` reads both Auth.js session and `Authorization: Bearer` header
- [ ] `protectedProcedure` accepts either session or JWT
- [ ] `expo-secure-store` installed; `authStore` stores/retrieves/clears token
- [ ] tRPC `headers` callback attaches `Authorization: Bearer <token>`
- [ ] Login screen calls `auth.login` mutation and stores returned token
- [ ] Admin layout redirects to `/login` if no token found in SecureStore
- [ ] Token persists across app restarts
