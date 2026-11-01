-- Premium membership and payment request tables.
-- Apply this migration in the Supabase SQL Editor.
create table if not exists public.tc_premium_payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_days integer not null check (plan_days in (6, 15, 30, 60)),
  amount integer not null check (
    (plan_days = 6 and amount = 129) or
    (plan_days = 15 and amount = 249) or
    (plan_days = 30 and amount = 469) or
    (plan_days = 60 and amount = 839)
  ),
  utr text not null check (utr ~ '^[0-9]{12}$'),
  payment_app text not null check (payment_app in ('Paytm', 'PhonePe', 'Google Pay')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists tc_premium_payment_requests_user_created_idx
  on public.tc_premium_payment_requests(user_id, created_at desc);

alter table public.tc_premium_payment_requests enable row level security;

drop policy if exists "Customers can submit own premium payment requests" on public.tc_premium_payment_requests;
create policy "Customers can submit own premium payment requests"
  on public.tc_premium_payment_requests for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Customers can view own premium payment requests" on public.tc_premium_payment_requests;
create policy "Customers can view own premium payment requests"
  on public.tc_premium_payment_requests for select to authenticated
  using (auth.uid() = user_id);

revoke update, delete on public.tc_premium_payment_requests from anon, authenticated;
grant select, insert on public.tc_premium_payment_requests to authenticated;

create table if not exists public.tc_premium_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_days integer not null check (plan_days in (6, 15, 30, 60)),
  amount integer not null check (
    (plan_days = 6 and amount = 129) or
    (plan_days = 15 and amount = 249) or
    (plan_days = 30 and amount = 469) or
    (plan_days = 60 and amount = 839)
  ),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  payment_request_id uuid references public.tc_premium_payment_requests(id),
  created_at timestamptz not null default now(),
  constraint tc_premium_subscription_valid_window check (expires_at > starts_at)
);

create index if not exists tc_premium_subscriptions_user_expiry_idx
  on public.tc_premium_subscriptions(user_id, expires_at desc);

alter table public.tc_premium_subscriptions enable row level security;

drop policy if exists "Customers can view own premium subscription" on public.tc_premium_subscriptions;
create policy "Customers can view own premium subscription"
  on public.tc_premium_subscriptions for select to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.tc_premium_subscriptions from anon, authenticated;
grant select on public.tc_premium_subscriptions to authenticated;

-- Only a trusted server using the Supabase service role may approve requests
-- and create/update subscription rows. Never put the service-role key in the app.
