-- Prevent the same payment reference from being submitted more than once.
create unique index if not exists tc_premium_payment_requests_utr_unique_idx
  on public.tc_premium_payment_requests(utr);
