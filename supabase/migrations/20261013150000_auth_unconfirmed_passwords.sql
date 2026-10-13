-- Account takeover guard (auth review H2, 13 Oct 2026).
--
-- MockMob has no password sign-up: accounts are made by the emailed code or by Google, and a
-- password is set only after sign-in. Anyone can still call Supabase's public sign-up endpoint
-- with a student's email and a password of their choosing. That leaves an unconfirmed account
-- carrying the attacker's password, and when the real student later confirms the email with
-- the code (or Google), the attacker's password would keep working.
--
-- 1. public.auth_clear_unconfirmed_password(email): service-role only. /api/auth/email-login
--    calls it before minting a code, so an unconfirmed account loses any password.
-- 2. A trigger on auth.users that removes the password in the same update that first confirms
--    the email. This closes the window between sending the code and the student entering it.
--
-- Neither touches a confirmed account. Owner step: Authentication > Sign In / Providers >
-- Email > "Confirm email" ON (with it off, a direct sign-up is confirmed at once and gets a
-- session; src/lib/auth.ts also refuses identities without email_confirmed_at).
-- Not applied to any remote database by this change. Apply on staging first.

create or replace function public.auth_clear_unconfirmed_password(p_email text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleared integer;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return 0;
  end if;
  update auth.users
     set encrypted_password = ''
   where lower(email) = lower(trim(p_email))
     and email_confirmed_at is null
     and coalesce(encrypted_password, '') <> '';
  get diagnostics cleared = row_count;
  return cleared;
end;
$$;

revoke all on function public.auth_clear_unconfirmed_password(text) from public, anon, authenticated;
grant execute on function public.auth_clear_unconfirmed_password(text) to service_role;

create or replace function public.auth_drop_password_set_before_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null
     and new.email_confirmed_at is not null
     and coalesce(old.encrypted_password, '') <> '' then
    new.encrypted_password := '';
  end if;
  return new;
end;
$$;

revoke all on function public.auth_drop_password_set_before_confirmation() from public, anon, authenticated;

drop trigger if exists mm_drop_password_set_before_confirmation on auth.users;
create trigger mm_drop_password_set_before_confirmation
  before update of email_confirmed_at on auth.users
  for each row
  execute function public.auth_drop_password_set_before_confirmation();
