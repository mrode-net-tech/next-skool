# Day 134 — Notification handling (foreground + background)

## Goal
Handle notifications correctly in all three app states: foreground (app open), background (app minimised), and closed (app not running). After this day tapping a notification always navigates to the correct screen regardless of app state.

## Estimated time
~1.5 hours

## Prerequisites
Day 133 (push notifications sending from backend).

## Where to put your code
In `ai-folio-mobile`.

## Explanation

**Three app states** define notification behaviour:
1. **Foreground** — app is open and visible. Notification appears as a banner (if `setNotificationHandler` allows it). `addNotificationReceivedListener` fires.
2. **Background** — app is running but minimised. OS shows the notification. Tapping it brings the app to foreground. `addNotificationResponseReceivedListener` fires.
3. **Closed/killed** — app is not running. OS shows the notification. Tapping it launches the app. You must read `getLastNotificationResponseAsync()` on startup to handle this case.

**Deep linking from closed state** is the trickiest case. When the app launches cold from a notification tap, none of the listeners are active yet. The solution: check `Notifications.getLastNotificationResponseAsync()` in the root layout's `useEffect` and navigate if a response is found.

**Notification categories** (iOS) let you add action buttons to notifications — e.g. "View" and "Dismiss" without opening the app. This is a polish feature that adds significant perceived UX value.

## Step-by-step

### 1. Handle all three app states in the root layout

```tsx name=app/_layout.tsx
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

function useNotificationNavigation() {
  const router = useRouter();
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const notificationListener = useRef<Notifications.Subscription | null>(null);

  function navigateToLead(data: Record<string, unknown> | undefined) {
    const leadId = data?.leadId as string | undefined;
    if (leadId) {
      router.push(`/(admin)/leads/${leadId}`);
    }
  }

  useEffect(() => {
    // Case 3: app was closed — check if launched from notification tap
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        navigateToLead(response.notification.request.content.data as Record<string, unknown>);
      }
    });

    // Case 1: notification received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[notifications] Foreground notification:', notification.request.content.title);
        // Optionally show a custom in-app banner here (Day 134 mini-task)
      }
    );

    // Case 2: user tapped notification while app was backgrounded
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        navigateToLead(response.notification.request.content.data as Record<string, unknown>);
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}

export default function RootLayout() {
  useNotificationNavigation();
  // ... rest of layout
}
```

### 2. Add notification categories with action buttons (iOS)

```ts name=src/lib/notifications.ts
// Call once on app startup, before registering for push
export async function setupNotificationCategories() {
  await Notifications.setNotificationCategoryAsync('lead', [
    {
      identifier: 'view',
      buttonTitle: 'View Lead',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'dismiss',
      buttonTitle: 'Dismiss',
      options: { opensAppToForeground: false, isDestructive: false },
    },
  ]);
}
```

Update `sendPushToAdmin` in the backend to set the category:

```ts name=src/lib/push.ts
const pushMessage: ExpoPushMessage = {
  to: user.pushToken,
  title: message.title,
  body: message.body,
  data: message.data,
  sound: 'default',
  priority: 'high',
  channelId: 'leads',
  categoryId: 'lead',    // ← add this
};
```

When the user receives the push, two action buttons appear below the notification: "View Lead" (opens app to lead detail) and "Dismiss".

### 3. Handle category action responses

```ts name=src/lib/notifications.ts
// In useNotificationNavigation:
responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
  const actionId = response.actionIdentifier;

  if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER || actionId === 'view') {
    // Tapped notification body OR tapped "View Lead" button
    navigateToLead(response.notification.request.content.data as Record<string, unknown>);
  }
  // 'dismiss' action: do nothing
});
```

### 4. Update badge count

Badge count (the number shown on the app icon) should reflect unread leads:

