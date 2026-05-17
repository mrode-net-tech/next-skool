# Day 85 — Metadata + SEO

## Goal
Use the Next.js Metadata API to set per-page titles, descriptions, Open Graph tags, Twitter cards, and a `sitemap.xml`. Understand static vs. dynamic metadata generation and why server-side metadata matters for SEO.

## Estimated time
~1.5 hours

## Prerequisites
Day 84 (loading/error UI in place).

## Where to put your code
In `ai-folio`.

## Explanation

**Metadata** in Next.js is declared via a `metadata` export (static) or a `generateMetadata` async function (dynamic) in any `page.tsx` or `layout.tsx`. Next.js merges metadata from the root layout down to the leaf page and injects the correct `<head>` tags server-side — no `react-helmet`, no manual `<Head>` component.

In Laravel terms: it's like setting `$title` in a controller and having the Blade layout pick it up from `$__env->yieldContent('title')` — but Next.js does the cascading automatically, and it works for SSR, SSG, and ISR without any extra plumbing.

**Open Graph** tags (`og:title`, `og:image`, `og:description`) control how the page looks when shared on Slack, Twitter/X, LinkedIn. Next.js has a typed `OpenGraph` object so you get autocomplete and can't misspell tag names. For a portfolio site, a good-looking link preview is part of your professional impression.

**Dynamic metadata** via `generateMetadata` is used when the title depends on data — for example, a project detail page where the title should be the project's name. The function receives the same `params` as the page component.

**Sitemap** via `app/sitemap.ts` — a special file that Next.js turns into `/sitemap.xml` automatically. Return an array of URL entries and Next.js handles the XML serialization.

## Step-by-step

### 1. Static metadata in root layout (already partially done on Day 81)

Update `layout.tsx` with the full set of base metadata:

```tsx name=src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'ai-folio — [Your Name]',
    template: '%s | ai-folio',
  },
  description:
    'Full-stack engineer specialising in TypeScript, Node.js, React, and AI integrations.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: baseUrl,
    siteName: 'ai-folio',
    images: [{ url: '/og-default.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@yourhandle',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={cn(inter.className, 'flex min-h-screen flex-col')}>
        <Navbar />
        <main className="container mx-auto flex-1 px-4 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

Add `NEXT_PUBLIC_BASE_URL=https://yoursite.com` to `.env.local` (production value). Leave it unset locally — the fallback `localhost:3000` is used.

### 2. Per-page static metadata

```tsx name=src/app/about/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About',
  description: 'Senior full-stack engineer with a background in Laravel and PHP.',
};

export default function AboutPage() {
  return (
    <section className="max-w-2xl">
      <h1 className="mb-4 text-3xl font-bold">About me</h1>
      {/* ... content from Day 83 ... */}
    </section>
  );
}
```

Add `export const metadata` to `/projects`, `/skills`, and `/contact` pages similarly.

```tsx name=src/app/projects/page.tsx
import type { Metadata } from 'next';
// ... other imports

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Things I have built — open-source and client work.',
};

// ... rest of the page unchanged
```

```tsx name=src/app/skills/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Skills',
  description: 'Technologies and tools I work with daily.',
};

// ... rest unchanged
```

### 3. Dynamic metadata for a project detail page

Create a dynamic route:

```bash
mkdir -p src/app/projects/[id]
```

```tsx name=src/app/projects/[id]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { projects } from '@/data/projects';

interface Props {
  params: { id: string };
}

export function generateStaticParams() {
  return projects.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = projects.find((p) => p.id === params.id);
  if (!project) return { title: 'Not found' };

  return {
    title: project.title,
    description: project.description,
    openGraph: {
      title: project.title,
      description: project.description,
    },
  };
}

export default function ProjectDetailPage({ params }: Props) {
  const project = projects.find((p) => p.id === params.id);
  if (!project) notFound();

  return (
    <section className="max-w-2xl">
      <h1 className="mb-4 text-3xl font-bold">{project.title}</h1>
      <p className="mb-4 text-muted-foreground">{project.description}</p>
      <div className="flex flex-wrap gap-2">
        {project.tags.map((tag) => (
          <span key={tag} className="rounded bg-secondary px-2 py-1 text-sm">
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}
```

`generateStaticParams` tells Next.js which `[id]` values to pre-render at build time — like a static site generator, but mixed with SSR for pages not listed.

### 4. Sitemap

```ts name=src/app/sitemap.ts
import type { MetadataRoute } from 'next';
import { projects } from '@/data/projects';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/projects`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/skills`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
  ];

  const projectRoutes: MetadataRoute.Sitemap = projects.map((p) => ({
    url: `${baseUrl}/projects/${p.id}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...projectRoutes];
}
```

### 5. robots.txt

```ts name=src/app/robots.ts
import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/admin/' },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

## Test it

```bash
pnpm dev
```

1. Open browser DevTools → Elements → `<head>`. Confirm `<title>`, `<meta name="description">`, and `<meta property="og:*">` tags are present.
2. Navigate to `/about` — title in browser tab should read "About | ai-folio".
3. Visit `http://localhost:3000/sitemap.xml` — you should see valid XML with all URLs.
4. Visit `http://localhost:3000/robots.txt` — should list sitemap URL.
5. `pnpm build` — no errors.

## Mini-task
Add an OG image using Next.js `ImageResponse`. Create `src/app/opengraph-image.tsx` — Next.js turns this into a dynamically generated `/opengraph-image` PNG using Satori.

## Glossary
- **`metadata` export** — static metadata object in a page or layout; merged with parent metadata.
- **`generateMetadata`** — async function for dynamic metadata (title depends on DB/params).
- **`metadataBase`** — base URL used to resolve relative paths in `og:image` etc.
- **`generateStaticParams`** — tells Next.js which dynamic route segments to pre-render at build time.
- **Sitemap** — `app/sitemap.ts` exports a function returning `MetadataRoute.Sitemap`; Next.js serves it as `/sitemap.xml`.

## Resources
- [Next.js — Metadata](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
- [Next.js — `generateMetadata`](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Next.js — Sitemap](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
- [Open Graph Protocol](https://ogp.me/)

## Checklist
- [ ] Root layout has `metadataBase`, `title.template`, `openGraph`, and `robots` set
- [ ] `/about`, `/projects`, `/skills` pages each export a `metadata` object
- [ ] `/projects/[id]` uses `generateMetadata` with project-specific title/description
- [ ] `generateStaticParams` lists all project IDs
- [ ] `notFound()` called when project ID not found
- [ ] `src/app/sitemap.ts` generates all static + dynamic URLs
- [ ] `src/app/robots.ts` disallows `/admin/`
- [ ] `pnpm build` passes
