-- =============================================================================
-- Mauj — Database Schema
-- Run this entire file once in the Supabase Dashboard SQL Editor.
-- It is safe to read top-to-bottom: extensions -> tables -> indexes ->
-- functions/triggers -> Row Level Security policies -> seed data -> realtime.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- gen_random_uuid() lives in pgcrypto. Supabase usually has this enabled
-- already, but "if not exists" makes this script safe to re-run.
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. TABLES
-- -----------------------------------------------------------------------------

-- One row per user (both admins and students). The id matches auth.users.id
-- exactly, so this table is a 1:1 extension of Supabase's built-in auth table.
-- phone and referral_source are collected on the Sign Up screen and are
-- nullable on purpose: admins created straight from the Supabase dashboard
-- won't have them, and neither will anyone who registered before we started
-- asking.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text,
  referral_source text,
  role text not null check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

-- An admin creates one of these per student email before that student
-- can register. status flips from 'pending' to 'registered' automatically
-- the moment that student successfully signs up (see the trigger below).
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'registered')),
  created_at timestamptz not null default now()
);

-- The only way to become an admin. You add rows here yourself (SQL Editor or
-- the Table Editor); when someone signs up with a listed email, the trigger
-- below gives them the admin role. RLS is enabled with ZERO policies, so no
-- client — logged out or logged in, admin or not — can read or write this
-- table. Only the service role and the security definer functions see it.
create table public.admin_allowlist (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);

-- The catalog of habits/tasks an admin wants students tracking.
-- is_active controls whether it currently shows up on students' daily log screen.
-- color is the habit's colour code (red for crucial, blue for secondary, and
-- so on), picked by the admin and shown to students too. sort_order is the
-- display position the admin sets with the up/down arrows in the Habits tab;
-- every screen that lists habits orders by it, with created_at as the
-- tie-breaker so equal values still come out in a stable order.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null check (type in ('boolean', 'duration')),
  color text not null default '#4f46e5',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row per (student, task, date). completed is used for boolean tasks,
-- duration_minutes for duration tasks. The unique constraint means a
-- student can only have one log entry per task per day — your app screen
-- should "upsert" (insert-or-update) against this, not blindly insert.
create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  date date not null,
  completed boolean not null default false,
  duration_minutes int,
  created_at timestamptz not null default now(),
  unique (student_id, task_id, date)
);

-- -----------------------------------------------------------------------------
-- 2. INDEXES
-- Speed up the queries our screens will actually run.
-- -----------------------------------------------------------------------------
create index idx_daily_logs_student_date on public.daily_logs (student_id, date);
create index idx_daily_logs_task on public.daily_logs (task_id);
create index idx_invitations_email on public.invitations (email);
create index idx_tasks_active on public.tasks (is_active);

-- -----------------------------------------------------------------------------
-- 3. HELPER FUNCTION: is_admin()
-- Used inside RLS policies below. It's marked SECURITY DEFINER so it reads
-- the profiles table with elevated privileges, bypassing RLS. This is
-- required to avoid "infinite recursion" errors that happen if a profiles
-- RLS policy tried to query the profiles table directly.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. SIGNUP TRIGGER: public.handle_new_user()
-- Fires automatically every time a new row is inserted into Supabase's
-- built-in auth.users table (i.e. every time someone calls supabase.auth.signUp()).
--
-- - Reads first_name/last_name that our app sends as "metadata" during signUp.
-- - Decides the role here, from server-side tables only. Anything the client
--   put in raw_user_meta_data.role is ignored, so someone holding the anon
--   key can't call signUp() with role='admin' and promote themselves.
-- - Email in admin_allowlist -> admin. Otherwise -> student, which requires a
--   matching PENDING invitation to exist. If none is found, it RAISES AN
--   EXCEPTION, which aborts the entire transaction — meaning the auth.users
--   row itself is rolled back and signUp() fails with an error your app can
--   display. This is what makes "strict registration" actually enforced on
--   the server, not just the UI.
-- - Either way, creates the matching row in public.profiles.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_first_name text;
  v_last_name text;
  v_invitation_id uuid;
  v_email text;
  v_phone text;
  v_referral_source text;
begin
  v_email := lower(trim(new.email));
  v_first_name := new.raw_user_meta_data ->> 'first_name';
  v_last_name := new.raw_user_meta_data ->> 'last_name';
  v_phone := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
  v_referral_source := nullif(trim(new.raw_user_meta_data ->> 'referral_source'), '');

  if exists (select 1 from public.admin_allowlist where lower(email) = v_email) then
    v_role := 'admin';
  else
    v_role := 'student';

    select id into v_invitation_id
    from public.invitations
    where lower(email) = v_email
      and status = 'pending'
    limit 1;

    if v_invitation_id is null then
      raise exception
        'No pending invitation found for %. Ask your admin to invite this email first.',
        new.email;
    end if;

    update public.invitations
    set status = 'registered'
    where id = v_invitation_id;
  end if;

  insert into public.profiles (id, first_name, last_name, email, phone, referral_source, role)
  values (new.id, v_first_name, v_last_name, new.email, v_phone, v_referral_source, v_role);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- RLS is off by default in Postgres. Turning it on for a table means:
-- "deny everything unless a policy explicitly allows it." Each policy below
-- targets one operation (select/insert/update/delete) for one role, so it's
-- easy to reason about exactly who can do what.
-- -----------------------------------------------------------------------------

