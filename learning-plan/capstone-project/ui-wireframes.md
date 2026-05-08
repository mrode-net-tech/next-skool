# Habit Tracker — UI wireframes (text)

Text descriptions of each screen. Build the simplest version first, polish later.

## 1. Landing page (public)
- Header with logo and **Login / Sign up** buttons.
- Hero: "Build better habits, one day at a time."
- Three feature cards: Track, Streaks, Reminders.
- Footer.

## 2. Sign up
- Email, password, display name.
- Submit → redirected to dashboard.
- Inline errors via Zod.

## 3. Login
- Email, password.
- Link "Don't have an account? Sign up".

## 4. Dashboard (today)
- Sidebar: Today, Habits, Stats, Achievements, Settings, Logout.
- Top: greeting ("Good morning, Marcin") + today's date.
- Today's habit list:
  - Each row: icon, name, color stripe.
  - Right side: "Done" button (becomes a green check after click).
  - Streak badge ("7 🔥").
- Empty state: "Create your first habit" CTA.

## 5. Habits list
- Filter by category, archived toggle.
- Each habit: name, frequency, streak, today status.
- Action menu: edit, archive, delete.

## 6. Habit detail
- Header with name, color, icon, frequency.
- Weekly grid (last 12 weeks): green = done, gray = missed, dim = future.
- Stats: current streak, longest streak, completion rate.
- Edit / archive buttons.

## 7. Create / edit habit (modal or page)
- Name (required).
- Frequency: Daily / Weekly (with target per week).
- Color picker.
- Icon picker.
- Category select (or create new).
- Cover image upload (Phase 6).

## 8. Statistics
- Total habits, total completions, average streak.
- Bar chart of completions per day (last 30 days).
- Pie chart by category.

## 9. Achievements
- Grid of badges, locked badges grayed out.
- Click → modal with description and unlock date.

## 10. Settings
- Change display name.
- Change password.
- Email notifications toggle.
- Delete account (with confirmation).
