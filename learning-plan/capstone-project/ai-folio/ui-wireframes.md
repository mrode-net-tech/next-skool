# ai-folio — UI wireframes

Text descriptions of every screen. Build the layout before the content.

---

## Public pages

### Home (`/`)
```
┌─────────────────────────────────────────┐
│ NAVBAR: ai-folio | Home About Projects Skills Contact │
├─────────────────────────────────────────┤
│                                         │
│         Hi, I'm [Your Name]             │
│   Full-stack engineer · AI integrations │
│                                         │
│   [See my work]   [Get in touch]        │
│                                         │
│   ── Featured projects (3 cards) ──     │
│   ┌───────┐ ┌───────┐ ┌───────┐        │
│   │ Card  │ │ Card  │ │ Card  │        │
│   └───────┘ └───────┘ └───────┘        │
│                                         │
├─────────────────────────────────────────┤
│ FOOTER: © 2026 · GitHub · LinkedIn      │
├─────────────────────────────────────────┤
│                          [💬 chat FAB]  │  ← fixed, bottom-right
└─────────────────────────────────────────┘
```

### Chat widget (open)
```
┌──────────────────────────────────┐
│ Chat with AI               [✕]  │
├──────────────────────────────────┤
│                                  │
│  ┌── assistant ──────────────┐   │
│  │ Hi! Ask me anything about │   │
│  │ this portfolio.           │   │
│  └───────────────────────────┘   │
│                                  │
│              ┌── user ─────────┐ │
│              │ What stack do   │ │
│              │ you use?        │ │
│              └────────────────-┘ │
│                                  │
│  ┌── assistant ──────────────┐   │
│  │ TypeScript, Node.js,      │   │  ← tokens stream in
│  │ React, Next.js…           │   │
│  └───────────────────────────┘   │
│                                  │
│ [Ask me anything…    ] [➤ send] │
└──────────────────────────────────┘
```

Sheet slides in from the right. Desktop: max-width 400px. Mobile: full-width.

### About (`/about`)
Single column, max-width prose. Sections: bio paragraph, what I'm looking for, interests.

### Projects (`/projects`)
Responsive grid: 1 col mobile → 2 col tablet → 3 col desktop.
Each card: title, description, tag badges, [Code] and [Live] buttons.

### Projects detail (`/projects/:id`)
Hero: title + tags. Body: description paragraphs. Sidebar: tech stack list, links.

### Skills (`/skills`)
Grouped badge clouds: Backend / Frontend / Infrastructure / AI.

### Contact (`/contact`)
Server Action form: name, email, message. Submit → confirmation message. No page reload.

---

## Admin pages (require Auth.js session)

### Admin login (`/admin/login`)
```
┌────────────────────────────────┐
│         Admin login            │
│                                │
│  Email    [________________]   │
│  Password [________________]   │
│                                │
│           [Sign in]            │
└────────────────────────────────┘
```
Credentials provider. Single admin account (portfolio owner). No registration flow.

### Admin dashboard (`/admin`)
Split layout. Sidebar: nav links (Conversations, Kanban, Analytics, Settings).

**Conversations tab**
```
┌─────────────────────────────────────────────────────┐
│ Conversations        [Status ▾] [Score ▾] [Search]  │
├──────────────────────┬─────────┬────────┬───────────┤
│ Session / Date       │ Intent  │ Score  │ Status    │
├──────────────────────┼─────────┼────────┼───────────┤
│ sess_abc · 2m ago    │ job     │ ★★★★★  │ New       │
│ sess_xyz · 1h ago    │ collab  │ ★★★☆☆  │ Reviewed  │
└──────────────────────┴─────────┴────────┴───────────┘
```
Clicking a row opens the conversation detail panel (slide-over or new page).

**Conversation detail**
```
┌────────────────────────────────────────────────────┐
│  ← Back   Conversation sess_abc                    │
├────────────────────────────────────────────────────┤
│  Score: ★★★★★   Intent: Job offer   Status: New    │
│  Email: hiring@acme.com                            │
├────────────────────────────────────────────────────┤
│  AI Summary                           [Generate]   │
│  ┌──────────────────────────────────────────────┐  │
│  │ Senior recruiter from Acme Corp…             │  │
│  └──────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────┤
│  Messages                                          │
│  [user]  "Are you open to a contract role?"        │
│  [ai]    "Yes, I'm available for…"                 │
│  [user]  "What's your rate?"                       │
│  [ai]    "For contract work…"                      │
├────────────────────────────────────────────────────┤
│  Draft reply                          [Generate]   │
│  ┌──────────────────────────────────────────────┐  │
│  │ Hi,                                          │  │
│  │ Thank you for reaching out…                  │  │
│  └──────────────────────────────────────────────┘  │
│  Notes: [__________________________]  [Save]        │
└────────────────────────────────────────────────────┘
```

**Kanban tab**
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│     New      │  Reviewing   │  Contacted   │    Closed    │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ ┌──────────┐ │              │              │              │
│ │ Acme Corp│ │              │              │              │
│ │ ★★★★★    │ │              │              │              │
│ │ job_offer│ │              │              │              │
│ └──────────┘ │              │              │              │
│ ┌──────────┐ │              │              │              │
│ │ Jane D.  │ │              │              │              │
│ │ ★★★☆☆   │ │              │              │              │
│ │ collab   │ │              │              │              │
│ └──────────┘ │              │              │              │
└──────────────┴──────────────┴──────────────┴──────────────┘
```
Cards are draggable between columns. On drop: `PATCH /api/admin/kanban/:id`.

**Analytics tab**
- Bar chart: conversations per day (last 30 days)
- Pie chart: intent distribution
- Score histogram
- Top queries (most-retrieved CV chunks)

---

## Responsive behaviour

- Mobile: navbar collapses to hamburger. Chat widget is full-screen sheet.
- Admin layout: sidebar collapses to bottom tab bar on mobile.
- Kanban: horizontal scroll on mobile; no drag-and-drop (tap to move column instead).
