-- Undo for supabase/migrations/20261018190000_play_purchases.sql. NOT a migration: it lives outside supabase/migrations on
-- purpose, so the Supabase CLI never applies it by itself.
-- Order: switch PLAY_BILLING_ENABLED off first (every Play route answers 404), then run this.
-- The two functions are dropped. The table is dropped only while it is empty: once a real purchase is recorded, the row is
-- the only link between a Google order and what the student was given, so it is kept (a NOTICE says so) and the operator
-- decides about it by hand. Nothing here touches users, payments or the AI credit tables, so what was already granted stays.
-- The value 'purchase' added to the credit_transaction_type enum stays: Postgres cannot drop an enum value, and an unused value is harmless.

drop function if exists public.mm_play_grant_purchase(text, text, text, text, text, integer, timestamptz, jsonb);
drop function if exists public.mm_play_revoke_purchase(text, text, text, jsonb);

do $$
begin
  if to_regclass('public.play_purchases') is null then
    return;
  end if;
  if exists (select 1 from public.play_purchases) then
    raise notice 'play_purchases still holds rows: kept. Export it, then drop table public.play_purchases by hand if it is really wanted gone.';
  else
    drop table public.play_purchases;
  end if;
end;
$$;
