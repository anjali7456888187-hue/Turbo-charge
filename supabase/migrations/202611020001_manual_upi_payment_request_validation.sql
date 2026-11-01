-- Accept the app's manual UPI submission label and prevent UTR reuse.
alter table public.tc_premium_payment_requests
  drop constraint if exists tc_premium_payment_requests_payment_app_check;
alter table public.tc_premium_payment_requests
  add constraint tc_premium_payment_requests_payment_app_check
  check (payment_app in ('Paytm', 'PhonePe', 'Google Pay', 'Manual UPI'));

create unique index if not exists tc_premium_payment_requests_utr_unique
  on public.tc_premium_payment_requests (utr);
