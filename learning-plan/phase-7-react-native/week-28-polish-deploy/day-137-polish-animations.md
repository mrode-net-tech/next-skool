# Day 137 — Polish + animations

## Goal
Add micro-animations and polish details that make `ai-folio-mobile` feel like a native app rather than a web page wrapped in a container. After this day the app has smooth transitions, skeleton loading states, and haptic feedback on key interactions.

## Estimated time
~2 hours

## Prerequisites
Day 136 (all main screens complete).

## Where to put your code
In `ai-folio-mobile`.

## Explanation

**What separates "native feel" from "web in a shell":**
- Instant visual feedback on tap (no 100ms delay)
- Skeleton screens instead of spinners (content layout preserved during load)
- Haptic feedback on destructive or confirmatory actions
- Spring animations on state transitions (not linear easing)
- Proper safe area handling (content does not hide under notch or home indicator)

**React Native Reanimated** (`react-native-reanimated`) is the standard animation library for complex animations. For simple cases, the built-in `Animated` API (used in Day 134's notification banner) is sufficient. Today uses both.

**`expo-haptics`** provides access to the device's haptic engine — the same motor that creates the "click" feeling on 3D Touch and the subtle buzz on Android. Three levels: `Light`, `Medium`, `Heavy`. Use sparingly — overuse desensitises users.

## Step-by-step

### 1. Install animation and haptics libraries

```bash
npx expo install expo-haptics react-native-reanimated
```

Add the Reanimated babel plugin to `babel.config.js`:

```js name=babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],  // must be last
  };
};
```

Restart the Metro bundler after this change.

### 2. Add haptic feedback to key interactions

```ts name=src/lib/haptics.ts
import * as Haptics from 'expo-haptics';

export const haptics = {
  // Light: selecting an item, opening a screen
  selection: () => Haptics.selectionAsync(),
  // Medium: completing an action (sending a reply, changing status)
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  // Heavy: destructive or irreversible actions (archiving a lead)
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  // Subtle: tab bar item tap, filter chip selection
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
};
```

Add haptics to interactions:

```tsx
// In LeadCard onPress:
onPress={() => {
  haptics.selection();
  router.push(`/(admin)/leads/${item.id}`);
}}

// In StatusPicker onChange:
onChange={(status) => {
  haptics.light();
  onChangeStatus(status);
}}

// After sendReply success:
onSuccess: () => {
  haptics.success();
  Alert.alert('Sent!', ...);
}
```

### 3. Create a skeleton loader component

```tsx name=src/components/SkeletonCard.tsx
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolate } from 'react-native-reanimated';
import { useEffect } from 'react';

function SkeletonBox({ width, height, borderRadius = 4 }: { width: number | string; height: number; borderRadius?: number }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 800 }),
      -1,
      true   // reverse
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius, backgroundColor: '#e5e7eb' }, animatedStyle]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <SkeletonBox width={80} height={24} borderRadius={6} />
        <SkeletonBox width={60} height={16} />
      </View>
      <SkeletonBox width="100%" height={16} />
      <SkeletonBox width="70%" height={16} />
      <SkeletonBox width={60} height={12} />
    </View>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
```

Use it in the Conversations screen:

```tsx
if (isLoading) return <SkeletonList count={6} />;
```

The skeleton preserves the card layout — the transition from skeleton to real data is smooth because the element positions match.

### 4. Animate screen transitions with Reanimated

Add a fade-in + slide-up entrance animation to screens:

```tsx name=src/components/ScreenTransition.tsx
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ReactNode } from 'react';

export function ScreenTransition({ children }: { children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(300).springify()} style={{ flex: 1 }}>
      {children}
    </Animated.View>
  );
}
```

Wrap screen content:

```tsx
export default function ConversationsScreen() {
  // ...
  return (
    <ScreenTransition>
      <View style={styles.screen}>
        {/* ... */}
      </View>
    </ScreenTransition>
  );
}
```

### 5. Add safe area insets

```bash
# Already installed in Day 121, but confirm it's configured
npx expo install react-native-safe-area-context
```

Wrap the root layout in `SafeAreaProvider` and use `useSafeAreaInsets()` where needed:

```tsx name=app/_layout.tsx
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <trpc.Provider ...>
        {/* ... */}
      </trpc.Provider>
    </SafeAreaProvider>
  );
}
```

For screens with a floating bottom bar (like the reply screen's action buttons), use insets:

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();
// Apply to the action bar:
<View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
```

### 6. Animate card status change

When a card's status changes on the Kanban board, animate it out of the column:

```tsx
import Animated, { FadeOutLeft, Layout } from 'react-native-reanimated';

// Wrap each card in KanbanColumn:
<Animated.View key={card.id} exiting={FadeOutLeft.duration(250)} layout={Layout.springify()}>
  <Pressable ...>
    {/* card content */}
  </Pressable>
</Animated.View>
```

When a card is moved, it fades out to the left. The remaining cards slide up smoothly via `Layout.springify()`.

## Test it

Run on a physical device (animations are smoother on device than simulator):

1. Conversations list — skeleton loads then fades into real content
2. Tapping a card — haptic feedback + screen slides in with spring animation
3. Changing a lead's status — haptic + optimistic update
4. Moving a Kanban card — card fades out left, others spring into position
5. Sending a reply — success haptic + alert

Check that all screens handle safe areas correctly (content not hidden under notch or home indicator).

## Mini-task
Add a "swipe to archive" gesture on lead cards in the Conversations list using `react-native-gesture-handler`'s `Swipeable`. Swiping left reveals a red "Archive" button. Tapping it calls `updateKanbanStatus` with `'archived'` + plays a warning haptic. This is a common mobile pattern for bulk actions.

## Glossary
- **Reanimated** — React Native animation library using native thread animations; avoids JS thread bottleneck; required for 60fps complex animations.
- **`withRepeat`** — Reanimated animation modifier that loops an animation; `-1` for infinite.
- **Haptic feedback** — tactile response from the device's vibration motor; `NotificationFeedbackType.Success` plays the positive pattern.
- **Safe area insets** — the space taken by the notch, status bar, and home indicator; content must avoid these regions.
- **Skeleton screen** — loading placeholder that matches the shape of the expected content; better UX than a spinner.

## Resources
- [React Native Reanimated — getting started](https://docs.swmansion.com/react-native-reanimated/)
- [expo-haptics](https://docs.expo.dev/versions/latest/sdk/haptics/)
- [react-native-safe-area-context](https://docs.expo.dev/versions/latest/sdk/safe-area-context/)

## Checklist
- [ ] `expo-haptics` and `react-native-reanimated` installed
- [ ] Reanimated babel plugin added; Metro restarted
- [ ] `haptics.selection()` on card tap, `haptics.success()` after reply sent, `haptics.light()` on chip selection
- [ ] `SkeletonList` shown during initial load; transitions smoothly to real data
- [ ] `ScreenTransition` wraps all screen content for fade-in entrance
- [ ] Kanban card exit animation on status change
- [ ] All screens respect safe area insets
