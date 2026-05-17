# Day 41 — Vite + TypeScript + React setup

## Goal
Bootstrap a Vite + React + TypeScript project (`my-web`), understand the generated structure, and render your first custom component in the browser.

## Estimated time
~1 hour

## Prerequisites
Node 18+, npm. Days 1–20 familiarity with TypeScript.

## Where to put your code
New project: `my-web` (sibling of `my-api`).

## Explanation

**Vite** is a dev server and bundler. Think of it as the front-end equivalent of Laravel Mix / Vite in the Laravel world — but much faster because it skips bundling during development and serves ES modules directly to the browser. Hot Module Replacement (HMR) updates only the changed component without a full-page reload.

**React** is a UI library: you describe what the UI should look like given current state, and React figures out the minimal DOM changes needed. Unlike Blade templates (render-on-server, static HTML), React renders in the browser and re-renders automatically when state changes.

**JSX** is syntactic sugar compiled to `React.createElement(...)` calls. It looks like HTML inside TypeScript files. The compiler (via Vite + esbuild) transforms it before the browser sees it.

TypeScript in React works exactly like in `my-api` — interfaces for props, strict null checks, inference everywhere.

## Step-by-step

### 1. Create the project

```bash
npm create vite@latest my-web -- --template react-ts
cd my-web
npm install
```

### 2. Inspect the generated structure

```
my-web/
├── public/           # static assets, copied as-is
├── src/
│   ├── assets/
│   ├── App.tsx       # root component
│   ├── App.css
│   ├── main.tsx      # entry point — mounts <App /> into #root
│   └── vite-env.d.ts # Vite type declarations
├── index.html        # single HTML file; Vite injects <script type="module">
├── tsconfig.json
└── vite.config.ts
```

### 3. Start the dev server

```bash
npm run dev
```

Open `http://localhost:5173`. You should see the Vite + React logo page.

### 4. Replace `src/App.tsx` with a minimal version

```tsx name=src/App.tsx
function App() {
  return (
    <div>
      <h1>my-web</h1>
    </div>
  );
}

export default App;
```

HMR will update the browser instantly — no refresh.

### 5. Create your first component

```tsx name=src/components/Greeting.tsx
interface Props {
  name: string;
}

export function Greeting({ name }: Props) {
  return <p>Hello, {name}!</p>;
}
```

Use it in `App.tsx`:

```tsx name=src/App.tsx
import { Greeting } from './components/Greeting';

function App() {
  return (
    <div>
      <h1>my-web</h1>
      <Greeting name="world" />
    </div>
  );
}

export default App;
```

### 6. Add path aliases (quality-of-life)

```ts name=vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

```json name=tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Install `@types/node`:
```bash
npm install -D @types/node
```

Now `import { Greeting } from '@/components/Greeting'` works everywhere.

## Test it

```bash
npm run build
```

Expected output: `dist/` folder, no TypeScript errors. If it builds, the setup is correct.

## Mini-task
Add a second component `<Badge text="v1.0" />` that renders a `<span>` with a colored background. Import and render it in `App.tsx`.

## Glossary
- **Vite** — dev server + bundler; replaces Webpack/CRA in modern setups.
- **HMR** — Hot Module Replacement; updates changed modules in-browser without full reload.
- **JSX** — HTML-like syntax in `.tsx` files, compiled to `React.createElement`.
- **Component** — a function returning JSX; the unit of composition in React.
- **Props** — immutable inputs to a component, passed like HTML attributes.

## Resources
- [Vite docs](https://vitejs.dev/guide/)
- [React docs — Your First Component](https://react.dev/learn/your-first-component)
- [TypeScript + React cheatsheet](https://react-typescript-cheatsheet.netlify.app/docs/basic/setup)

## Checklist
- [ ] `npm create vite` ran, `my-web` exists
- [ ] `npm run dev` shows page at `localhost:5173`
- [ ] `Greeting` component renders with typed props
- [ ] `@` path alias works
- [ ] `npm run build` produces `dist/` with no errors