-- ---- profiles ----
alter table public.profiles enable row level security;

create policy "Users can view own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "Admins can view all profiles"
on public.profiles for select
to authenticated
using (public.is_admin());

create policy "Admins can update all profiles"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Note: there's intentionally no "insert" policy for regular users — profile
-- rows are only ever created by the handle_new_user() trigger, which runs
-- as SECURITY DEFINER and bypasses RLS entirely.

-- ---- admin_allowlist ----
-- Intentionally no policies at all: RLS on + no policy = nobody gets in
-- through the API. Manage its rows from the Supabase dashboard.
alter table public.admin_allowlist enable row level security;

-- ---- invitations ----
alter table public.invitations enable row level security;

create policy "Admins can view all invitations"
on public.invitations for select
to authenticated
using (public.is_admin());

create policy "Students can view own invitation"
on public.invitations for select
to authenticated
using (email = (select email from public.profiles where id = auth.uid()));

create policy "Admins can create invitations"
on public.invitations for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update invitations"
on public.invitations for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete invitations"
on public.invitations for delete
to authenticated
using (public.is_admin());

-- ---- tasks ----
alter table public.tasks enable row level security;

create policy "Authenticated users can view active tasks"
on public.tasks for select
to authenticated
using (is_active = true);

create policy "Admins can view all tasks"
on public.tasks for select
to authenticated
using (public.is_admin());

create policy "Admins can create tasks"
on public.tasks for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update tasks"
on public.tasks for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete tasks"
on public.tasks for delete
to authenticated
using (public.is_admin());

-- ---- daily_logs ----
alter table public.daily_logs enable row level security;

create policy "Students can view own logs"
on public.daily_logs for select
to authenticated
using (student_id = auth.uid());

create policy "Admins can view all logs"
on public.daily_logs for select
to authenticated
using (public.is_admin());

create policy "Students can insert own logs"
on public.daily_logs for insert
to authenticated
with check (student_id = auth.uid());

create policy "Students can update own logs"
on public.daily_logs for update
to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "Admins can modify all logs"
on public.daily_logs for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 6. SEED DATA
-- A handful of starter habits so the app isn't empty on first run. Feel free
-- to add/remove more later from the Admin dashboard's Habit Management tab —
-- that's exactly what it's for.
-- -----------------------------------------------------------------------------
insert into public.tasks (title, type, color, sort_order, is_active) values
  ('Drink 8 glasses of water', 'boolean',  '#dc2626', 0, true),
  ('Read for 20 minutes',      'duration', '#2563eb', 1, true),
  ('Exercise',                 'duration', '#dc2626', 2, true),
  ('Meditate',                 'boolean',  '#16a34a', 3, true),
  ('Sleep 8 hours',            'boolean',  '#2563eb', 4, true);

-- -----------------------------------------------------------------------------
-- 7. REALTIME
-- Adds these tables to Supabase's realtime publication so the Admin's
-- Real-time Dashboard tab can subscribe to postgres_changes and get live
-- updates (new student registrations, new completed logs) over WebSockets.
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.daily_logs;
alter publication supabase_realtime add table public.invitations;

-- -----------------------------------------------------------------------------
-- 8. PRE-SIGNUP INVITATION CHECK (anon-callable)
-- Supabase Auth wraps ANY error thrown by handle_new_user() in a generic
-- "Database error saving new user" message on the client, for security —
-- it never leaks our raw RAISE EXCEPTION text to the app. That trigger is
-- still the real enforcement (a client can't bypass it), but it makes for
-- a bad error message. This function lets the Sign Up screen check
-- *before* attempting signup, so it can show a friendly message instead.
--
-- It's callable by the "anon" role (logged-out users) since that's exactly
-- who's filling out the Sign Up form. It only returns a boolean — never the
-- underlying rows — so it can't be used to enumerate every invited email,
-- and it doesn't reveal which of the two lists matched.
-- -----------------------------------------------------------------------------
create or replace function public.check_pending_invitation(check_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.invitations
    where lower(email) = lower(trim(check_email)) and status = 'pending'
  ) or exists (
    select 1 from public.admin_allowlist
    where lower(email) = lower(trim(check_email))
  );
$$;

grant execute on function public.check_pending_invitation(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 9. ADMIN: DELETE A REGISTERED STUDENT
-- The Students tab lets an admin remove an invitation outright, but once a
-- student has actually registered, deleting the invitation row alone would
-- leave their login working. Their auth.users row lives in a schema the
-- client can't touch, so this SECURITY DEFINER function does it server-side.
-- Deleting from auth.users cascades to profiles, which cascades to daily_logs.
--
-- It re-checks is_admin() itself: SECURITY DEFINER bypasses RLS, so without
-- that guard any logged-in student could call it and delete their classmates.
-- Admins are deliberately not deletable here — remove them from
-- admin_allowlist and delete them from the dashboard instead.
-- -----------------------------------------------------------------------------
create or replace function public.admin_delete_student(target_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can remove students.';
  end if;

  select email into v_email
  from public.profiles
  where id = target_student_id and role = 'student';

  if v_email is null then
    raise exception 'No student found with that id.';
  end if;

  delete from public.invitations where lower(email) = lower(v_email);
  delete from auth.users where id = target_student_id;
end;
$$;

revoke execute on function public.admin_delete_student(uuid) from anon;
grant execute on function public.admin_delete_student(uuid) to authenticated;
