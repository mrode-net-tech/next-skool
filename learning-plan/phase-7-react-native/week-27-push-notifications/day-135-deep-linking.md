# Day 135 — Deep linking

## Goal
Configure deep linking so that `ai-folio://leads/[id]` and `https://ai-folio.fly.dev/leads/[id]` both open the lead detail screen in the mobile app. After this day the admin can tap links from email or Slack and the app opens to the correct screen.

## Estimated time
~1.5 hours

## Prerequisites
Day 134 (notification handling). Day 131 (scheme configured in `app.json`).

## Where to put your code
In `ai-folio-mobile` and `ai-folio` (for universal links).

## Explanation

**Deep linking** means opening a specific screen inside a mobile app from an external URL. Two variants:
- **Custom scheme** — `ai-folio://leads/abc123` — always opens the app (if installed). Simple to set up. Ugly in email/chat.
- **Universal links (iOS) / App Links (Android)** — `https://ai-folio.fly.dev/leads/abc123` — opens the app if installed, falls back to the website if not. Requires a verification file on your web server.

**Expo Router handles deep linking automatically** via the `scheme` in `app.json`. File `app/(admin)/leads/[id].tsx` maps to `ai-folio://leads/[id]`. No manual link parsing needed — Expo Router reads the URL and renders the correct screen.

**Universal links** require an `apple-app-site-association` file served from your domain. This is the most user-friendly approach — links in the weekly digest email (Day 114) open the app directly.

## Step-by-step

### 1. Verify the custom scheme works

```bash
# Simulate a deep link in the iOS Simulator
xcrun simctl openurl booted "ai-folio://leads/test-123"

# Simulate on Android Emulator
adb shell am start -W -a android.intent.action.VIEW \
  -d "ai-folio://leads/test-123" com.yourname.aifolio
```

The app should open and navigate to `/(admin)/leads/test-123`. Expo Router resolves `ai-folio://leads/[id]` → `app/(admin)/leads/[id].tsx` with `{ id: 'test-123' }` automatically.

### 2. Handle links from a cold-start

The app must handle deep links even if it was closed when the link was tapped. Expo Router handles this automatically — the initial URL is parsed and the matching screen is rendered. No extra code needed if you followed the Expo Router setup from Day 121.

Verify with:

```bash
# Kill the app in simulator, then:
xcrun simctl openurl booted "ai-folio://leads/some-real-lead-id"
```

App should launch directly to the lead detail screen.

### 3. Set up universal links (iOS)

Create the Apple App Site Association file:

```json name=ai-folio/public/.well-known/apple-app-site-association
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "YOURTEAMID.com.yourname.aifolio",
        "paths": [
          "/leads/*",
          "/admin/leads/*"
        ]
      }
    ]
  }
}
```

The `YOURTEAMID` is your Apple Developer Team ID (10-character string from developer.apple.com).

Serve it with the correct content type:

```ts name=src/app/.well-known/apple-app-site-association/route.ts
import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

export async function GET() {
  const file = readFileSync(
    path.join(process.cwd(), 'public/.well-known/apple-app-site-association')
  );
  return new NextResponse(file, {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

Update `app.json` to enable associated domains:

```json name=app.json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourname.aifolio",
      "associatedDomains": ["applinks:ai-folio.fly.dev"]
    }
  }
}
```

Associated domains require a development build (not Expo Go). Day 138 sets up EAS Build.

### 4. Set up App Links (Android)

Create the asset links file:

```json name=ai-folio/public/.well-known/assetlinks.json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yourname.aifolio",
      "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
    }
  }
]
```

Get the fingerprint from your keystore (generated during EAS Build setup in Day 138).

### 5. Add deep links to the weekly digest email

Update the email template from Day 114 to include tappable lead links:

```ts name=src/lib/email/digest-template.ts
// In the leads list section:
leads.map((lead, i) => `
  <p>
    <strong>Lead ${i + 1}</strong> — ${lead.intent} (score ${lead.leadScore}/5)<br>
    ${lead.messages[0]?.content?.slice(0, 100) ?? ''}<br>
    <a href="https://ai-folio.fly.dev/admin/leads/${lead.id}">View in browser</a>
    &nbsp;|&nbsp;
    <a href="ai-folio://leads/${lead.id}">Open in app</a>
  </p>
`).join('')
```

The `ai-folio://` link works if the app is installed. On iOS with universal links configured, the `https://` link also opens the app.

## Test it

1. **Custom scheme test:**
```bash
xcrun simctl openurl booted "ai-folio://leads/$(psql -U folio -d folio_dev -t -c 'SELECT id FROM "Conversation" LIMIT 1')"
```
App opens to lead detail screen.

2. **Universal links test** (requires development build from Day 138):
   - Open Safari on device
   - Navigate to `https://ai-folio.fly.dev/leads/[real-id]`
   - iOS shows "Open in ai-folio?" banner
   - Tap banner — app opens to lead detail

3. **Email link test:**
   - Trigger the digest email (`POST /api/admin/trigger-digest`)
   - Open the email — tap "Open in app" link
   - App opens directly to lead detail

## Mini-task
Add a "Copy link" button on the lead detail screen that copies `ai-folio://leads/[id]` to the clipboard using `expo-clipboard`. Share it in Slack or Messages — tapping the link from another app opens `ai-folio-mobile` on the correct screen.

## Glossary
- **Deep link** — URL that opens a specific screen in a mobile app.
- **Custom scheme** — `ai-folio://` style URL; always opens the app; no fallback to web.
- **Universal link** — `https://` URL that opens the app if installed, falls back to web if not; requires AASA file verification.
- **AASA (Apple App Site Association)** — JSON file served from `/.well-known/apple-app-site-association`; tells iOS which app handles which URL paths.
- **App Links** — Android equivalent of Universal Links; verified via `/.well-known/assetlinks.json`.
- **Associated domains** — iOS entitlement declaring which domains can trigger deep links into the app.

## Resources
- [Expo Router — deep linking](https://docs.expo.dev/router/reference/linking/)
- [Apple — universal links](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app)
- [Android — app links](https://developer.android.com/training/app-links)

## Checklist
- [ ] `xcrun simctl openurl` opens the correct screen via `ai-folio://` scheme
- [ ] Cold-start deep link navigation works (app launches to correct screen)
- [ ] `apple-app-site-association` file served from `https://ai-folio.fly.dev/.well-known/`
- [ ] `associatedDomains` configured in `app.json`
- [ ] `assetlinks.json` created for Android App Links
- [ ] Digest email includes both `https://` and `ai-folio://` lead links
