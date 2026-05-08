# Habit Tracker — domain model (DDD sketch)

A short DDD sketch. You will refine it while building.

## Entities

### `User`
- `id: UUID`
- `email: string` (unique)
- `passwordHash: string`
- `displayName: string`
- `createdAt: DateTime`

### `Habit` *(aggregate root)*
- `id: UUID`
- `userId: UUID`
- `name: string`
- `frequency: HabitFrequency` (value object)
- `color: Color` (value object)
- `icon: Icon` (value object)
- `categoryId: UUID | null`
- `coverImageUrl: string | null`
- `archivedAt: DateTime | null`
- `createdAt: DateTime`

### `HabitCompletion` *(part of the Habit aggregate)*
- `id: UUID`
- `habitId: UUID`
- `date: LocalDate` (no time — one record per habit per day)
- `createdAt: DateTime`

### `Category`
- `id: UUID`
- `userId: UUID`
- `name: string`
- `color: Color`

### `Achievement`
- `id: UUID`
- `userId: UUID`
- `code: AchievementCode` (e.g. `STREAK_7`, `STREAK_30`, `FIRST_HABIT`)
- `unlockedAt: DateTime`

## Value objects

- **`HabitFrequency`** — either `DAILY` or `WEEKLY` with target days per week.
- **`Color`** — hex string, validated.
- **`Icon`** — enum-like identifier (e.g. `book`, `dumbbell`).
- **`LocalDate`** — date without time, used to dedupe completions per day.
- **`AchievementCode`** — enum.

## Aggregates

- **Habit** is the aggregate root for `HabitCompletion`. You only create / delete completions through habit-level use cases.
- **User** owns `Habit`, `Category`, `Achievement`.

## Domain services

- **`StreakCalculator`** — given a habit and its completions, returns the current streak.
- **`AchievementEvaluator`** — after a completion is added, decides which achievements to unlock.
- **`DailyReminderSelector`** — returns users who should receive an email today.

## Use cases (application layer)

- `RegisterUser`
- `LoginUser`
- `CreateHabit`
- `EditHabit`
- `ArchiveHabit`
- `MarkHabitDoneToday`
- `GetTodayDashboard`
- `GetWeeklyGrid`
- `GetHabitStats`
- `EnqueueDailyReminders` (cron-triggered)
- `SendReminderEmail` (worker)

## Notes for Laravel devs

- **Aggregate root** ↑ like an Eloquent model that owns its child rows; you mutate children only through methods on the parent.
- **Use case** ↑ a single application service method, like an action class (`app/Actions/Habits/MarkHabitDoneToday.php`).
- **Domain service** ↑ stateless calculator that holds business logic too rich for a single entity.
