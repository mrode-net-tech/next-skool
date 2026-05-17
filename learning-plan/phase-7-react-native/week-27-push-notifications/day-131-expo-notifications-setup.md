# Day 131 — Expo Notifications setup

## Goal
Install and configure Expo Notifications in `ai-folio-mobile`. After this day the app requests notification permission, registers a push token, and receives a test notification sent manually from the Expo dashboard.

## Estimated time
~1.5 hours

## Prerequisites
Day 130 (monorepo package working). A physical device or simulator (push notifications do not work in Expo Go on simulator — use a physical device or a development build).

## Where to put your code
In `ai-folio-mobile`.

## Explanation

**Push notifications** on mobile require a token — a unique string that identifies a specific app installation on a specific device. When your backend wants to notify the user, it sends the message to the push notification service (APNs for iOS, FCM for Android) along with the token. The service delivers it to the device. Expo wraps both services with a single API (`Expo Push Notification Service`) — you send one request to Expo's server and it routes to APNs or FCM automatically.

**Two types of notifications:**
- **Local** — scheduled by the app itself, no server involved (e.g. "remind me at 9am")
- **Push** — sent from your backend through Expo's service to a device

Today sets up push notifications. Day 133 connects the backend (BullMQ worker sends pushes when a high-score lead arrives).

**Development build required:** The Expo Go client cannot receive push notifications from custom servers. You need either a physical device with a development build (built with EAS Build, covered in Day 138) or a simulator with a simulated push (iOS Simulator can receive simulated pushes with `xcrun simctl push`).

## Step-by-step

### 1. Install expo-notifications

```bash
cd ai-folio-mobile
npx expo install expo-notifications expo-device expo-constants
```

### 2. Configure app.json for notifications

```json name=app.json
{
  "expo": {
    "name": "ai-folio",
    "slug": "ai-folio-mobile",
    "scheme": "ai-folio",
    "version": "1.0.0",
    "platforms": ["ios", "android"],
    "ios": {
      "bundleIdentifier": "com.yourname.aifolio",
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    },
    "android": {
      "package": "com.yourname.aifolio",
      "googleServicesFile": "./google-services.json"
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#000000",
          "sounds": ["./assets/notification-sound.wav"]
        }
      ]
    ]
  }
}
```

### 3. Create a notifications service

```ts name=src/lib/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// How notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[notifications] Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[notifications] Permission denied');
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('leads', {
      name: 'New Leads',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('[notifications] EAS projectId not set in app.json extras');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenData.data;  // → "ExponentPushToken[xxxxxx]"
}

export function addNotificationListener(
  handler: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(handler);
}

export function addResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
```

### 4. Register token on app start

```tsx name=app/_layout.tsx
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotifications,
  addNotificationListener,
  addResponseListener,
} from '../src/lib/notifications';
import { useRouter } from 'expo-router';
import { trpc } from '../src/lib/trpc';

// Inside RootLayout:
const router = useRouter();
const responseListener = useRef<Notifications.Subscription>();
const notificationListener = useRef<Notifications.Subscription>();

useEffect(() => {
  // Register and send token to backend (Day 132)
  registerForPushNotifications().then((token) => {
    if (token) {
      console.log('[notifications] Push token:', token);
      // savePushToken(token) — Day 132
    }
  });

  // Notification received while app is open
  notificationListener.current = addNotificationListener((notification) => {
    console.log('[notifications] Received:', notification.request.content);
  });

  // User tapped a notification
  responseListener.current = addResponseListener((response) => {
    const data = response.notification.request.content.data as { leadId?: string };
    if (data?.leadId) {
      router.push(`/(admin)/leads/${data.leadId}`);
    }
  });

  return () => {
    responseListener.current?.remove();
    notificationListener.current?.remove();
  };
}, []);
```

### 5. Get your EAS project ID

```bash
npx eas-cli@latest init
```

This creates an EAS project and adds the `projectId` to `app.json`. Without it, `getExpoPushTokenAsync` fails.

Add the project ID to `app.json` extras:

```json name=app.json
{
  "expo": {
    "extra": {
      "eas": { "projectId": "your-eas-project-id" }
    }
  }
}
```

### 6. Test with a manual push

Go to `expo.dev` → your project → **Push notifications** → **Send a push notification**. Paste your `ExponentPushToken[...]` and send a test message.

Or use the Expo push API directly:

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[your-token-here]",
    "title": "New lead 🎉",
    "body": "Job offer — score 5/5",
    "data": { "leadId": "test-123" }
  }'
```

## Test it

On a physical device (or simulator with simulated push):
1. Open the app — permission dialog appears
2. Grant permission
3. Note the `ExponentPushToken[...]` logged in the terminal
4. Send a manual push via the curl command above
5. Notification appears even if the app is in the background
6. Tapping the notification navigates to the lead detail screen

## Mini-task
Add a "Test notification" button to the Settings screen that sends a local notification (not push — no server needed):

```ts
await Notifications.scheduleNotificationAsync({
  content: { title: 'Test', body: 'Local notification works!' },
  trigger: { seconds: 1 },
});
```

Local notifications are useful for reminders and confirmations that do not require the backend.

## Glossary
- **Push token** — device-specific string issued by APNs/FCM/Expo; the address your backend sends notifications to.
- **`setNotificationHandler`** — Expo API that controls how notifications appear when the app is foregrounded (show/sound/badge).
- **Notification channel** — Android concept; groups notifications by category; required for `Importance.MAX`.
- **EAS (Expo Application Services)** — Expo's cloud build and push service; provides the `projectId` needed for push tokens.
- **`addNotificationResponseReceivedListener`** — fires when the user taps a notification; used for deep linking to the relevant screen.

## Resources
- [Expo Notifications — setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Expo Push API](https://docs.expo.dev/push-notifications/sending-notifications/)
- [EAS — getting started](https://docs.expo.dev/eas/)

## Checklist
- [ ] `expo-notifications`, `expo-device`, `expo-constants` installed
- [ ] `app.json` configured with iOS/Android identifiers and notification plugin
- [ ] `registerForPushNotifications()` requests permission and returns Expo push token
- [ ] Android notification channel created with `MAX` importance
- [ ] EAS project initialised; `projectId` in `app.json` extras
- [ ] Token logged in terminal on first run
- [ ] Manual push received on device and logged in app
- [ ] Tapping notification navigates to `/(admin)/leads/[leadId]`
