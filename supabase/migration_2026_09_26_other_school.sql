-- Run this once in the Supabase SQL Editor after the earlier migrations.
-- Lets a student pick Others on School and type a name that is not on the list.

alter table public.profiles
  add column if not exists other_school text;

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
  v_other_school text;
  v_referrer_raw text;
  v_referrer_id uuid;
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
  v_other_school := nullif(trim(new.raw_user_meta_data ->> 'other_school'), '');
  v_referrer_raw := nullif(trim(coalesce(new.raw_user_meta_data ->> 'referrer_id', '')), '');
  v_referrer_id := null;
  if v_referrer_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_referrer_id := v_referrer_raw::uuid;
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

    if v_school_id is not null and exists (select 1 from public.schools where id = v_school_id) then
      v_other_school := null;
    elsif v_other_school is not null then
      v_school_id := null;
    else
      raise exception 'Choose a valid school before registering.';
    end if;

    if v_referrer_id is not null and exists (select 1 from public.referrers where id = v_referrer_id) then
      select name into v_referral_source from public.referrers where id = v_referrer_id;
    elsif v_referral_source is null then
      raise exception 'Choose who referred you.';
    else
      v_referrer_id := null;
    end if;
  end if;

  insert into public.profiles (
    id, first_name, last_name, email, phone, school_id, other_school, referrer_id, referral_source, role
  )
  values (
    new.id,
    v_first_name,
    v_last_name,
    new.email,
    v_phone,
    case when v_role = 'student' then v_school_id else null end,
    case when v_role = 'student' then v_other_school else null end,
    case when v_role = 'student' then v_referrer_id else null end,
    case when v_role = 'student' then v_referral_source else null end,
    v_role
  );

  return new;
end;
$$;
