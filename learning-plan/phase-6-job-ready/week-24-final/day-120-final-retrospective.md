# Day 120 — Final retrospective

## Goal
Review the full 24-week journey, audit the finished `ai-folio` project against production standards, identify gaps to close before job applications, and build a learning roadmap for what comes next. After this day you have a clear picture of what you know, what you built, and where to go next.

## Estimated time
~2 hours (no code — reflection and planning)

## Prerequisites
All 119 previous days.

## Where to put your code
Reflection only — no code today.

---

## What you built

Over 24 weeks you went from zero TypeScript to a production AI application. Here is what exists:

**Phase 1 (Days 1–20):** Node.js, TypeScript, Express, Prisma. Built `my-api` from scratch — routing, middleware, ORM, database migrations.

**Phase 2 (Days 21–40):** JWT authentication, DDD (domain-driven design), structured error handling, logging, configuration management, integration testing. `my-api` became production-grade.

**Phase 3 (Days 41–60):** React 18, React Router, React Hook Form + Zod, TanStack Query, Tailwind CSS, shadcn/ui, RTL, msw. Built `my-web`.

**Phase 4 (Days 61–80):** pnpm workspaces, Turborepo, shared types, type-safe API client, Playwright E2E. Merged `my-api` and `my-web` into `task-manager` monorepo. Deployed to Railway and Vercel.

**Phase 5 (Days 81–100):** Next.js 14 App Router, Server Components, Server Actions, Auth.js, Claude API, Vercel AI SDK, pgvector, RAG, lead scoring with `generateObject`, Kanban board, email notifications, GitHub API. Built `ai-folio` — an AI-powered portfolio with admin dashboard.

**Phase 6 (Days 101–120):** Docker, multi-stage builds, docker-compose, GitHub Actions CI/CD, BullMQ background jobs, Redis, scheduled jobs, Sentry, production deploy on Fly.io with zero-downtime deploys and uptime monitoring.

---

## Step-by-step

### 1. Audit the production app

Go through this checklist for `ai-folio`. Be honest — "partially" counts as no:

**Security**
- [ ] Auth.js protects all admin routes (no public access to `/admin/*`)
- [ ] API keys are never exposed in client-side code or git history
- [ ] Input validation (Zod) on all Route Handlers that accept data
- [ ] CSRF protection active (Auth.js provides this for Server Actions)
- [ ] Rate limiting on the `/api/chat` endpoint (prevents API key abuse)

**Reliability**
- [ ] Health endpoint returns 503 when DB or Redis is down
- [ ] BullMQ jobs have retry with exponential backoff
- [ ] Worker handles SIGTERM gracefully (finishes in-flight jobs)
- [ ] Prisma connection pool sized correctly for the Fly.io VM memory
- [ ] Sentry captures exceptions from all runtimes (Node, Edge, Worker)

**Performance**
- [ ] Next.js `standalone` output in Docker (no full `node_modules` in production)
- [ ] Static assets served from Next.js static export (CDN-friendly)
- [ ] Embeddings generated asynchronously (background job, not in request cycle)
- [ ] GitHub API responses cached in Redis (avoids rate limits)
- [ ] Docker image under 200 MB

**Observability**
- [ ] Uptime monitor checks `/api/health` every 1–5 minutes
- [ ] Sentry performance alert on `/api/chat` p95 > 3 seconds
- [ ] Worker logs persisted beyond 24 hours (log drain)
- [ ] Runbook documents known failure modes

### 2. Compare Day 1 you vs Day 120 you

Write short answers (this is for you, not an exam):

1. **What concept was hardest to learn?** Why?
2. **Which day was the most satisfying?** What made it click?
3. **What would you do differently** if starting over?
4. **Which technology surprised you** (positively or negatively)?

No right answers. The goal is to consolidate the learning — the act of articulating it strengthens retention.

### 3. Identify the gaps

Things this curriculum deliberately deferred that you should learn next:

**Testing gaps:**
- Property-based testing (fast-check)
- Contract testing (Pact) — important for the monorepo API/web boundary
- Load testing (k6 or Artillery) — how does the chat endpoint hold up under 100 concurrent users?

