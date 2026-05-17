# Day 139 — App Store + Play Store submission prep

## Goal
Prepare `ai-folio-mobile` for App Store (iOS) and Play Store (Android) submission. After this day you have production builds, App Store screenshots, a privacy policy, and understand the review process timeline.

## Estimated time
~3 hours

## Prerequisites
Day 138 (EAS Build configured, development build tested on device).

## Where to put your code
In `ai-folio-mobile`. Configuration in App Store Connect and Google Play Console.

## Explanation

**App Store review** takes 1–3 days for a new app. The review team manually checks your app for crashes, policy violations, and metadata accuracy. Common rejections for a first submission: missing privacy policy, incomplete screenshots, or the app requiring login without a demo account. For `ai-folio-mobile`, the app is admin-only (no public sign-up) — you must explain this in the App Store review notes.

**Privacy policy requirement:** Both stores require a privacy policy URL for any app that collects user data. The app stores a JWT, registers push tokens, and sends email replies — all user data. The policy must be publicly accessible on a URL you own.

**Screenshot requirements:**
- iOS: 6.7" (iPhone 15 Pro Max), 6.1" (iPhone 15), 12.9" iPad (if supporting iPad)
- Android: phone screenshots (minimum 2, maximum 8)

Use the iOS Simulator to take screenshots at the exact required sizes.

## Step-by-step

### 1. Create a production build

```bash
# iOS — creates .ipa for App Store submission
eas build --platform ios --profile production

# Android — creates .aab for Play Store
eas build --platform android --profile production
```

Production builds are signed with distribution certificates (iOS) or release keystores (Android). EAS manages these automatically with managed credentials.

### 2. Add app icons and splash screen

```bash
npx expo install expo-splash-screen
```

Replace the default icons with your own:

```
assets/
  icon.png         — 1024×1024 PNG, no transparency (iOS requirement)
  adaptive-icon.png — 1024×1024 PNG with transparency (Android adaptive icon foreground)
  splash-icon.png   — your logo for the splash screen
```

Update `app.json`:

```json name=app.json
{
  "expo": {
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    }
  }
}
```

### 3. Prepare App Store Connect (iOS)

1. Sign in at appstoreconnect.apple.com
2. **My Apps** → **+** → **New App**
3. Fill in:
   - Name: `ai-folio Admin`
   - Bundle ID: `com.yourname.aifolio`
   - SKU: `ai-folio-admin-001`
4. **App Information:**
   - Category: Business or Productivity
   - Privacy Policy URL: `https://ai-folio.fly.dev/privacy`
5. **App Review Information:**
   - Notes: "This is a private admin app for managing leads on the ai-folio portfolio website. Login credentials for review: email: reviewer@example.com, password: ReviewPassword123"
   - Create a test admin account for the reviewer

### 4. Create a privacy policy page

Add a privacy policy to the Next.js app:

```tsx name=src/app/privacy/page.tsx
export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Privacy Policy — ai-folio Admin</h1>
      <p><strong>Last updated:</strong> {new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <h2>Data we collect</h2>
      <ul>
        <li>Email address and password (for admin login)</li>
        <li>Device push notification token (to send lead alerts)</li>
        <li>Portfolio visitor conversation data (processed on the server)</li>
      </ul>

      <h2>How we use your data</h2>
      <p>Data is used exclusively to operate the admin dashboard. Push tokens are used to deliver lead notifications. No data is sold or shared with third parties.</p>

      <h2>Data storage</h2>
      <p>All data is stored in a PostgreSQL database hosted on Fly.io in the Warsaw (WAW) region.</p>

      <h2>Contact</h2>
      <p>For privacy questions: <a href="mailto:your@email.com">your@email.com</a></p>
    </main>
  );
}
```

### 5. Take App Store screenshots

Use the iOS Simulator with the correct device model:

```bash
# Switch simulator to iPhone 15 Pro Max (6.7")
# In Simulator: Device → iPhone 15 Pro Max

# Navigate to each screen in the app, then:
# Simulator: File → Save Screen
# Or: cmd+S in Simulator
```

Recommended screenshots (in order):
1. Conversations list — shows leads with score badges
2. Lead detail — shows full thread + AI summary
3. Kanban board — shows all four columns
4. Push notification — show in the lock screen (take a real photo of device)
5. Draft reply — shows AI-generated draft being edited

### 6. Submit via EAS

```bash
# Submit iOS build to App Store Connect
eas submit --platform ios --latest

# Submit Android build to Play Store
eas submit --platform android --latest
```

`eas submit` uploads the build to App Store Connect / Google Play Console and makes it available for review. You still need to fill in metadata and submit for review manually in the respective dashboard.

### 7. Play Store setup

1. Sign in at play.google.com/console
2. **Create app** → fill in app name, language, app/game, free/paid
3. **App content** → complete all required sections (privacy policy, data safety, content rating)
4. **Production** → **Create new release** → upload your `.aab`
5. Review notes: same admin credentials as iOS

## Test it

Before submitting:

```bash
# Run the production build on a real device
eas build:run --platform ios --profile production --latest
```

Go through every screen and every user flow:
- [ ] Login works with production backend (not localhost)
- [ ] All screens load real data
- [ ] Push notifications received and navigate correctly
- [ ] Draft reply generates and sends via Resend
- [ ] No console errors or crashes

Check TestFlight (iOS) or internal testing track (Android) with at least one other person before submitting to the public stores.

## Mini-task
Add an app version display to the Settings screen:

```tsx
import Constants from 'expo-constants';

<Text style={styles.version}>
  Version {Constants.expoConfig?.version} ({Constants.expoConfig?.ios?.buildNumber})
</Text>
```

This helps when debugging — you always know which build a tester is running.

## Glossary
- **App Store Connect** — Apple's platform for managing iOS app submissions, TestFlight builds, and metadata.
- **Google Play Console** — Google's platform for Android app submissions and distribution.
- **Production build** — signed binary ready for App Store/Play Store submission; no dev tools.
- **TestFlight** — Apple's beta testing platform; distribute `.ipa` to up to 10,000 testers before App Store submission.
- **Internal testing track** — Google Play's equivalent of TestFlight; limited to 100 testers.
- **Privacy policy URL** — required by both stores; must be publicly accessible and describe all data collection.

## Resources
- [EAS Submit — iOS](https://docs.expo.dev/submit/ios/)
- [EAS Submit — Android](https://docs.expo.dev/submit/android/)
- [App Store Connect — screenshot specs](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications)
- [Google Play — data safety](https://support.google.com/googleplay/android-developer/answer/10787469)

## Checklist
- [ ] Production builds created for both iOS and Android
- [ ] App icon (1024×1024) and adaptive icon created and configured
- [ ] Splash screen configured
- [ ] Privacy policy page live at `https://ai-folio.fly.dev/privacy`
- [ ] App Store Connect app created with correct bundle ID and metadata
- [ ] Play Store app created with correct package name and metadata
- [ ] Demo/reviewer account created; credentials documented in review notes
- [ ] 5 screenshots prepared for each platform
- [ ] `eas submit` uploads builds to both stores
- [ ] App passes internal test on real device with production backend
