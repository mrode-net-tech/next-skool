# Exercises

This is where **your code** lives. The [`learning-plan/`](../learning-plan/) folder has only Markdown — never put code there.

## Folder layout

```
exercises/
├── phase-1/
│   ├── week-01-setup/
│   │   └── nauka-node/
│   ├── week-02-typescript/
│   │   └── ts-playground/
│   ├── week-03-express/
│   │   └── my-api/          # continued in week 4–8
│   └── week-04-prisma/
│       └── (uses my-api from week 3)
├── phase-2/  (continues my-api)
├── phase-3/
│   └── week-09-react/
│       └── my-web/          # continued through week 12
├── phase-4/
│   └── week-13-monorepo/
│       └── task-manager/    # combines my-api + my-web
├── phase-5/
│   └── week-17-nextjs/
│       └── habit-tracker/   # CAPSTONE — continued through phase 6
└── phase-6/  (continues habit-tracker)
```

## Project progression

| Weeks | Project | Notes |
| ----- | ------- | ----- |
| 1     | `nauka-node` | Hello-world setup |
| 2     | `ts-playground` | TS exercises with Vitest |
| 3–8   | `my-api` | Task Manager API (Express + Prisma + DDD + auth) |
| 9–12  | `my-web` | React frontend for `my-api` |
| 13–16 | `task-manager` | Monorepo: `apps/api` + `apps/web` + `packages/shared` |
| 17–24 | `habit-tracker` | **CAPSTONE** — Next.js Habit Tracker SaaS |

## Rules

1. **One project = one `package.json`** = own dependencies and own commands.
2. **You install dependencies inside each project**, not globally (except Node, Git, Docker).
3. **Never commit `node_modules/` or `.env`** — `.gitignore` is already configured.
4. **Commit per day**, with messages like `feat(day-14): add zod validation`.
5. **Each day file** tells you exactly which folder to work in (`Where to put your code`).
