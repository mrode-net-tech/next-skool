# Day 136 — AI draft reply screen

## Goal
Build a screen where the admin selects an AI-generated reply draft, edits it, and sends it as an email reply to the lead. After this day the full mobile admin workflow is complete: receive push → read lead → send AI-drafted reply — all from the phone.

## Estimated time
~2.5 hours

## Prerequisites
Day 135 (deep linking). Day 99 (AI draft reply feature in the web admin — the tRPC procedure to create).

## Where to put your code
Changes in both `ai-folio` (new tRPC procedure) and `ai-folio-mobile` (new screen).

## Explanation

**Streaming in React Native** is possible but more complex than on the web. The `useChat` hook from Vercel AI SDK (`ai/react`) requires browser APIs. Instead, consume the streaming response manually using `fetch` with the `text/event-stream` content type. For the reply drafting use case, a simpler non-streaming approach works well: call `generateText` on the server (via a tRPC mutation), wait for the full response, display it for editing.

**Editable TextInput** in React Native for multi-line text uses `multiline={true}` with `TextInput`. The tricky part: the input height should grow with content (`scrollEnabled={false}` + measuring content height). Use `onContentSizeChange` to update the `TextInput` height dynamically.

**The send flow:** draft → user edits → confirm send → `sendReply` tRPC mutation → backend sends email via Resend + marks lead as `replied` in Kanban.

## Step-by-step

### 1. Add a draftReply tRPC procedure

```ts name=src/lib/trpc/routers/conversations.ts
// Add to conversationsRouter:
  draftReply: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ input }) => {
      const conversation = await prisma.conversation.findUniqueOrThrow({
        where: { id: input.conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      const thread = conversation.messages
        .map((m) => `${m.role === 'user' ? 'Visitor' : 'Claude'}: ${m.content}`)
        .join('\n\n');

      const { text } = await generateText({
        model: fastModel,
        prompt: `You are drafting a professional reply to a portfolio website visitor.

Conversation:
${thread}

Lead intent: ${conversation.intent ?? 'unknown'}
Lead score: ${conversation.leadScore ?? 'not scored'}/5
AI summary: ${conversation.summary ?? 'none'}

Write a warm, professional email reply from the portfolio owner. Be specific to the conversation. 2-3 paragraphs. Sign off as "Marek".`,
      });

      return { draft: text };
    }),

  sendReply: protectedProcedure
    .input(z.object({ conversationId: z.string(), replyText: z.string().min(10) }))
    .mutation(async ({ input }) => {
      const conversation = await prisma.conversation.findUniqueOrThrow({
        where: { id: input.conversationId },
        include: { messages: { take: 1, orderBy: { createdAt: 'asc' } } },
      });

      // Get visitor's email from the first message metadata
      // Assumes email was stored when the conversation was created
      const visitorEmail = conversation.visitorEmail;
      if (!visitorEmail) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No visitor email' });

      const resend = new Resend(process.env.RESEND_API_KEY!);
      await resend.emails.send({
        from: 'marek@yourdomain.com',
        to: visitorEmail,
        subject: `Re: Your message on my portfolio`,
        text: input.replyText,
      });

      // Update Kanban status
      await prisma.conversation.update({
        where: { id: input.conversationId },
        data: { kanbanStatus: 'replied' },
      });

      return { sent: true };
    }),
```

### 2. Create the reply screen