```ts name=src/lib/notifications.ts
import { trpcVanillaClient } from './trpc';

export async function updateBadgeCount() {
  try {
    const leads = await trpcVanillaClient.leads.highScore.query({ minScore: 4 });
    const unreviewed = leads.filter((l) => l.kanbanStatus === 'new').length;
    await Notifications.setBadgeCountAsync(unreviewed);
  } catch {
    // Non-critical — badge update failure should not crash the app
  }
}
```

Call `updateBadgeCount()` in `useFocusEffect` on the Conversations screen. Call it again after moving a card to a non-`new` status.

### 5. Local in-app notification banner

When a push arrives while the app is foregrounded, the OS banner may not show (behaviour varies by OS version). Show a custom in-app banner:

```tsx name=src/components/NotificationBanner.tsx
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';

interface Props {
  title: string;
  body: string;
  leadId?: string;
  onDismiss: () => void;
}

export function NotificationBanner({ title, body, leadId, onDismiss }: Props) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const router = useRouter();

  useEffect(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    const timer = setTimeout(() => dismiss(), 4000);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    Animated.timing(translateY, { toValue: -100, duration: 200, useNativeDriver: true }).start(onDismiss);
  }

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}>
      <Pressable style={styles.content} onPress={() => { leadId && router.push(`/(admin)/leads/${leadId}`); dismiss(); }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body} numberOfLines={1}>{body}</Text>
      </Pressable>
      <Pressable onPress={dismiss} style={styles.close}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', top: 50, left: 16, right: 16, backgroundColor: '#111827', borderRadius: 12, flexDirection: 'row', padding: 14, zIndex: 999, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  content: { flex: 1 },
  title: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 2 },
  body: { color: '#d1d5db', fontSize: 13 },
  close: { paddingLeft: 12, justifyContent: 'center' },
  closeText: { color: '#9ca3af', fontSize: 18 },
});
```

## Test it

Test all three states:

1. **Foreground:** app open, send a push from the backend. In-app banner slides down. Tapping it navigates to lead detail.
2. **Background:** minimise the app, send a push. OS notification appears. Tap it — app foregrounds and navigates to lead detail.
3. **Closed:** kill the app, send a push. Notification appears. Tap it — app launches and navigates to lead detail.

Also test the "View Lead" action button on iOS (long-press or swipe down on the notification).

## Mini-task
Add notification history: store the last 20 received notifications in a local array using `useState` + `useRef` in the root layout. Add a "Notifications" tab to the admin layout that renders this history list. Each entry shows the notification title, body, and a "View" button to navigate to the lead.

## Glossary
- **`getLastNotificationResponseAsync`** — reads the notification the user tapped that launched the app from a killed state; must be called once on startup.
- **`DEFAULT_ACTION_IDENTIFIER`** — Expo constant for the response when the user taps the notification body (not a custom action button).
- **Notification category** — named set of action buttons attached to a notification type; defined on the client, referenced by `categoryId` in the push payload.
- **Badge count** — number shown on the app icon; set via `Notifications.setBadgeCountAsync`.
- **Foreground notification** — notification received while the app is the active foreground app; behaviour controlled by `setNotificationHandler`.

## Resources
- [Expo Notifications — receiving notifications](https://docs.expo.dev/push-notifications/receiving-notifications/)
- [Expo Notifications — categories](https://docs.expo.dev/versions/latest/sdk/notifications/#setnotificationcategoryasync)
- [React Native — Animated](https://reactnative.dev/docs/animated)

## Checklist
- [ ] `getLastNotificationResponseAsync` handles cold-start deep link navigation
- [ ] `addNotificationReceivedListener` fires in foreground; in-app banner shown
- [ ] `addNotificationResponseReceivedListener` fires on background notification tap
- [ ] Notification category `'lead'` registered with "View Lead" and "Dismiss" actions
- [ ] Backend sends `categoryId: 'lead'` in push payload
- [ ] Badge count updated on Conversations screen focus
- [ ] All three app states tested: foreground, background, closed
