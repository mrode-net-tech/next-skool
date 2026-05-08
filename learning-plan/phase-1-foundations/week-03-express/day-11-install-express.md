# Day 11 — Install Express

## Goal
Create the `my-api` project, install **Express**, and serve a `GET /` route.

## Estimated time
~1 hour.

## Where to put your code
`exercises/phase-1/week-03-express/my-api/`

## Explanation

**Express** is a minimalist HTTP framework. Compared to Laravel:

| Laravel | Express |
| --- | --- |
| Routes registered in `routes/web.php` | Routes registered with `app.get/post(...)` |
| Controllers resolved by container | Plain functions (or classes you wire yourself) |
| Middleware classes | Middleware = `(req, res, next) => { ... }` functions |
| Request validation via FormRequest | Validation we'll add manually with **Zod** (Day 14) |

## Step-by-step

```bash
mkdir -p exercises/phase-1/week-03-express/my-api
cd exercises/phase-1/week-03-express/my-api
npm init -y
npm i express
npm i -D typescript tsx @types/node @types/express vitest supertest @types/supertest
npx tsc --init
```

Use the same `tsconfig.json` baseline as Day 4.

```ts name=src/index.ts
import express from 'express';

const app = express();
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok', name: 'my-api' });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
```

Scripts in `package.json`:
```json
"scripts": {
  "dev":   "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "test":  "vitest run"
}
```

Run `npm run dev`, open http://localhost:3000, you should see JSON.

## Mini-task
Add a `GET /health` route returning `{ status: 'ok', uptime: process.uptime() }`.

## Glossary
- **Express** — minimalist Node HTTP framework.
- **Middleware** — function called between request and response.
- **`express.json()`** — middleware parsing JSON bodies into `req.body`.

## Resources
- [Express docs](https://expressjs.com/)
- [Express — Routing](https://expressjs.com/en/guide/routing.html)

## Checklist
- [ ] Server starts on port 3000
- [ ] `GET /` returns JSON
- [ ] `GET /health` works
