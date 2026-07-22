alter table reservations add column if not exists cancelled_at timestamptz;
alter table reservations add column if not exists cancellation_reason text;

alter table access_grants add column if not exists status text not null default 'active' check (status in ('active', 'revoked', 'expired'));
alter table access_grants add column if not exists revoked_at timestamptz;
alter table access_grants add column if not exists revocation_reason text;

create or replace function fairway_member_state(p_member_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'person', jsonb_build_object('id', pe.id, 'email', pe.email, 'displayName', pe.display_name),
    'profile', jsonb_build_object('id', mp.id, 'personId', mp.person_id, 'homeLocationId', mp.home_location_id, 'memberNumber', mp.member_number),
    'membershipPlan', jsonb_build_object('code', plan.code, 'name', plan.name, 'monthlyCredits', plan.monthly_credits, 'bookingWindowDays', plan.booking_window_days, 'maxActiveFutureReservations', plan.max_active_future_reservations, 'playNowEnabled', plan.play_now_enabled, 'guestAllowance', plan.guest_allowance),
    'availableCredits', fairway_available_credits(mp.id),
    'location', jsonb_build_object('id', loc.id, 'name', loc.name, 'timezone', loc.timezone, 'suiteCount', loc.suite_count, 'minimumSessionMinutes', loc.minimum_session_minutes, 'bookingIncrementMinutes', loc.booking_increment_minutes, 'turnoverBufferMinutes', loc.turnover_buffer_minutes, 'accessBeforeMinutes', loc.access_before_minutes, 'accessAfterMinutes', loc.access_after_minutes, 'playNowEnabled', loc.play_now_enabled),
    'suites', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'locationId', s.location_id, 'name', s.name, 'status', s.status) order by s.name) from suites s where s.location_id = loc.id), '[]'::jsonb),
    'reservations', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'locationId', r.location_id, 'suiteId', r.suite_id, 'memberProfileId', r.member_profile_id, 'bookingMode', r.booking_mode, 'status', r.status, 'startAt', r.start_at, 'endAt', r.end_at, 'creditHoldEntryId', r.credit_hold_entry_id, 'idempotencyKey', r.idempotency_key, 'createdAt', r.created_at, 'cancelledAt', r.cancelled_at, 'cancellationReason', r.cancellation_reason) order by r.start_at) from reservations r where r.location_id = loc.id and r.status in ('held', 'confirmed', 'checked_in')), '[]'::jsonb),
    'memberReservations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'locationId', r.location_id,
        'locationName', l.name,
        'suiteId', r.suite_id,
        'suiteName', s.name,
        'memberProfileId', r.member_profile_id,
        'bookingMode', r.booking_mode,
        'status', r.status,
        'startAt', r.start_at,
        'endAt', r.end_at,
        'creditHoldEntryId', r.credit_hold_entry_id,
        'idempotencyKey', r.idempotency_key,
        'createdAt', r.created_at,
        'cancelledAt', r.cancelled_at,
        'cancellationReason', r.cancellation_reason,
        'creditsCommitted', coalesce(commit_entry.amount, 0),
        'canCancel', (r.status = 'confirmed' and r.start_at > now() and sess.id is null),
        'sessionStartedAt', sess.started_at,
        'accessGrant', case when ag.id is null then null else jsonb_build_object('id', ag.id, 'status', ag.status, 'startsAt', ag.starts_at, 'expiresAt', ag.expires_at, 'revokedAt', ag.revoked_at) end,
        'accessWindowStatus', case
          when ag.id is null then 'none'
          when ag.status <> 'active' then ag.status
          when now() < ag.starts_at then 'scheduled'
          when now() >= ag.expires_at then 'expired'
          else 'active'
        end
      ) order by r.start_at desc)
      from reservations r
      join locations l on l.id = r.location_id
      join suites s on s.id = r.suite_id
      left join credit_ledger_entries commit_entry on commit_entry.related_entry_id = r.credit_hold_entry_id and commit_entry.entry_type = 'commit'
      left join access_grants ag on ag.reservation_id = r.id
      left join sessions sess on sess.reservation_id = r.id
      where r.member_profile_id = mp.id
        and r.status in ('confirmed', 'checked_in', 'cancelled', 'completed')
      limit 30
    ), '[]'::jsonb),
    'auditEvents', coalesce((select jsonb_agg(jsonb_build_object('id', audit.id, 'type', audit.type, 'actorId', audit.actor_id, 'resourceId', audit.resource_id, 'reason', audit.reason, 'createdAt', audit.created_at) order by audit.created_at desc) from (select * from audit_events ae where ae.actor_id = mp.id::text order by ae.created_at desc limit 30) audit), '[]'::jsonb)
  )
  from member_profiles mp
  join people pe on pe.id = mp.person_id
  join locations loc on loc.id = mp.home_location_id
  join memberships mem on mem.member_profile_id = mp.id and mem.status = 'active' and mem.ended_at is null
  join membership_plans plan on plan.id = mem.membership_plan_id
  where mp.id = p_member_profile_id;
