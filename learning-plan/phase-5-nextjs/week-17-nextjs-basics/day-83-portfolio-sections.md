# Day 83 — Portfolio sections (About / Projects / Skills)

## Goal
Build three content-rich pages — About, Projects, and Skills — using Server Components and static data. Practice composing reusable UI components and understand why static data that never changes belongs in Server Components, not `useEffect` calls.

## Estimated time
~2 hours

## Prerequisites
Day 82 (Navbar + routes wired).

## Where to put your code
In `ai-folio`.

## Explanation

**Server Components can fetch data directly** — no `useEffect`, no `useState`, no loading spinner for the initial render. In a Server Component you `await` data at the top level and pass it to JSX. The rendered HTML ships to the browser; React hydrates just the interactive parts.

In Laravel terms this is like a Blade view where the controller already passed `$projects` to the template — except here the component *is* the controller and the template. No HTTP layer between them.

For this day, data is static (a TypeScript file exporting arrays). Days 89–90 replace that with database queries. The component code changes minimally — that's the point. Server Components decouple data fetching from rendering, the same way a Laravel repository decouples SQL from controller logic.

**Colocation** — keep data types, static data, and the components that use them close together. `src/data/` holds the static arrays. Components import from there. When you switch to a database later, you only change `src/data/`.

## Step-by-step

### 1. Static data files

```ts name=src/data/projects.ts
export interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  url?: string;
  repoUrl?: string;
}

export const projects: Project[] = [
  {
    id: 'task-manager',
    title: 'Task Manager',
    description:
      'Full-stack monorepo with Express API, React frontend, shared Zod types, and Playwright e2e tests.',
    tags: ['TypeScript', 'Express', 'React', 'Turborepo'],
    repoUrl: 'https://github.com/you/task-manager',
  },
  {
    id: 'ai-folio',
    title: 'ai-folio',
    description:
      'This portfolio site — Next.js App Router, Claude AI chat widget, RAG with pgvector.',
    tags: ['Next.js', 'Claude AI', 'pgvector', 'Tailwind'],
    repoUrl: 'https://github.com/you/ai-folio',
  },
];
```

```ts name=src/data/skills.ts
export interface SkillGroup {
  category: string;
  items: string[];
}

export const skills: SkillGroup[] = [
  {
    category: 'Backend',
    items: ['Node.js', 'TypeScript', 'Express', 'Prisma', 'PostgreSQL', 'PHP', 'Laravel'],
  },
  {
    category: 'Frontend',
    items: ['React', 'Next.js', 'Tailwind CSS', 'shadcn/ui', 'TanStack Query'],
  },
  {
    category: 'Infrastructure',
    items: ['Docker', 'GitHub Actions', 'Railway', 'Vercel', 'Fly.io'],
  },
  {
    category: 'AI / ML',
    items: ['Claude API', 'pgvector', 'RAG pipelines', 'Vercel AI SDK'],
  },
];
```

### 2. Project card component

```tsx name=src/components/project-card.tsx
import { ExternalLink, Github } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Project } from '@/data/projects';

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>{project.title}</CardTitle>
        <CardDescription>{project.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {project.tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
      </CardContent>
      <CardFooter className="mt-auto flex gap-2">
        {project.repoUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={project.repoUrl} target="_blank" rel="noopener noreferrer">
              <Github size={14} className="mr-1" /> Code
            </a>
          </Button>
        )}
        {project.url && (
          <Button size="sm" asChild>
            <a href={project.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} className="mr-1" /> Live
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
```

Add shadcn components you need:

```bash
pnpm dlx shadcn-ui@latest add card badge button
```

### 3. Projects page (Server Component)

```tsx name=src/app/projects/page.tsx
import { projects } from '@/data/projects';
import { ProjectCard } from '@/components/project-card';

export default function ProjectsPage() {
  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">Projects</h1>
      <p className="mb-8 text-muted-foreground">Things I&apos;ve built.</p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}
```

### 4. Skills page (Server Component)

```tsx name=src/app/skills/page.tsx
import { skills } from '@/data/skills';
import { Badge } from '@/components/ui/badge';

export default function SkillsPage() {
  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">Skills</h1>
      <p className="mb-8 text-muted-foreground">Technologies I work with.</p>
      <div className="grid gap-8 sm:grid-cols-2">
        {skills.map((group) => (
          <div key={group.category}>
            <h2 className="mb-3 text-lg font-semibold">{group.category}</h2>
            <div className="flex flex-wrap gap-2">
              {group.items.map((item) => (
                <Badge key={item}>{item}</Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

### 5. About page (Server Component)

```tsx name=src/app/about/page.tsx
export default function AboutPage() {
  return (
    <section className="max-w-2xl">
      <h1 className="mb-4 text-3xl font-bold">About me</h1>
      <div className="space-y-4 text-muted-foreground">
        <p>
          Senior full-stack engineer with a background in Laravel and PHP, now
          working primarily in the TypeScript ecosystem (Node.js, React,
          Next.js).
        </p>
        <p>
          I enjoy building products end-to-end — from database schema design
          through REST APIs to polished React UIs. Recently exploring AI
          integration: RAG pipelines, streaming LLM responses, and
          agentic workflows with the Claude API.
        </p>
        <p>
          Open to full-time roles and interesting freelance projects. Drop me a
          message via the chat widget or the contact form.
        </p>
      </div>
    </section>
  );
}
```

### 6. Update home page with a hero section

```tsx name=src/app/page.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <section className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-5xl font-bold tracking-tight">
        Hi, I&apos;m [Your Name]
      </h1>
      <p className="mt-4 max-w-xl text-xl text-muted-foreground">
        Full-stack engineer · TypeScript · Next.js · AI integrations
      </p>
      <div className="mt-8 flex gap-4">
        <Button asChild>
          <Link href="/projects">See my work</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/contact">Get in touch</Link>
        </Button>
      </div>
    </section>
  );
}
```

## Test it

```bash
pnpm dev
```

- `/projects` — grid of project cards with badges and links.
- `/skills` — grouped badges per category.
- `/about` — prose section.
- `/` — hero with two CTA buttons.
- `pnpm build` — no TypeScript or ESLint errors.

## Mini-task
Add a `featured: boolean` field to `Project`. Filter the home page to show only featured projects (max 3) using `projects.filter(p => p.featured).slice(0, 3)`.

## Glossary
- **Static data** — TypeScript arrays/objects imported at build time; no network request needed.
- **`asChild`** — shadcn/ui prop that renders a component as its child element (e.g., Button renders as `<a>` when `asChild` + `<a>` are used together).
- **Colocation** — keeping related files (data, types, components) near each other in the folder tree.

## Resources
- [Next.js — Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [shadcn/ui — Card](https://ui.shadcn.com/docs/components/card)
- [shadcn/ui — Badge](https://ui.shadcn.com/docs/components/badge)

## Checklist
- [ ] `src/data/projects.ts` and `src/data/skills.ts` created
- [ ] `ProjectCard` component uses shadcn Card, Badge, Button
- [ ] `/projects` renders a responsive grid of project cards
- [ ] `/skills` renders skill groups with badges
- [ ] `/about` has prose content
- [ ] Home page has a hero section with CTA buttons
- [ ] `pnpm build` passes
