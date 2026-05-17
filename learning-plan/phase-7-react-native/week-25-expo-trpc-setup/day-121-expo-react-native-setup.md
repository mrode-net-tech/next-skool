# Day 121 — Expo + React Native setup

## Goal
Bootstrap `ai-folio-mobile` — a React Native app using Expo. After this day you have a running app on a simulator/device, understand how React Native differs from React DOM, and know why Expo is the right starting point over bare React Native.

## Estimated time
~2 hours

## Prerequisites
Day 120 (ai-folio production deploy complete). Node.js 20, pnpm. iOS Simulator (macOS) or Android Emulator, or a physical device with the Expo Go app.

## Where to put your code
New project: `ai-folio-mobile` (sibling directory to `ai-folio`).

## Explanation

**React Native** renders native UI components — not a WebView, not HTML. A `<View>` maps to `UIView` on iOS and `android.view.View` on Android. A `<Text>` maps to `UILabel` / `TextView`. This means your UI is indistinguishable from a native app, but you write JavaScript/TypeScript. In Laravel terms: same language (PHP), completely different runtime (web server vs CLI worker).

**Expo** is a toolchain and set of libraries on top of React Native. It handles: build tooling (no Xcode project file to manage), OTA updates, push notifications, camera, file system, and dozens of device APIs — all with a TypeScript SDK. The alternative (bare React Native) requires you to manage native build files. For a web developer building their first RN app, Expo saves weeks of setup friction.

**Key differences from React DOM:**
- No CSS — styling uses a JavaScript object system (`StyleSheet.create`) similar to inline styles but with a subset of CSS properties
- No `<div>`, `<span>`, `<img>` — use `<View>`, `<Text>`, `<Image>`
- No browser APIs (`window`, `document`, `fetch` exists via polyfill)
- Layout uses Flexbox by default (column direction, not row)
- Navigation is a library concern (`expo-router` or `react-navigation`), not the browser

## Step-by-step

### 1. Create the Expo project

```bash
npx create-expo-app@latest ai-folio-mobile --template blank-typescript
cd ai-folio-mobile
```

This scaffolds a minimal TypeScript project. Inspect the structure:

```
ai-folio-mobile/
  app.json          — Expo configuration (name, bundle ID, icons)
  App.tsx           — root component
  tsconfig.json
  package.json
```

### 2. Install Expo Router

Expo Router is file-system routing for React Native — the same mental model as Next.js App Router, but for mobile screens.

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens \
  expo-linking expo-constants expo-status-bar
```

Update `package.json` main entry:

```json name=package.json
{
  "main": "expo-router/entry"
}
```

Update `app.json`:

```json name=app.json
{
  "expo": {
    "name": "ai-folio",
    "slug": "ai-folio-mobile",
    "scheme": "ai-folio",
    "version": "1.0.0",
    "platforms": ["ios", "android"],
    "assetBundlePatterns": ["**/*"]
  }
}
```

### 3. Create the app directory structure

Delete `App.tsx` and create:

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
      </Stack>
    </>
  );
}
```

```tsx name=app/index.tsx
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link } from 'expo-router';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ai-folio Admin</Text>
      <Text style={styles.subtitle}>Mobile dashboard for your portfolio</Text>
      <Link href="/(admin)/conversations" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Open Dashboard</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

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
    </Tabs>
  );
}
```

```tsx name=app/(admin)/conversations.tsx
import { View, Text, StyleSheet } from 'react-native';

export default function ConversationsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Conversations — coming Day 126</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { color: '#999', fontSize: 16 },
});
```

```tsx name=app/(admin)/kanban.tsx
import { View, Text, StyleSheet } from 'react-native';

export default function KanbanScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Kanban — coming Day 128</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { color: '#999', fontSize: 16 },
});
```

### 4. Install vector icons

```bash
npx expo install @expo/vector-icons
```

### 5. Run the app

```bash
npx expo start
```

- Press `i` to open iOS Simulator
- Press `a` to open Android Emulator
- Scan QR code with Expo Go app on a physical device

You should see the home screen with a tab bar at the bottom.

## Test it

With `npx expo start` running:
1. Home screen shows title and "Open Dashboard" button
2. Tapping the button navigates to the Conversations tab
3. Tab bar shows Leads and Kanban tabs
4. No TypeScript errors in the terminal

```bash
npx tsc --noEmit
```

## Mini-task
Change the tab bar active colour from `#000` to a blue `#0066cc`. Open the Kanban tab and notice the icon changes colour. Then add a third tab called "Settings" with a `settings` icon — it can show a placeholder screen.

## Glossary
- **Expo** — toolchain + SDK on top of React Native; handles builds, device APIs, OTA updates.
- **Expo Router** — file-system routing for React Native; same mental model as Next.js App Router.
- **`StyleSheet.create`** — React Native styling API; takes a JavaScript object with a CSS-like subset; compiled to native layout primitives.
- **`<View>`** — React Native equivalent of `<div>`; a layout container.
- **`<Text>`** — React Native equivalent of `<span>`/`<p>`; all text must be inside a `<Text>`.
- **Expo Go** — Expo's development client app; scan QR code to run your app on a physical device without building a native binary.
- **`(admin)`** — Expo Router group syntax; creates a route group that does not appear in the URL/path.

## Resources
- [Expo — getting started](https://docs.expo.dev/get-started/introduction/)
- [Expo Router — introduction](https://docs.expo.dev/router/introduction/)
- [React Native — style](https://reactnative.dev/docs/style)
- [React Native — core components](https://reactnative.dev/docs/components-and-apis)

## Checklist
- [ ] `ai-folio-mobile` created with `create-expo-app --template blank-typescript`
- [ ] Expo Router installed and configured as the main entry
- [ ] `app/_layout.tsx`, `app/index.tsx`, `app/(admin)/_layout.tsx` created
- [ ] Tab bar shows Leads and Kanban tabs
- [ ] App runs in iOS Simulator or Android Emulator (or Expo Go)
- [ ] `npx tsc --noEmit` exits without errors
