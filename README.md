# ਮੌਜ | MAUJ

**My Att Uttam Journey** — a habit-tracking app for students, with an admin dashboard for coaches.

Students log daily habits (yes/no or duration). Admins invite students, define habits, and review progress over a chosen date range.

This repo is a personal copy of the original MAUJ project, with extra product features described below. The original remote is kept as `upstream` and is not overwritten by pushes here.

## Who uses it

**Students** sign in, mark today’s habits, and see history. Completing every habit in a day (or seven days in a row) shows a Punjabi congratulations message with confetti.

**Admins** are not self-serve. Only emails you add to `admin_allowlist` in Supabase can register as admins. Everyone else needs a pending invitation to sign up as a student.

## Stack

- Expo SDK 54 (React Native, works on Android, iOS via Expo Go, and web)
- Supabase (Auth, Postgres, Row Level Security, Realtime)

## Run locally

1. Copy `.env.example` to `.env` and fill in:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

2. In the [Supabase SQL Editor](https://supabase.com/dashboard), run `supabase/schema.sql` once (new project), or apply the incremental SQL from that file if the original schema is already live.

3. Turn **Confirm email** off under Authentication → Providers → Email, unless you add a confirmation flow.

4. Insert admin emails:

   ```sql
   insert into public.admin_allowlist (email, note) values
     ('you@example.com', 'admin')
   on conflict (email) do nothing;
   ```

5. Install and start:

   ```powershell
   npm install
   npx expo start
   ```

`.env` is gitignored. Never commit the anon key into a public gist; the app key is the public anon key, and RLS is what protects the data.

## Android APK

This copy is linked to the **mauj** Expo account (not the original owner’s EAS project).

```powershell
eas login
eas build -p android --profile preview
```

Download the APK from the EAS build page and share it. Recipients may need to allow “Install unknown apps.”

## What changed in this copy

Relative to the original `punjabskillsbank/mauj` app:

**Auth and admin access**

- Removed the public Admin/Student toggle on Sign Up. Role is decided on the server from `admin_allowlist` vs a pending invitation.
- Sign Up collects phone number and a free-text “how did you hear about Mauj?” field, stored on `profiles`.
- Admins can edit pending invitation emails and delete invitations or registered student accounts.

**Habits**

- Each habit has a colour (crucial, secondary, etc.) shown as the habit title colour for students and admins.
- Habits can be reordered with up/down arrows (`sort_order`).
- Habits can be edited (title, type, colour). Soft-remove still hides them; Delete permanently removes the habit and its logs.

**Admin analytics**

- Date filter: this month, last month, last 3 / 6 months, all time, or custom months.
- Per-student overall pies: days with at least one habit vs days with every habit done.
- Habit comparison chart is tappable and explained in plain language.
- Per-habit screen: calendar heatmap, week-by-week and weekday charts, last done, vs previous period. Streak boxes were removed from the admin views.

**Student experience**

- Branding **ਮੌਜ | MAUJ** on sign-in, sign-up, student, and admin screens.
- History shows today’s progress (“5 of 8 habits done”) instead of vague Completion / Days Active / Day Streak.
- Congratulations popups: daily all-habits complete, and a rolling 7-day full completion.

**Branding assets**

- Custom app icon.

## Database extras (already in `supabase/schema.sql`)

If you already ran an older schema, you still need to apply the later pieces in the SQL Editor: `admin_allowlist`, `profiles.phone` / `referral_source`, `tasks.color` / `sort_order`, updated `handle_new_user()`, `check_pending_invitation()`, and `admin_delete_student()`.
