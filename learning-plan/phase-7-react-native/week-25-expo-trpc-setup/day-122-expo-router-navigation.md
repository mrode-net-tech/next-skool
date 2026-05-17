# Day 122 — Expo Router navigation

## Goal
Master Expo Router's navigation patterns: stack navigation, tabs, dynamic routes, and programmatic navigation. After this day you can build any navigation structure the mobile app needs and understand how it maps to Next.js concepts you already know.

## Estimated time
~2 hours

## Prerequisites
Day 121 (Expo project running with basic tab layout).

## Where to put your code
In `ai-folio-mobile`.

## Explanation

**Expo Router** is file-system routing for React Native — it works identically to Next.js App Router in terms of file naming conventions. `app/index.tsx` → `/`, `app/leads/[id].tsx` → `/leads/:id`, `app/(admin)/_layout.tsx` → a layout wrapping all admin screens. If you understand Next.js routing, you already understand Expo Router's file structure.

**Navigation primitives in React Native** differ from the web. There is no browser history stack. Navigation state is managed by the router library. Expo Router wraps React Navigation internally — a `Stack` navigator manages a stack of screens (push/pop), a `Tab` navigator shows persistent bottom tabs, a `Drawer` navigator slides in from the side.

**The key mental shift from web:** on the web, the user can type any URL. On mobile, the user can only navigate to screens your app explicitly creates. Deep linking (opening a specific screen from a push notification) is the mobile equivalent of a direct URL visit — and Expo Router handles it automatically using the same `scheme://` URI you set in `app.json`.

In Laravel terms: Expo Router is like Laravel's route files combined with the view hierarchy — the file structure _is_ the route definition.

## Step-by-step

### 1. Add a dynamic lead detail route

```tsx name=app/(admin)/leads/[id].tsx
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Lead ID</Text>
      <Text style={styles.value}>{id}</Text>

      <Text style={styles.label}>Status</Text>
      <Text style={styles.value}>Placeholder — tRPC data on Day 126</Text>

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back to Leads</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 8 },
  label: { fontSize: 12, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 16, fontWeight: '500', marginBottom: 16 },
  backButton: { marginTop: 24 },
  backText: { color: '#0066cc', fontSize: 16 },
});
```

### 2. Set up the Stack screen header for the detail route

Update the admin layout to declare the `leads/[id]` screen options:

```tsx name=app/(admin)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AdminLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#000' }}>
      <Tabs.Screen
        name="conversations"
        options={{
          title: 'Leads',
          tabBarIcon: ({ color }) => <Ionicons name="chatbubbles" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="kanban"
        options={{
          title: 'Kanban',
          tabBarIcon: ({ color }) => <Ionicons name="grid" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          href: null,           // hide from tab bar — this is a nested stack, not a tab
        }}
      />
    </Tabs>
  );
}
```

The root `_layout.tsx` stack handles the leads detail screen as a modal push over the tabs:

```tsx name=app/_layout.tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'ai-folio' }} />
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen
          name="(admin)/leads/[id]"
          options={{ title: 'Lead Detail', presentation: 'card' }}
        />
      </Stack>
    </>
  );
}
```

### 3. Navigate to the detail screen from a list

Add a sample list to the conversations screen:

```tsx name=app/(admin)/conversations.tsx
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

const SAMPLE_LEADS = [
  { id: 'lead-1', intent: 'job_offer', score: 5, preview: 'Hi, we have a senior role...' },
  { id: 'lead-2', intent: 'collab', score: 4, preview: 'I love your projects, want to...' },
  { id: 'lead-3', intent: 'question', score: 2, preview: 'Quick question about your stack...' },
];

export default function ConversationsScreen() {
  const router = useRouter();

  return (
    <FlatList
      data={SAMPLE_LEADS}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => router.push(`/(admin)/leads/${item.id}`)}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.intent}>{item.intent.replace('_', ' ')}</Text>
            <Text style={styles.score}>{'★'.repeat(item.score)}</Text>
          </View>
          <Text style={styles.preview} numberOfLines={2}>{item.preview}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
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
  preview: { fontSize: 14, color: '#666', lineHeight: 20 },
});
```

### 4. Programmatic navigation patterns

```tsx
import { useRouter, useLocalSearchParams } from 'expo-router';

const router = useRouter();

// Push a new screen (adds to stack)
router.push('/(admin)/leads/lead-123');

// Replace current screen (no back button)
router.replace('/');

// Go back
router.back();

// Navigate with params
router.push({ pathname: '/(admin)/leads/[id]', params: { id: 'lead-123' } });
```

### 5. Link component vs router.push

```tsx
import { Link } from 'expo-router';

// Declarative — renders a Pressable with navigation built in
<Link href="/(admin)/leads/lead-123" asChild>
  <Pressable>
    <Text>View Lead</Text>
  </Pressable>
</Link>

// Use Link for static navigation in render
// Use router.push for navigation triggered by async events (after an API call)
```

## Test it

Run the app and verify:
1. Conversations screen shows 3 sample cards
2. Tapping a card navigates to the lead detail screen (`/(admin)/leads/lead-1`)
3. The URL/path shows the `id` param in the detail screen
4. Back button (or swipe on iOS) returns to conversations
5. Tab bar persists across navigation

```bash
npx tsc --noEmit
```

No TypeScript errors — `useLocalSearchParams<{ id: string }>()` is typed.

## Mini-task
Add a `settings` screen at `app/(admin)/settings.tsx` with a tab bar entry. On the settings screen add a "Sign out" button that navigates the user back to `app/index.tsx` using `router.replace('/')`. This is the pattern you will use in Day 125 when real auth is in place.

## Glossary
- **Stack navigator** — navigation pattern where each new screen is pushed onto a stack; back button pops it off.
- **Tab navigator** — persistent bottom navigation between sibling screens; state is preserved when switching tabs.
- **`useLocalSearchParams`** — Expo Router hook that reads dynamic route params (e.g. `[id]`); typed with a generic.
- **`useRouter`** — Expo Router hook that returns `push`, `replace`, `back` for programmatic navigation.
- **`href: null`** — hides a tab from the tab bar while still allowing navigation to it as a stack screen.
- **`presentation: 'card'`** — Stack screen option; slides in from the right (iOS default) or bottom (`modal`).

## Resources
- [Expo Router — navigation](https://docs.expo.dev/router/navigating-pages/)
- [Expo Router — dynamic routes](https://docs.expo.dev/router/create-pages/#dynamic-routes)
- [React Navigation — stack navigator](https://reactnavigation.org/docs/stack-navigator/)

## Checklist
- [ ] `app/(admin)/leads/[id].tsx` created with `useLocalSearchParams`
- [ ] Conversations screen renders a `FlatList` of sample leads
- [ ] Tapping a card navigates to `/(admin)/leads/[id]`
- [ ] Back navigation works (button + swipe gesture on iOS)
- [ ] Tab bar persists while navigating to lead detail
- [ ] `npx tsc --noEmit` reports no errors
