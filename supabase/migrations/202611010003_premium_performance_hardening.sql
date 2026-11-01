-- Performance hardening for Premium request and subscription lookups.
create index if not exists tc_premium_payment_requests_reviewed_by_idx
  on public.tc_premium_payment_requests(reviewed_by)
  where reviewed_by is not null;

create index if not exists tc_premium_subscriptions_payment_request_id_idx
  on public.tc_premium_subscriptions(payment_request_id)
  where payment_request_id is not null;

drop policy if exists "Customers can submit own premium payment requests" on public.tc_premium_payment_requests;
create policy "Customers can submit own premium payment requests"
  on public.tc_premium_payment_requests for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers can view own premium payment requests" on public.tc_premium_payment_requests;
create policy "Customers can view own premium payment requests"
  on public.tc_premium_payment_requests for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Customers can view own premium subscription" on public.tc_premium_subscriptions;
create policy "Customers can view own premium subscription"
  on public.tc_premium_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

-- These indexes support Admin review joins and subscription request lookups.
