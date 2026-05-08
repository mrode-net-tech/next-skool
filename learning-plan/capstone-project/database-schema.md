# Habit Tracker — database schema

Draft Prisma schema. Refine as you build.

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String       @id @default(uuid())
  email        String       @unique
  passwordHash String
  displayName  String
  createdAt    DateTime     @default(now())

  habits       Habit[]
  categories   Category[]
  achievements Achievement[]
}

model Category {
  id     String  @id @default(uuid())
  userId String
  name   String
  color  String  // hex
  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  habits Habit[]

  @@unique([userId, name])
}

model Habit {
  id            String    @id @default(uuid())
  userId        String
  name          String
  frequency     String    // "DAILY" | "WEEKLY"
  targetPerWeek Int       @default(7)
  color         String    // hex
  icon          String
  categoryId    String?
  coverImageUrl String?
  archivedAt    DateTime?
  createdAt     DateTime  @default(now())

  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  category    Category?         @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  completions HabitCompletion[]

  @@index([userId])
  @@index([archivedAt])
}

model HabitCompletion {
  id        String   @id @default(uuid())
  habitId   String
  date      DateTime @db.Date          // one row per habit per day
  createdAt DateTime @default(now())

  habit Habit @relation(fields: [habitId], references: [id], onDelete: Cascade)

  @@unique([habitId, date])
  @@index([date])
}

model Achievement {
  id         String   @id @default(uuid())
  userId     String
  code       String   // e.g. "STREAK_7"
  unlockedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, code])
}
```

## Notes

- `HabitCompletion.date` is a **date-only** field; we deduplicate per day with `@@unique([habitId, date])`.
- Use `onDelete: Cascade` so deleting a user wipes their data.
- Add an `auditLog` table later if you want to track changes.
