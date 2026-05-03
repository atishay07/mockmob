-- Paid entitlement hardening:
-- - premium_until records the paid-through access window.
-- - access_until mirrors the entitlement window on payment rows.
-- This prevents immediate access loss when a paid subscription is cancelled
-- after a successful charge, while still allowing entitlement expiry.

alter table public.users
  add column if not exists premium_until timestamptz,
  add column if not exists razorpay_subscription_id text;

alter table public.payments
  add column if not exists access_until timestamptz;

create index if not exists users_premium_until_idx
  on public.users (premium_until)
  where premium_until is not null;

create index if not exists users_razorpay_subscription_id_idx
  on public.users (razorpay_subscription_id)
  where razorpay_subscription_id is not null;

create index if not exists payments_access_until_idx
  on public.payments (access_until)
  where access_until is not null;

with paid_periods as (
  select
    p.user_id,
    max(p.subscription_id) filter (where p.subscription_id is not null) as subscription_id,
    max(
      coalesce(
        p.access_until,
        case
          when (p.raw_subscription->>'current_end') ~ '^[0-9]+$'
            then to_timestamp((p.raw_subscription->>'current_end')::double precision)
          else null
        end,
        p.created_at + interval '32 days'
      )
    ) as paid_until
  from public.payments p
  where p.payment_id is not null
    and coalesce(p.amount_paid, 0) > 0
  group by p.user_id
)
update public.users u
set
  premium_until = greatest(coalesce(u.premium_until, '-infinity'::timestamptz), pp.paid_until),
  razorpay_subscription_id = coalesce(u.razorpay_subscription_id, pp.subscription_id),
  is_premium = case
    when pp.paid_until > now() then true
    else u.is_premium
  end
from paid_periods pp
where u.id = pp.user_id
  and pp.paid_until is not null;