$$;

create or replace function fairway_record_access_grant(
  p_reservation_id uuid,
  p_provider text,
  p_external_grant_id text,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation reservations%rowtype;
  v_access access_grants%rowtype;
begin
  select * into v_reservation from reservations where id = p_reservation_id;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if v_reservation.status = 'cancelled' then raise exception 'RESERVATION_NOT_ACCESS_ELIGIBLE'; end if;

  insert into access_grants (reservation_id, member_profile_id, location_id, suite_id, provider, external_grant_id, starts_at, expires_at, idempotency_key, status)
  values (v_reservation.id, v_reservation.member_profile_id, v_reservation.location_id, v_reservation.suite_id, p_provider, p_external_grant_id, p_starts_at, p_expires_at, p_idempotency_key, 'active')
  on conflict (reservation_id) do update set starts_at = excluded.starts_at, expires_at = excluded.expires_at, external_grant_id = excluded.external_grant_id
  returning * into v_access;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key)
  values ('access.grant.created', v_reservation.member_profile_id::text, v_access.id::text, 'Simulated access grant persisted', p_idempotency_key || ':audit-access-grant-created')
  on conflict (idempotency_key) do nothing;

  return row_to_json(v_access)::jsonb;
end;
$$;

create or replace function fairway_cancel_reservation(
  p_member_profile_id uuid,
  p_reservation_id uuid,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation reservations%rowtype;
  v_commit credit_ledger_entries%rowtype;
  v_refund credit_ledger_entries%rowtype;
  v_access access_grants%rowtype;
  v_reason text := 'Development cancellation policy: member cancelled before reservation start time';
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  select * into v_reservation
  from reservations
  where id = p_reservation_id and member_profile_id = p_member_profile_id
  for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;

  if v_reservation.status = 'cancelled' then
    select * into v_access from access_grants where reservation_id = v_reservation.id;
    return jsonb_build_object('reservation', row_to_json(v_reservation), 'accessGrant', case when v_access.id is null then null else row_to_json(v_access) end, 'availableCredits', fairway_available_credits(p_member_profile_id), 'refundedCredits', 0, 'idempotent', true);
  end if;

  if v_reservation.status = 'checked_in' or exists (select 1 from sessions where reservation_id = v_reservation.id) then
    raise exception 'SESSION_ALREADY_STARTED';
  end if;
  if v_reservation.status <> 'confirmed' then raise exception 'RESERVATION_NOT_CANCELLABLE'; end if;
  if v_reservation.start_at <= p_now then raise exception 'RESERVATION_CANCELLATION_CUTOFF_PASSED'; end if;

  select * into v_commit
  from credit_ledger_entries
  where member_profile_id = p_member_profile_id
    and related_entry_id = v_reservation.credit_hold_entry_id
    and entry_type = 'commit';
  if not found then raise exception 'CREDIT_COMMIT_NOT_FOUND'; end if;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key)
  values ('reservation.cancellation.requested', p_member_profile_id::text, v_reservation.id::text, v_reason, 'reservation:' || v_reservation.id::text || ':audit-cancellation-requested')
  on conflict (idempotency_key) do nothing;

  update reservations
  set status = 'cancelled', cancelled_at = p_now, cancellation_reason = v_reason
  where id = v_reservation.id
  returning * into v_reservation;

  insert into credit_ledger_entries (member_profile_id, entry_type, amount, balance_delta, related_entry_id, idempotency_key, reason, actor_id)
  values (p_member_profile_id, 'refund', v_commit.amount, v_commit.amount, v_commit.id, 'reservation:' || v_reservation.id::text || ':credit-refund', v_reason, p_member_profile_id::text)
  on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning * into v_refund;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key)
  values ('credit.compensated', p_member_profile_id::text, v_refund.id::text, 'Reservation cancellation credit refund recorded', 'reservation:' || v_reservation.id::text || ':audit-credit-compensated')
  on conflict (idempotency_key) do nothing;

  update access_grants
  set status = 'revoked', revoked_at = p_now, revocation_reason = 'Reservation cancelled'
  where reservation_id = v_reservation.id and status = 'active'
  returning * into v_access;

  if v_access.id is not null then
    insert into audit_events (type, actor_id, resource_id, reason, idempotency_key)
    values ('access.grant.revoked', p_member_profile_id::text, v_access.id::text, 'Reservation cancelled; simulated access grant revoked', 'reservation:' || v_reservation.id::text || ':audit-access-revoked')
    on conflict (idempotency_key) do nothing;
  else
    select * into v_access from access_grants where reservation_id = v_reservation.id;
  end if;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key)
  values ('reservation.cancelled', p_member_profile_id::text, v_reservation.id::text, v_reason, 'reservation:' || v_reservation.id::text || ':audit-cancelled')
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('reservation', row_to_json(v_reservation), 'accessGrant', case when v_access.id is null then null else row_to_json(v_access) end, 'availableCredits', fairway_available_credits(p_member_profile_id), 'refundedCredits', v_refund.amount, 'idempotent', false);
end;
$$;
