# Day 138 — EAS Build setup + preview builds

## Goal
Configure EAS Build and produce a development build that can be installed on a physical device. After this day you have a standalone `.ipa` / `.apk` that does not require Expo Go — it can receive push notifications, use native APIs, and be distributed to TestFlight/Play Store.

## Estimated time
~2.5 hours

## Prerequisites
Day 137 (app polished). An Apple Developer account (for iOS) or Google Play account (for Android). Node.js 20.

## Where to put your code
In `ai-folio-mobile`.

## Explanation

**Why leave Expo Go?** Expo Go is a universal sandbox that runs any Expo app without building native code. Its limitations: it cannot receive push notifications from your custom backend (only from Expo's sandbox), it cannot include native modules not in Expo Go's set, and it cannot be submitted to the App Store. A **development build** is your own app binary — same as Expo Go but scoped to your app — built by EAS Build on Expo's CI servers.

**EAS Build** compiles your React Native app to native binaries (`.ipa` for iOS, `.apk`/`.aab` for Android) on Expo's servers. You do not need Xcode or Android Studio installed locally. The output can be distributed via TestFlight (iOS) or APK sideloading (Android) for testing, then submitted to the stores.

**Three build profiles:**
- `development` — installs on your device, includes dev menu, connects to Metro for hot reload
- `preview` — production-like binary for internal testing, no dev menu, distributed via EAS Update or direct install
- `production` — App Store / Play Store submission binary

## Step-by-step

### 1. Install EAS CLI

```bash
npm install -g eas-cli
eas login   # log in with your Expo account
```

### 2. Configure eas.json

```json name=eas.json
{
  "cli": {
    "version": ">= 7.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "NODE_ENV": "production"
      }
    },
    "production": {
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "app-bundle"
      },
      "env": {
        "NODE_ENV": "production"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@apple.id",
        "ascAppId": "your-asc-app-id",
        "appleTeamId": "YOURTEAMID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### 3. Configure app.json for production

```json name=app.json
{
  "expo": {
    "name": "ai-folio",
    "slug": "ai-folio-mobile",
    "version": "1.0.0",
    "scheme": "ai-folio",
    "runtimeVersion": {
      "policy": "sdkVersion"
    },
    "ios": {
      "bundleIdentifier": "com.yourname.aifolio",
      "buildNumber": "1",
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      },
      "associatedDomains": ["applinks:ai-folio.fly.dev"]
    },
    "android": {
      "package": "com.yourname.aifolio",
      "versionCode": 1,
      "googleServicesFile": "./google-services.json"
    },
    "extra": {
      "apiUrl": "https://ai-folio.fly.dev",
      "eas": {
        "projectId": "your-eas-project-id"
      }
    },
    "plugins": [
      ["expo-notifications", { "icon": "./assets/notification-icon.png", "color": "#000000" }]
    ]
  }
}
```

### 4. Build a development client for iOS

```bash
# This builds on Expo's servers — takes ~10-15 minutes first time
eas build --platform ios --profile development
```

EAS prompts you to:
- Log in to your Apple Developer account
- Create or reuse an App ID
- Create or reuse a provisioning profile
- Create or reuse a signing certificate

All credential management is handled by EAS — you do not need to open Xcode.

When the build completes, EAS provides a download URL. Open it on your iPhone using Safari → install the `.ipa` via the direct install link.

### 5. Build for Android

```bash
eas build --platform android --profile development
```

EAS generates a debug keystore automatically. Download the `.apk` and install it on your Android device:

```bash
adb install ai-folio.apk
```

Or use `eas build:run` to install directly:

```bash
eas build:run --platform android --latest
```

### 6. Connect to local development server

After installing the development client on the device:

```bash
npx expo start --dev-client
```

Scan the QR code with the installed development client app (not Expo Go). The app connects to your local Metro bundler — hot reload works, and the device receives push notifications from your local backend.

### 7. Set the production API URL

In `src/lib/config.ts`, update to use the EAS extra config:

```ts name=src/lib/config.ts
import Constants from 'expo-constants';

export const API_URL: string =
  Constants.expoConfig?.extra?.apiUrl ?? 'https://ai-folio.fly.dev';

export const TRPC_URL = `${API_URL}/api/trpc`;
```

`Constants.expoConfig?.extra?.apiUrl` reads `"https://ai-folio.fly.dev"` from `app.json` in production builds, and `DEV_API_URL` (the LAN IP) in development.

## Test it

After installing the development build on a physical device:

1. Open the app — no Expo Go splash screen; your app loads directly
2. Navigate through all screens — Conversations, Lead Detail, Kanban, Reply
3. Send a test push notification from the backend — it should arrive (push works in development builds, not in Expo Go)
4. Tap the notification — deep link navigates to the correct lead

```bash
# Verify push token is registered (different token from Expo Go)
docker-compose exec postgres psql -U folio -d folio_dev \
  -c 'SELECT "pushToken" FROM "User";'
```

## Mini-task
Set up EAS Update for over-the-air (OTA) updates. Run:

```bash
npx expo install expo-updates
eas update --branch main --message "Day 138 polish"
```

OTA updates push JavaScript bundle changes to installed apps without going through the App Store review process. The next time a user opens the app, the new bundle downloads in the background and applies on the next launch.

## Glossary
- **EAS Build** — Expo's cloud build service; compiles React Native apps to native binaries without local Xcode/Android Studio.
- **Development client** — a custom Expo Go-like binary scoped to your app; supports push notifications and all native modules.
- **`.ipa`** — iOS app archive; distributed via TestFlight or direct install.
- **`.apk`** — Android package; installable directly on a device.
- **`.aab`** — Android App Bundle; the format required for Play Store submission (smaller than APK).
- **EAS Update** — Expo's OTA update service; pushes JavaScript bundle changes without App Store review.
- **`runtimeVersion`** — controls which app binary is compatible with which JS update; `sdkVersion` policy ties them to the Expo SDK version.

## Resources
- [EAS Build — getting started](https://docs.expo.dev/build/introduction/)
- [EAS Build — iOS credentials](https://docs.expo.dev/app-signing/managed-credentials/)
- [EAS Update — introduction](https://docs.expo.dev/eas-update/introduction/)

## Checklist
- [ ] `eas-cli` installed and logged in
- [ ] `eas.json` configured with `development`, `preview`, `production` profiles
- [ ] `app.json` has correct bundle ID, package name, associated domains
- [ ] `eas build --platform ios --profile development` completes successfully
- [ ] `.ipa` installed on physical iPhone device
- [ ] Development client connects to local Metro bundler
- [ ] Push notifications received on physical device (not Expo Go)
- [ ] `API_URL` reads from `Constants.expoConfig?.extra?.apiUrl` in production