```tsx name=app/(admin)/reply/[id].tsx
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/trpc';

export default function ReplyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [inputHeight, setInputHeight] = useState(200);
  const utils = trpc.useUtils();

  const draftMutation = trpc.conversations.draftReply.useMutation({
    onSuccess: (data) => setDraft(data.draft),
    onError: (err) => Alert.alert('Error', err.message),
  });

  const sendMutation = trpc.conversations.sendReply.useMutation({
    onSuccess: () => {
      utils.conversations.byId.invalidate({ id });
      utils.conversations.byStatus.invalidate();
      Alert.alert('Sent!', 'Reply sent successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err) => Alert.alert('Failed to send', err.message),
  });

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionLabel}>AI Draft</Text>

        {draftMutation.isPending && (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Generating draft...</Text>
          </View>
        )}

        {!draftMutation.isPending && !draft && (
          <Pressable
            style={styles.generateButton}
            onPress={() => draftMutation.mutate({ conversationId: id })}
          >
            <Text style={styles.generateButtonText}>✨ Generate AI Draft</Text>
          </Pressable>
        )}

        {draft && (
          <>
            <Text style={styles.sectionLabel}>Edit before sending</Text>
            <TextInput
              style={[styles.editor, { height: Math.max(200, inputHeight) }]}
              value={draft}
              onChangeText={setDraft}
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height + 20)}
            />

            <View style={styles.actions}>
              <Pressable
                style={styles.regenerateButton}
                onPress={() => draftMutation.mutate({ conversationId: id })}
              >
                <Text style={styles.regenerateText}>↻ Regenerate</Text>
              </Pressable>

              <Pressable
                style={[styles.sendButton, sendMutation.isPending && styles.sendButtonDisabled]}
                onPress={() => {
                  Alert.alert('Send reply?', 'This will send the email to the visitor.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Send', onPress: () => sendMutation.mutate({ conversationId: id, replyText: draft }) },
                  ]);
                }}
                disabled={sendMutation.isPending}
              >
                <Text style={styles.sendButtonText}>
                  {sendMutation.isPending ? 'Sending...' : 'Send Reply'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20, gap: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, backgroundColor: '#f9fafb', borderRadius: 10 },
  loadingText: { color: '#6b7280', fontSize: 15 },
  generateButton: { backgroundColor: '#000', padding: 16, borderRadius: 10, alignItems: 'center' },
  generateButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  editor: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 14, fontSize: 15, lineHeight: 22, color: '#111827', backgroundColor: '#fafafa' },
  actions: { flexDirection: 'row', gap: 12 },
  regenerateButton: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  regenerateText: { fontSize: 15, color: '#374151', fontWeight: '500' },
  sendButton: { flex: 2, backgroundColor: '#059669', padding: 14, borderRadius: 10, alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
```

### 3. Register the reply route in the root layout

```tsx name=app/_layout.tsx
<Stack.Screen name="(admin)/reply/[id]" options={{ title: 'Draft Reply', presentation: 'card' }} />
```

## Test it

1. Navigate to a lead detail screen
2. Tap "Draft AI Reply"
3. Tap "Generate AI Draft" — spinner shows, then draft appears
4. Edit the draft text
5. Tap "Send Reply" → confirm dialog → "Sent!" alert → navigate back
6. Kanban status updates to "replied" (visible on the Kanban screen)

```bash
npx tsc --noEmit
```

## Mini-task
Add a character count below the editor: `Text: ${draft.length} characters`. Change the count text colour to red if `draft.length > 2000` (too long for a concise reply). This is a micro-UX detail that makes the editing experience feel polished.

## Glossary
- **`KeyboardAvoidingView`** — React Native component that adjusts its height when the software keyboard appears; prevents the keyboard from covering input fields.
- **`onContentSizeChange`** — `TextInput` event that fires when the content height changes; used to grow the input dynamically.
- **`multiline`** — `TextInput` prop that enables multi-line text input; required for editing email drafts.
- **`textAlignVertical`** — Android-specific `TextInput` prop to align text to the top of the input.
- **`generateText`** — Vercel AI SDK function; returns the full response as a string (not streamed); used here for simplicity.

## Resources
- [React Native — TextInput](https://reactnative.dev/docs/textinput)
- [React Native — KeyboardAvoidingView](https://reactnative.dev/docs/keyboardavoidingview)
- [Vercel AI SDK — generateText](https://sdk.vercel.ai/docs/ai-sdk-core/generating-text)

## Checklist
- [ ] `conversations.draftReply` procedure generates draft with `generateText`
- [ ] `conversations.sendReply` procedure sends email via Resend and updates kanbanStatus to `replied`
- [ ] Reply screen accessible from lead detail "Draft AI Reply" button
- [ ] "Generate AI Draft" button triggers mutation; draft populates TextInput
- [ ] TextInput grows with content; `KeyboardAvoidingView` prevents keyboard overlap
- [ ] Confirm dialog before sending; success alert navigates back
- [ ] Kanban status updates to `replied` after send
