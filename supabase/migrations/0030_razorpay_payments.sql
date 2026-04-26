alter table public.users
  add column if not exists is_premium boolean not null default false;

create table if not exists public.payments (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  order_id text unique,
  subscription_id text unique,
  payment_id text unique,
  plan_id text not null,
  razorpay_plan_id text,
  amount integer not null check (amount > 0),
  currency text not null default 'INR',
  status text not null default 'created'
    check (status in ('created', 'authenticated', 'active', 'attempted', 'captured', 'failed', 'cancelled', 'completed', 'expired')),
  raw_order jsonb not null default '{}'::jsonb,
  raw_subscription jsonb not null default '{}'::jsonb,
  raw_payment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments
  alter column order_id drop not null,
  add column if not exists subscription_id text unique,
  add column if not exists razorpay_plan_id text,
  add column if not exists raw_subscription jsonb not null default '{}'::jsonb;

alter table public.payments
  drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (status in ('created', 'authenticated', 'active', 'attempted', 'captured', 'failed', 'cancelled', 'completed', 'expired'));

create index if not exists payments_user_created_idx
  on public.payments(user_id, created_at desc);

create index if not exists payments_payment_id_idx
  on public.payments(payment_id);

create index if not exists payments_subscription_id_idx
  on public.payments(subscription_id);

alter table public.payments enable row level security;

revoke all on public.payments from anon;
revoke all on public.payments from authenticated;
grant select on public.payments to authenticated;

create policy "Users can read their own payments"
  on public.payments
  for select
  to authenticated
  using (user_id = auth.uid()::text);
