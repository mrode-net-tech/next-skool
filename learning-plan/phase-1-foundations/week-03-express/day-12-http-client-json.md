# Day 12 — HTTP client + JSON

## Goal
Call your API from a real HTTP client. Add a typed in-memory store for tasks and `GET` endpoints.

## Estimated time
~1 hour.

## Where to put your code
`exercises/phase-1/week-03-express/my-api/`

## Explanation

Until we build a frontend, we test the API with an HTTP client. Pick one:

- **JetBrains HTTP Client** (built into PhpStorm / WebStorm) — stored as `.http` files inside the repo.
- **Bruno** (open source, GUI) — https://www.usebruno.com/
- **curl** — always available.

We'll use a `.http` file, since you already have PhpStorm/WebStorm.

## Step-by-step

Create an in-memory store and routes:

```ts name=src/tasks/store.ts
import { randomUUID } from 'node:crypto';

export interface Task {
  id: string;
  title: string;
  done: boolean;
}

const tasks: Task[] = [
  { id: randomUUID(), title: 'Learn Express', done: false },
  { id: randomUUID(), title: 'Drink coffee', done: true },
];

export const TaskStore = {
  list: (): Task[] => [...tasks],
  find: (id: string): Task | undefined => tasks.find((t) => t.id === id),
};
```

```ts name=src/index.ts
import express from 'express';
import { TaskStore } from './tasks/store';

const app = express();
app.use(express.json());

app.get('/', (_req, res) => res.json({ status: 'ok' }));

app.get('/tasks', (_req, res) => {
  res.json(TaskStore.list());
});

app.get('/tasks/:id', (req, res) => {
  const t = TaskStore.find(req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  res.json(t);
});

app.listen(3000, () => console.log('http://localhost:3000'));
```

Create `requests.http`:

```http name=requests.http
### list tasks
GET http://localhost:3000/tasks
Accept: application/json

### get one (replace :id)
GET http://localhost:3000/tasks/REPLACE_ID
Accept: application/json
```

Run `npm run dev`, open `requests.http` in the IDE, click the green arrow next to each request.

## Mini-task
Add a `?done=true|false` query filter to `GET /tasks`.

## Glossary
- **`.http` file** — plain-text HTTP request collection runnable in PhpStorm/WebStorm.
- **Status code** — e.g. `200 OK`, `404 Not Found`.

## Resources
- [JetBrains — HTTP Client](https://www.jetbrains.com/help/phpstorm/http-client-in-product-code-editor.html)
- [Bruno](https://www.usebruno.com/)

## Checklist
- [ ] You can list and fetch tasks via `.http` file
- [ ] 404 returned for unknown id
- [ ] Optional filter works
