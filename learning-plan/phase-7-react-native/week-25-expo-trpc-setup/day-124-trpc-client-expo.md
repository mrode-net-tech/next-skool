# Day 124 — tRPC client in Expo

## Goal
Connect `ai-folio-mobile` to the tRPC backend from Day 123. After this day the mobile app calls the same typed procedures as the web admin — shared types, zero duplication, full autocomplete in VS Code.

## Estimated time
~2 hours

## Prerequisites
Day 123 (tRPC backend running). Day 122 (Expo Router navigation).

## Where to put your code
In `ai-folio-mobile`.

## Explanation

**Sharing `AppRouter` between web and mobile** is the core value proposition of tRPC. The `AppRouter` type (exported from `ai-folio`) is imported by both `ai-folio` (web) and `ai-folio-mobile` (React Native). The type travels at zero runtime cost — it is erased after TypeScript compilation. What remains is a typed HTTP client that calls `/api/trpc`.

**Two options for sharing the type:**
1. **Direct import via relative path** — `ai-folio-mobile` imports from `../ai-folio/src/lib/trpc/router`. Simple, works immediately, requires both projects to be siblings in the filesystem.
2. **Monorepo package** (`packages/api-client`) — the formal approach; Day 130 covers this.

Today you use option 1 for speed. Day 130 refactors to option 2.

**`@trpc/client` in React Native** uses `httpLink` (not `httpBatchLink`) by default because React Native's `fetch` does not support HTTP/2 multiplexing. Batching still works — use `httpBatchLink` — but avoid `splitLink` patterns that depend on browser-specific APIs.

## Step-by-step

### 1. Install tRPC client dependencies in ai-folio-mobile

```bash
cd ai-folio-mobile
pnpm add @trpc/client @trpc/react-query @tanstack/react-query zod
```

### 2. Set the backend URL

```ts name=src/lib/config.ts
import Constants from 'expo-constants';

// In development: your machine's IP (not localhost — the simulator/device can't reach localhost)
// In production: https://ai-folio.fly.dev
const DEV_API_URL = 'http://192.168.1.100:3000';  // replace with your local IP

export const API_URL =
  Constants.expoConfig?.extra?.apiUrl ??
  (process.env.NODE_ENV === 'production'
    ? 'https://ai-folio.fly.dev'
    : DEV_API_URL);

export const TRPC_URL = `${API_URL}/api/trpc`;
```

Find your local IP:

```bash
# macOS
ipconfig getifaddr en0

# Linux
ip addr show | grep 'inet ' | grep -v '127.0.0.1'
```

The simulator runs as a separate device and cannot reach `localhost` — you must use your machine's LAN IP.

### 3. Create the tRPC client

```ts name=src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import { QueryClient } from '@tanstack/react-query';
import { TRPC_URL } from './config';

// Import AppRouter type only — no runtime code from ai-folio
import type { AppRouter } from '../../ai-folio/src/lib/trpc/router';

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,      // 30 seconds before refetch
      retry: 2,
    },
  },
});

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: TRPC_URL,
      headers: () => ({
        // Auth token injected in Day 125
        // Authorization: `Bearer ${getToken()}`,
      }),
    }),
  ],
});
```

### 4. Wrap the app with providers

```tsx name=app/_layout.tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { trpc, trpcClient, queryClient } from '../src/lib/trpc';

export default function RootLayout() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack>
          <Stack.Screen name="index" options={{ title: 'ai-folio' }} />
          <Stack.Screen name="(admin)" options={{ headerShown: false }} />
          <Stack.Screen
            name="(admin)/leads/[id]"
            options={{ title: 'Lead Detail', presentation: 'card' }}
          />
        </Stack>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

### 5. Test the connection with a real query

```tsx name=app/(admin)/conversations.tsx
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../src/lib/trpc';

export default function ConversationsScreen() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = trpc.conversations.list.useQuery({ limit: 20 });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load: {error.message}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data?.conversations}
      keyExtractor={(item) => item.id}
      onRefresh={refetch}
      refreshing={isLoading}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => router.push(`/(admin)/leads/${item.id}`)}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.intent}>{item.intent?.replace('_', ' ') ?? 'unknown'}</Text>
            <Text style={styles.score}>{'★'.repeat(item.leadScore ?? 0)}</Text>
          </View>
          <Text style={styles.preview} numberOfLines={2}>
            {item.messages[0]?.content ?? 'No messages'}
          </Text>
          <Text style={styles.date}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#ef4444', fontSize: 16 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  intent: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  score: { color: '#f59e0b', fontSize: 14 },
  preview: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 8 },
  date: { fontSize: 12, color: '#999' },
});
```

### 6. Verify type safety

In VS Code, hover over `data?.conversations` in the component above. You should see the full Prisma type — `Conversation & { messages: Message[] }` — inferred from the tRPC procedure definition in `ai-folio`. No manual type definition in the mobile project.

Change the procedure input to `{ limit: 'bad' }` — TypeScript should immediately report an error in the mobile project without needing to run the app.

## Test it

Start both projects:

```bash
# Terminal 1: ai-folio backend
cd ai-folio && pnpm dev

# Terminal 2: mobile app
cd ai-folio-mobile && npx expo start
```

Open the mobile app. The Conversations screen should show real data from the tRPC backend. Pull down to refresh triggers `refetch`.

If you see a network error:
- Confirm `DEV_API_URL` has your machine's LAN IP, not `localhost`
- Confirm `ai-folio` backend is running on port 3000
- Confirm your phone/simulator is on the same network as your machine

## Mini-task
Add a `stats` query call to the home screen (`app/index.tsx`) that shows the total number of conversations and how many are high-scoring (`leadScore >= 4`). Use `trpc.leads.highScore.useQuery({ minScore: 4 })` and display the count. This confirms the tRPC client works from multiple screens.

## Glossary
- **`createTRPCReact`** — creates a typed tRPC client with React hooks (`useQuery`, `useMutation`); hooks mirror TanStack Query exactly.
- **`httpBatchLink`** — tRPC link that batches multiple concurrent queries into one HTTP request.
- **LAN IP** — local network IP address; required because simulators/devices cannot reach `localhost` on the host machine.
- **Type-only import** — `import type { AppRouter }` imports the TypeScript type but zero runtime code; the mobile bundle does not include any server code.
- **`staleTime`** — TanStack Query option; data is considered fresh for this duration; no refetch during this window.

## Resources
- [tRPC — React Native](https://trpc.io/docs/client/react-query)
- [Expo Constants — extra config](https://docs.expo.dev/versions/latest/sdk/constants/)
- [TanStack Query — React Native](https://tanstack.com/query/latest/docs/framework/react/react-native)

## Checklist
- [ ] `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query` installed in `ai-folio-mobile`
- [ ] `API_URL` uses LAN IP in development (not `localhost`)
- [ ] `AppRouter` type imported from `ai-folio` — no runtime code
- [ ] `trpc.Provider` and `QueryClientProvider` wrap the root layout
- [ ] `ConversationsScreen` calls `trpc.conversations.list.useQuery` and renders real data
- [ ] Pull-to-refresh works via `onRefresh={refetch}`
- [ ] TypeScript error appears when wrong input type is passed to `useQuery`
