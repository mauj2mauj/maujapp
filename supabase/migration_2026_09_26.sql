-- Run this once in the Supabase SQL Editor on the database that is already
-- live. Safe to re-run. Fresh installs should use schema.sql instead.
--
-- Adds schools (signup dropdown + admin filter), a habit description, and
-- teaches signup to store the chosen school.

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists schools_name_lower_idx
  on public.schools (lower(btrim(name)));

alter table public.profiles
  add column if not exists school_id uuid references public.schools (id) on delete set null;

create index if not exists profiles_school_id_idx on public.profiles (school_id);

alter table public.tasks
  add column if not exists description text;

alter table public.schools enable row level security;

drop policy if exists "Anyone can view schools" on public.schools;
create policy "Anyone can view schools"
on public.schools for select
to anon, authenticated
using (true);

drop policy if exists "Admins can create schools" on public.schools;
create policy "Admins can create schools"
on public.schools for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update schools" on public.schools;
create policy "Admins can update schools"
on public.schools for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete schools" on public.schools;
create policy "Admins can delete schools"
on public.schools for delete
to authenticated
using (public.is_admin());

grant select on public.schools to anon, authenticated;
grant insert, update, delete on public.schools to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'schools'
  ) then
    alter publication supabase_realtime add table public.schools;
  end if;
end $$;

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
  v_school_raw text;
  v_school_id uuid;
begin
  v_email := lower(trim(new.email));
  v_first_name := new.raw_user_meta_data ->> 'first_name';
  v_last_name := new.raw_user_meta_data ->> 'last_name';
  v_phone := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
  v_referral_source := nullif(trim(new.raw_user_meta_data ->> 'referral_source'), '');
  v_school_raw := nullif(trim(coalesce(new.raw_user_meta_data ->> 'school_id', '')), '');
  v_school_id := null;
  if v_school_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_school_id := v_school_raw::uuid;
  end if;

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

    if v_school_id is null or not exists (select 1 from public.schools where id = v_school_id) then
      raise exception 'Choose a valid school before registering.';
    end if;
  end if;

  insert into public.profiles (id, first_name, last_name, email, phone, school_id, referral_source, role)
  values (
    new.id,
    v_first_name,
    v_last_name,
    new.email,
    v_phone,
    case when v_role = 'student' then v_school_id else null end,
    v_referral_source,
    v_role
  );

  return new;
end;
$$;
