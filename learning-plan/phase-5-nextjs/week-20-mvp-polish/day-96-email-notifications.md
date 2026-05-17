# Day 96 — Email notifications (Resend)

## Goal
Send the portfolio owner an email when a high-value lead arrives (score >= 4). Use Resend — a developer-first transactional email API with a generous free tier. Replace the `console.log` stub in `lead-scoring.ts` with a real email.

## Estimated time
~1.5 hours

## Prerequisites
Day 95 (lead scoring working — `scoreConversation` logs high-value leads to the terminal). Resend account (free at resend.com — no credit card required for dev).

## Where to put your code
In `ai-folio`.

## Explanation

**Resend** is a transactional email API designed for developers. It has an official TypeScript SDK, React Email integration (HTML emails as JSX), DKIM setup via DNS, and a generous 3,000 emails/month free tier. In Laravel terms it's like using Mailgun or Postmark — you call an API, pass a subject + HTML body, and it delivers.

**From address**: Resend requires you to verify a domain to send from a custom address. During development you can send from `onboarding@resend.dev` to your own email — no DNS setup needed. For production, add a DNS TXT record to verify your domain.

**Email as React components** (`react-email`) is optional but produces great-looking, cross-client-compatible HTML. For this day you use plain HTML strings to keep the scope tight. Day 100 can upgrade to React Email if desired.

The lead notification email should give you everything you need to decide whether to respond immediately: the conversation transcript, the score, the intent, and (if captured) the visitor's email.

## Step-by-step

### 1. Install Resend

```bash
pnpm add resend
```

### 2. Add API key to environment

Sign up at resend.com → API Keys → Create API key.

```bash name=.env.local
RESEND_API_KEY=re_...
ADMIN_EMAIL=you@yourdomain.com
RESEND_FROM=onboarding@resend.dev   # use this during dev; your verified domain in prod
```

### 3. Email helper

```ts name=src/lib/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface LeadEmailPayload {
  conversationId: string;
  intent: string;
  score: number;
  reasoning: string;
  transcript: string;
  visitorEmail?: string | null;
}

function buildLeadEmailHtml(payload: LeadEmailPayload): string {
  const intentLabel = payload.intent.replace('_', ' ');
  const stars = '★'.repeat(payload.score) + '☆'.repeat(5 - payload.score);
  const adminUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/admin/conversations/${payload.conversationId}`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111;">
  <h2 style="margin-bottom: 4px;">New lead: ${intentLabel} ${stars}</h2>
  <p style="color: #666; margin-top: 0;">Score: ${payload.score}/5 · Intent: ${intentLabel}</p>

  ${payload.visitorEmail ? `<p><strong>Visitor email:</strong> ${payload.visitorEmail}</p>` : ''}

  <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 0 0 8px 0; font-weight: 600; font-size: 14px;">AI reasoning</p>
    <p style="margin: 0; color: #444; font-size: 14px;">${payload.reasoning}</p>
  </div>

  <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 0 0 12px 0; font-weight: 600; font-size: 14px;">Conversation transcript</p>
    <pre style="white-space: pre-wrap; font-size: 13px; color: #333; margin: 0;">${payload.transcript}</pre>
  </div>

  <a href="${adminUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
    View in admin →
  </a>

  <p style="margin-top: 24px; font-size: 12px; color: #999;">ai-folio · automated lead notification</p>
</body>
</html>`;
}

export async function sendLeadNotification(
  payload: LeadEmailPayload,
): Promise<void> {
  const to = process.env.ADMIN_EMAIL;
  const from = process.env.RESEND_FROM ?? 'onboarding@resend.dev';

  if (!to) {
    console.warn('[email] ADMIN_EMAIL not set — skipping notification');
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: `New lead (${payload.score}/5): ${payload.intent.replace('_', ' ')}`,
      html: buildLeadEmailHtml(payload),
    });

    if (error) {
      console.error('[email] Resend error:', error);
    } else {
      console.log('[email] Lead notification sent:', data?.id);
    }
  } catch (error) {
    console.error('[email] Unexpected error:', error);
  }
}
```

### 4. Wire into lead scoring

Replace the `console.log` stub in `src/lib/lead-scoring.ts`:

```ts name=src/lib/lead-scoring.ts
// Add this import at the top
import { sendLeadNotification } from '@/lib/email';

// Replace the existing score >= 4 block:
if (scoring.score >= 4) {
  const transcript = conversation.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  await sendLeadNotification({
    conversationId: conversation.id,
    intent: scoring.intent,
    score: scoring.score,
    reasoning: scoring.reasoning,
    transcript,
    visitorEmail: conversation.visitorEmail,
  }).catch(console.error);
}
```

## Test it

```bash
pnpm dev
```

1. Open the chat widget. Simulate a high-value recruiter conversation (score >= 4 — same transcript from Day 95's test script works).
2. Wait a few seconds.
3. Check your email inbox — you should receive the lead notification with the transcript and an "View in admin" button.

To verify without the chat widget, run the Day 95 test script — it now triggers the email for score >= 4 conversations.

```bash
npx tsx scripts/test-scoring.ts
```

Check Resend dashboard → Logs for delivery confirmation.

## Mini-task
Add a `Reply` button to the email (alongside "View in admin") that links to `mailto:${visitorEmail}?subject=Re: your enquiry` when `visitorEmail` is set. Skip gracefully if no email.

## Glossary
- **Resend** — transactional email API; TypeScript SDK; 3000 free emails/month.
- **DKIM** — DNS TXT record that proves you own the sending domain; required for production.
- **`onboarding@resend.dev`** — Resend's shared sandbox sender; works without domain setup; restricted to your verified account email as recipient.
- **Transactional email** — triggered by a user action (vs newsletter/bulk); higher deliverability requirements.

## Resources
- [Resend — Node.js SDK](https://resend.com/docs/send-with-nodejs)
- [Resend — Domain setup](https://resend.com/docs/dashboard/domains/introduction)

## Checklist
- [ ] `resend` installed, `RESEND_API_KEY` + `ADMIN_EMAIL` in `.env.local`
- [ ] `sendLeadNotification` builds an HTML email with transcript and admin link
- [ ] `lead-scoring.ts` calls `sendLeadNotification` (not `console.log`) for score >= 4
- [ ] Test conversation triggers email delivery
- [ ] Resend dashboard shows the sent email
- [ ] `pnpm build` passes
