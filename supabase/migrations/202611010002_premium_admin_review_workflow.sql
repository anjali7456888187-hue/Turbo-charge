alter table public.tc_premium_payment_requests
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

create or replace function public.tc_admin_review_premium_payment(
  p_request_id uuid,
  p_decision text,
  p_admin_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.tc_premium_payment_requests%rowtype;
  v_start timestamptz;
  v_expiry timestamptz;
  v_subscription_id uuid;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'Invalid decision';
  end if;

  select * into v_request
  from public.tc_premium_payment_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Payment request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'Payment request has already been reviewed';
  end if;

  if p_decision = 'reject' then
    update public.tc_premium_payment_requests
      set status = 'rejected', reviewed_at = now(), reviewed_by = p_admin_id
      where id = p_request_id;
    return jsonb_build_object('status', 'rejected', 'request_id', p_request_id);
  end if;

  select greatest(now(), coalesce(max(expires_at), now()))
    into v_start
    from public.tc_premium_subscriptions
    where user_id = v_request.user_id
      and status = 'active'
      and expires_at > now();

  v_expiry := v_start + make_interval(days => v_request.plan_days);

  insert into public.tc_premium_subscriptions
    (user_id, plan_days, amount, starts_at, expires_at, status, payment_request_id)
  values
    (v_request.user_id, v_request.plan_days, v_request.amount, v_start, v_expiry, 'active', v_request.id)
  returning id into v_subscription_id;

  update public.tc_premium_payment_requests
    set status = 'approved', reviewed_at = now(), reviewed_by = p_admin_id
    where id = p_request_id;

  return jsonb_build_object(
    'status', 'approved',
    'request_id', p_request_id,
    'subscription_id', v_subscription_id,
    'starts_at', v_start,
    'expires_at', v_expiry
  );
end;
$$;

revoke all on function public.tc_admin_review_premium_payment(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.tc_admin_review_premium_payment(uuid, text, uuid) to service_role;
