-- Turbo Charge has exactly one administrator account by design.
create unique index if not exists tc_admins_singleton_idx
  on public.tc_admins ((true));
