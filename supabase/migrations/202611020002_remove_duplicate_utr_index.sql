-- Keep the original UTR unique index and remove the duplicate index.
drop index if exists public.tc_premium_payment_requests_utr_unique;
