# Day 97 — GitHub API integration (auto-pull projects)

## Goal
Replace the hardcoded `src/data/projects.ts` array with live data fetched from the GitHub API. Public repositories are pulled automatically, merged with any pinned metadata you provide, and cached for 1 hour. No API key needed for public repos.

## Estimated time
~2 hours

## Prerequisites
Day 96 (email working). A public GitHub account with at least a few repos.

## Where to put your code
In `ai-folio`.

## Explanation

**Next.js `fetch` with caching** — in Server Components you can `fetch()` directly. Next.js extends the native `fetch` API with a `next.cache` option: `{ next: { revalidate: 3600 } }` caches the response for 1 hour and regenerates it in the background when it expires (ISR — Incremental Static Regeneration). No `useState`, no `useEffect`, no separate caching layer.

**GitHub REST API** returns repository data: name, description, topics (used as tags), `html_url`, `stargazers_count`, `updated_at`. No authentication needed for public repos — though adding a `GITHUB_TOKEN` raises the rate limit from 60 to 5,000 requests/hour.

**Pinned metadata** pattern: GitHub gives you titles and descriptions, but you control which repos to feature and what extra context to add. Keep a `src/data/pinned-projects.ts` file mapping `repoName → { featured, customDescription, liveUrl }`. The fetch layer merges GitHub data with your pins.

In Laravel terms: this is like a `GithubService` that wraps an HTTP client (`Http::get(...)->cache(3600)->json()`), merged with a local config array. The Blade view gets the merged result — no controller awareness of where the data came from.

## Step-by-step

### 1. GitHub types

```ts name=src/lib/github.ts
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  topics: string[];
  stargazers_count: number;
  language: string | null;
  updated_at: string;
  fork: boolean;
  archived: boolean;
  visibility: string;
}

const GITHUB_USERNAME = process.env.GITHUB_USERNAME ?? 'your-username';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // optional — raises rate limit

export async function fetchGitHubRepos(): Promise<GitHubRepo[]> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }

  const response = await fetch(
    `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=30&type=public`,
    {
      headers,
      next: { revalidate: 3600 }, // ISR — refresh every hour
    },
  );

  if (!response.ok) {
    console.error('[github] API error:', response.status, response.statusText);
    return [];
  }

  const repos: GitHubRepo[] = await response.json();

  return repos.filter((r) => !r.fork && !r.archived && r.visibility === 'public');
}
```

### 2. Pinned metadata

```ts name=src/data/pinned-projects.ts
export interface PinnedProject {
  featured: boolean;
  customDescription?: string;
  liveUrl?: string;
  order?: number; // lower = shown first
}

export const pinnedProjects: Record<string, PinnedProject> = {
  'ai-folio': {
    featured: true,
    customDescription:
      'AI-powered portfolio site with Claude chat widget, pgvector RAG, and admin Kanban dashboard.',
    liveUrl: 'https://yoursite.com',
    order: 1,
  },
  'task-manager': {
    featured: true,
    customDescription:
      'Full-stack monorepo: Express API + React SPA + pnpm workspaces + Playwright e2e tests.',
    order: 2,
  },
};
```

### 3. Merged project type and loader

```ts name=src/lib/projects.ts
import type { Project } from '@/data/projects';
import { fetchGitHubRepos } from '@/lib/github';
import { pinnedProjects } from '@/data/pinned-projects';

export async function getProjects(): Promise<Project[]> {
  const repos = await fetchGitHubRepos();

  const projects: Project[] = repos.map((repo) => {
    const pin = pinnedProjects[repo.name];

    return {
      id: repo.name,
      title: repo.name
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      description:
        pin?.customDescription ?? repo.description ?? 'No description.',
      tags: repo.topics.length > 0
        ? repo.topics
        : repo.language
          ? [repo.language]
          : [],
      url: pin?.liveUrl ?? repo.homepage ?? undefined,
      repoUrl: repo.html_url,
      featured: pin?.featured ?? false,
      order: pin?.order ?? 999,
    };
  });

  return projects.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}
```

Update `src/data/projects.ts` to add the `featured` and `order` fields to the `Project` interface:

```ts name=src/data/projects.ts
export interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  url?: string;
  repoUrl?: string;
  featured?: boolean;
  order?: number;
}

// Static fallback (used when GitHub API fails or during local dev without token)
export const staticProjects: Project[] = [
  {
    id: 'task-manager',
    title: 'Task Manager',
    description: 'Full-stack monorepo — Express, React, Turborepo, Playwright.',
    tags: ['TypeScript', 'Express', 'React', 'Turborepo'],
    repoUrl: 'https://github.com/your-username/task-manager',
    featured: true,
    order: 2,
  },
];
```

### 4. Update Projects page to use live data

```tsx name=src/app/projects/page.tsx
import type { Metadata } from 'next';
import { getProjects } from '@/lib/projects';
import { staticProjects } from '@/data/projects';
import { ProjectCard } from '@/components/project-card';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Things I have built.',
};

export default async function ProjectsPage() {
  let projects = await getProjects().catch(() => staticProjects);

  if (projects.length === 0) projects = staticProjects;

  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">Projects</h1>
      <p className="mb-8 text-muted-foreground">
        {projects.length} public repositories · updated automatically from GitHub.
      </p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}
```

### 5. Add env vars

```bash name=.env.local
GITHUB_USERNAME=your-github-username
GITHUB_TOKEN=ghp_...   # optional
```

### 6. On-demand revalidation (optional)

To force an immediate refresh (e.g., after pushing a new repo):

```ts name=src/app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');

  if (secret !== process.env.REVALIDATE_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  revalidatePath('/projects');
  return new Response('Revalidated', { status: 200 });
}
```

Set `REVALIDATE_SECRET` in `.env.local`. Call this endpoint from a GitHub Actions workflow after deploy.

## Test it

```bash
pnpm dev
```

1. Visit `http://localhost:3000/projects` — see your real GitHub repos listed.
2. Check that `pinnedProjects` repos appear first with custom descriptions.
3. In DevTools → Network, look for the GitHub API request on first load. Subsequent page reloads should not show a new request (Next.js serves the cached response).

```bash
pnpm build && pnpm start
```

4. In production mode, visit `/projects` twice. The second request is served from the ISR cache — no GitHub API call.

## Mini-task
Add a `"⭐ ${repo.stargazers_count}"` badge to `ProjectCard` when `stargazers_count > 0`. Import the count from the `Project` interface (add it as an optional `stars?: number` field).

## Glossary
- **ISR (Incremental Static Regeneration)** — Next.js caching mode: page is statically generated, then regenerated in the background after the `revalidate` interval.
- **`next: { revalidate: N }`** — Next.js `fetch` extension; caches the response for N seconds, then regenerates.
- **`revalidatePath`** — server-side function that forces the cache for a path to be purged immediately.
- **Pinned metadata** — a local config file that augments or overrides data from an external API.

## Resources
- [Next.js — `fetch` caching](https://nextjs.org/docs/app/building-your-application/caching#fetch)
- [GitHub REST API — List user repos](https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user)
- [Next.js — On-demand revalidation](https://nextjs.org/docs/app/building-your-application/caching#on-demand-revalidation)

## Checklist
- [ ] `GITHUB_USERNAME` set in `.env.local`
- [ ] `fetchGitHubRepos` filters out forks and archived repos
- [ ] `getProjects` merges GitHub data with `pinnedProjects` metadata
- [ ] Projects page shows live GitHub repos, sorted by `order`
- [ ] Static fallback used when GitHub API returns empty or errors
- [ ] `pnpm build` passes
