# Day 13 — POST + req.body

## Goal
Add `POST /tasks` and `DELETE /tasks/:id`. Read JSON request bodies. Return correct status codes.

## Estimated time
~1 hour.

## Where to put your code
`exercises/phase-1/week-03-express/my-api/`

## Explanation

- `express.json()` middleware (added on Day 11) parses the body into `req.body`.
- Conventions: `201 Created` on POST, `204 No Content` on DELETE.

## Step-by-step

Expand the store:

```ts name=src/tasks/store.ts
import { randomUUID } from 'node:crypto';

export interface Task {
  id: string;
  title: string;
  done: boolean;
}

const tasks: Task[] = [];

export const TaskStore = {
  list:   (): Task[] => [...tasks],
  find:   (id: string) => tasks.find((t) => t.id === id),
  create: (title: string): Task => {
    const t: Task = { id: randomUUID(), title, done: false };
    tasks.push(t);
    return t;
  },
  remove: (id: string): boolean => {
    const i = tasks.findIndex((t) => t.id === id);
    if (i === -1) return false;
    tasks.splice(i, 1);
    return true;
  },
};
```

Add routes:

```ts
app.post('/tasks', (req, res) => {
  const { title } = req.body ?? {};
  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'title required' });
  }
  const t = TaskStore.create(title.trim());
  res.status(201).json(t);
});

app.delete('/tasks/:id', (req, res) => {
  const ok = TaskStore.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  res.status(204).send();
});
```

Add to `requests.http`:

```http
### create
POST http://localhost:3000/tasks
Content-Type: application/json

{ "title": "Buy milk" }

### delete (paste id from the create response)
DELETE http://localhost:3000/tasks/REPLACE_ID
```

## Mini-task
Add `PATCH /tasks/:id/done` that flips `done` to `true`. Status codes: `200` on success, `404` if missing.

## Glossary
- **HTTP verbs** — GET, POST, PUT, PATCH, DELETE.
- **Status code** — numeric response category (2xx success, 4xx client error, 5xx server error).

## Resources
- [MDN — HTTP status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [Express — res object](https://expressjs.com/en/api.html#res)

## Checklist
- [ ] POST returns 201 + the created task
- [ ] DELETE returns 204
- [ ] Validation returns 400
- [ ] PATCH /tasks/:id/done works
