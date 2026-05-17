# Habit Tracker — API spec

In the capstone we use **Server Actions** in Next.js for most mutations and **Server Components** for reads. We still document a stable REST shape for clarity (and so you can learn OpenAPI in Phase 6).

## Auth

| Method | Path                | Body                                  | Response               |
| ------ | ------------------- | ------------------------------------- | ---------------------- |
| POST   | `/api/auth/register`| `{ email, password, displayName }`    | `{ user }`             |
| POST   | `/api/auth/login`   | `{ email, password }`                 | `{ session }`          |
| POST   | `/api/auth/logout`  | —                                     | `204`                  |

## Habits

| Method | Path                  | Body / Query                                | Response          |
| ------ | --------------------- | ------------------------------------------- | ----------------- |
| GET    | `/api/habits`         | `?categoryId=&archived=false`               | `Habit[]`         |
| POST   | `/api/habits`         | `{ name, frequency, color, icon, ... }`     | `Habit`           |
| GET    | `/api/habits/:id`     | —                                           | `Habit`           |
| PATCH  | `/api/habits/:id`     | partial habit                               | `Habit`           |
| DELETE | `/api/habits/:id`     | —                                           | `204`             |
| POST   | `/api/habits/:id/archive` | —                                       | `Habit`           |

## Completions

| Method | Path                                | Body            | Response             |
| ------ | ----------------------------------- | --------------- | -------------------- |
| POST   | `/api/habits/:id/completions/today` | —               | `HabitCompletion`    |
| DELETE | `/api/habits/:id/completions/today` | —               | `204`                |
| GET    | `/api/habits/:id/completions`       | `?from=&to=`    | `HabitCompletion[]`  |

## Dashboard / stats

| Method | Path                       | Response                                |
| ------ | -------------------------- | --------------------------------------- |
| GET    | `/api/dashboard/today`     | `{ habits: HabitWithDoneToday[] }`      |
| GET    | `/api/dashboard/week`      | `{ grid: WeeklyGrid }`                  |
| GET    | `/api/habits/:id/stats`    | `{ completionRate, streak, history }`   |

## Categories

| Method | Path                  | Body                       | Response       |
| ------ | --------------------- | -------------------------- | -------------- |
| GET    | `/api/categories`     | —                          | `Category[]`   |
| POST   | `/api/categories`     | `{ name, color }`          | `Category`     |
| PATCH  | `/api/categories/:id` | partial                    | `Category`     |
| DELETE | `/api/categories/:id` | —                          | `204`          |

## Achievements

| Method | Path                | Response          |
| ------ | ------------------- | ----------------- |
| GET    | `/api/achievements` | `Achievement[]`   |

## Validation

All request bodies are validated by **Zod schemas** that are **shared between server and client** (so the same schema powers `react-hook-form` and the server action).