**Infrastructure gaps:**
- Database connection pooling (PgBouncer) — the Fly.io Postgres does not scale connection count well; you need PgBouncer for high traffic
- Redis Sentinel or Cluster — single-node Redis is a single point of failure
- CDN for static assets (Cloudflare) — currently Next.js serves static files; a CDN removes that load

**AI/LLM gaps:**
- Streaming tool use (Claude tool_use in streaming mode)
- Prompt management (versioning prompts, A/B testing system prompts)
- LLM observability (LangSmith or Langfuse — tracing exactly what prompt/tokens went to Claude)
- Fine-tuning (not available for Claude, but relevant for other models)

**Career gaps:**
- System design interviews — you can build a portfolio app, can you design Twitter?
- Contributing to open source — pick a TypeScript project you use (`zod`, `trpc`, a shadcn component) and fix a bug or improve the docs

### 4. Plan the next 90 days

Pick **one** from each column:

| Deepen | Broaden | Ship |
|---|---|---|
| Advanced TypeScript (mapped types, template literals, variance) | Go or Rust for systems/CLI work | A second AI project with different architecture |
| Distributed systems (event sourcing, CQRS) | Python for ML/data pipelines | Contribute a meaningful PR to an OSS project |
| Advanced React patterns (compound components, portals, concurrent features) | DevOps depth (Kubernetes, Terraform) | Write a technical blog post about something you built |

You do not need all three. One deepen + one ship is a healthy 90-day plan for someone preparing for job applications.

### 5. Prepare the portfolio

`ai-folio` is your primary portfolio piece — make sure it makes a strong impression:

- [ ] README explains the project in three sentences (what, who for, what's interesting)
- [ ] The AI chat demonstrates real answers about you (CV indexed, not placeholder text)
- [ ] Admin dashboard is locked behind real auth (not `password: admin`)
- [ ] Lighthouse score: Performance > 90, Accessibility > 90
- [ ] No obvious errors in Sentry from normal usage
- [ ] Custom domain set (not `ai-folio.fly.dev`)

### 6. The meta-skill you built

Beyond any specific technology, you built the habit of **making things work end-to-end**. Most developers get comfortable in their layer of the stack. You went from `npm init` to a production Docker deployment with CI/CD, AI integration, background jobs, and monitoring.

This end-to-end perspective — knowing what happens when a request enters the load balancer, goes through the Next.js runtime, hits a Prisma query, comes back as a streaming Claude response, and gets processed by a BullMQ worker — is rare and valuable. It makes you dangerous in a good way: you can debug across the entire system, not just your layer.

---

## Glossary (career edition)

- **Breadth-first** — understanding many technologies at a working level; useful for senior/lead roles where you need to make technology choices.
- **Depth-first** — mastering one technology deeply; useful for specialist roles and for building genuine expertise.
- **T-shaped** — broad knowledge across many areas + deep expertise in one or two; the career profile most hiring managers in product companies look for.
- **OSS contribution** — contributing to an open-source project; demonstrates ability to read unfamiliar code, communicate in writing, and ship in a collaborative context.
- **System design** — the skill of designing scalable distributed systems at the whiteboard; separate from coding ability but tested in senior-level interviews.

## Resources

- [roadmap.sh — backend](https://roadmap.sh/backend) — visualise what you've covered and what remains
- [Designing Data-Intensive Applications](https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/) — the definitive book on distributed systems and data at scale
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/) — fills in the TypeScript gaps this curriculum deferred
- [The Pragmatic Programmer](https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/) — career fundamentals that don't expire

## Checklist

- [ ] Security audit checklist completed (all items either done or explicitly deferred with a reason)
- [ ] Reliability checklist completed
- [ ] Observability checklist completed
- [ ] Two personal retrospective questions answered in writing
- [ ] Top 3 gaps identified for the next 90 days
- [ ] 90-day plan written (one deepen + one ship minimum)
- [ ] `ai-folio` README updated to production-ready standard
- [ ] Lighthouse score > 90 on Performance and Accessibility
