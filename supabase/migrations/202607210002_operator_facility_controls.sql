create table if not exists role_assignments (
  id uuid primary key default gen_random_uuid(),
  member_profile_id uuid not null references member_profiles(id),
  location_id uuid not null references locations(id),
  role text not null check (role in ('operator')),
  granted_by text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (member_profile_id, location_id, role)
);

alter table audit_events add column if not exists metadata jsonb not null default '{}'::jsonb;

create or replace function fairway_is_location_operator(
  p_member_profile_id uuid,
  p_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from role_assignments ra
    where ra.member_profile_id = p_member_profile_id
      and ra.location_id = p_location_id
      and ra.role = 'operator'
  );
$$;

create or replace function fairway_grant_development_operator(
  p_member_profile_id uuid,
  p_location_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role role_assignments%rowtype;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'REASON_REQUIRED'; end if;

  insert into role_assignments (member_profile_id, location_id, role, granted_by, reason)
  values (p_member_profile_id, p_location_id, 'operator', 'development-bootstrap', p_reason)
  on conflict (member_profile_id, location_id, role) do update set reason = role_assignments.reason
  returning * into v_role;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values (
    'operator.role.granted',
    p_member_profile_id::text,
    v_role.id::text,
    p_reason,
    'development-operator-role:' || p_member_profile_id::text || ':' || p_location_id::text,
    jsonb_build_object('memberProfileId', p_member_profile_id, 'locationId', p_location_id, 'role', 'operator')
  )
  on conflict (idempotency_key) do nothing;

  return row_to_json(v_role)::jsonb;
end;
$$;

create or replace function fairway_operator_state(
  p_operator_member_profile_id uuid,
  p_location_id uuid default null,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_location locations%rowtype;
begin
  select loc.* into v_location
  from locations loc
  join member_profiles mp on mp.home_location_id = loc.id
  where mp.id = p_operator_member_profile_id
    and loc.id = coalesce(p_location_id, mp.home_location_id)
  limit 1;
  if not found then raise exception 'LOCATION_NOT_FOUND'; end if;
  if not fairway_is_location_operator(p_operator_member_profile_id, v_location.id) then raise exception 'OPERATOR_FORBIDDEN'; end if;

  return jsonb_build_object(
    'operator', jsonb_build_object('memberProfileId', p_operator_member_profile_id),
    'location', jsonb_build_object('id', v_location.id, 'name', v_location.name, 'timezone', v_location.timezone, 'suiteCount', v_location.suite_count, 'minimumSessionMinutes', v_location.minimum_session_minutes, 'bookingIncrementMinutes', v_location.booking_increment_minutes, 'turnoverBufferMinutes', v_location.turnover_buffer_minutes, 'accessBeforeMinutes', v_location.access_before_minutes, 'accessAfterMinutes', v_location.access_after_minutes, 'playNowEnabled', v_location.play_now_enabled),
    'suites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'locationId', s.location_id,
        'name', s.name,
        'status', s.status,
        'currentReservationId', current_res.id,
        'currentReservationStatus', current_res.status,
        'currentBookingMode', current_res.booking_mode,
        'currentMemberEmail', current_person.email,
        'activeSessionId', active_session.id
      ) order by s.name)
      from suites s
      left join lateral (
        select r.*
        from reservations r
        where r.suite_id = s.id
          and r.status in ('confirmed', 'checked_in')
          and tstzrange(r.start_at, r.end_at, '[)') && tstzrange(p_now, p_now + interval '1 minute', '[)')
        order by r.start_at
        limit 1
      ) current_res on true
      left join member_profiles current_profile on current_profile.id = current_res.member_profile_id
      left join people current_person on current_person.id = current_profile.person_id
      left join sessions active_session on active_session.reservation_id = current_res.id and active_session.ended_at is null
      where s.location_id = v_location.id
    ), '[]'::jsonb),
    'reservations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'locationId', r.location_id,
        'suiteId', r.suite_id,
        'suiteName', s.name,
        'memberProfileId', r.member_profile_id,
        'memberEmail', pe.email,
        'memberDisplayName', pe.display_name,
        'bookingMode', r.booking_mode,
        'status', r.status,
        'startAt', r.start_at,
        'endAt', r.end_at,
        'cancelledAt', r.cancelled_at,
        'cancellationReason', r.cancellation_reason,
        'sessionStartedAt', sess.started_at,
        'accessGrantStatus', ag.status
      ) order by r.start_at)
      from reservations r
      join suites s on s.id = r.suite_id
      join member_profiles mp on mp.id = r.member_profile_id
      join people pe on pe.id = mp.person_id
      left join sessions sess on sess.reservation_id = r.id
      left join access_grants ag on ag.reservation_id = r.id
      where r.location_id = v_location.id
        and r.status in ('confirmed', 'checked_in', 'cancelled')
        and r.start_at >= p_now - interval '2 hours'
        and r.start_at <= p_now + interval '24 hours'
    ), '[]'::jsonb),
    'auditEvents', coalesce((
      select jsonb_agg(jsonb_build_object('id', ae.id, 'type', ae.type, 'actorId', ae.actor_id, 'resourceId', ae.resource_id, 'reason', ae.reason, 'createdAt', ae.created_at, 'metadata', ae.metadata) order by ae.created_at desc)
      from (
        select *
        from audit_events ae
        where ae.type in ('suite.status.changed', 'operator.reservation.cancellation.requested', 'operator.reservation.cancelled', 'operator.credit.compensated', 'operator.access.grant.revoked', 'operator.role.granted')
        order by ae.created_at desc
        limit 40
      ) ae
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function fairway_set_suite_status(
  p_operator_member_profile_id uuid,
  p_suite_id uuid,
  p_status suite_status,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suite suites%rowtype;
  v_previous_status text;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'REASON_REQUIRED'; end if;

  select * into v_suite from suites where id = p_suite_id for update;
  if not found then raise exception 'SUITE_NOT_FOUND'; end if;
  if not fairway_is_location_operator(p_operator_member_profile_id, v_suite.location_id) then raise exception 'OPERATOR_FORBIDDEN'; end if;

  if exists (select 1 from audit_events where idempotency_key = p_idempotency_key and type = 'suite.status.changed') then
    select * into v_suite from suites where id = p_suite_id;
    return jsonb_build_object('suite', row_to_json(v_suite), 'idempotent', true);
  end if;

  v_previous_status := v_suite.status::text;
  update suites set status = p_status where id = p_suite_id returning * into v_suite;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values (
    'suite.status.changed',
    p_operator_member_profile_id::text,
    p_suite_id::text,
    p_reason,
    p_idempotency_key,
    jsonb_build_object('locationId', v_suite.location_id, 'previousStatus', v_previous_status, 'newStatus', p_status::text)
  )
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('suite', row_to_json(v_suite), 'idempotent', false);
end;
$$;

create or replace function fairway_operator_cancel_reservation(
  p_operator_member_profile_id uuid,
  p_reservation_id uuid,
  p_reason text,
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
  v_previous_status text;
  v_commit credit_ledger_entries%rowtype;
  v_refund credit_ledger_entries%rowtype;
  v_access access_grants%rowtype;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'REASON_REQUIRED'; end if;

  select * into v_reservation from reservations where id = p_reservation_id for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if not fairway_is_location_operator(p_operator_member_profile_id, v_reservation.location_id) then raise exception 'OPERATOR_FORBIDDEN'; end if;

  if v_reservation.status = 'cancelled' then
    select * into v_access from access_grants where reservation_id = v_reservation.id;
    return jsonb_build_object('reservation', row_to_json(v_reservation), 'accessGrant', case when v_access.id is null then null else row_to_json(v_access) end, 'availableCredits', fairway_available_credits(v_reservation.member_profile_id), 'refundedCredits', 0, 'idempotent', true);
  end if;

  if v_reservation.status = 'checked_in' or exists (select 1 from sessions where reservation_id = v_reservation.id) then
    raise exception 'SESSION_ALREADY_STARTED_OPERATOR_WORKFLOW_UNRESOLVED';
  end if;
  if v_reservation.status <> 'confirmed' then raise exception 'RESERVATION_NOT_CANCELLABLE'; end if;
  if v_reservation.start_at <= p_now then raise exception 'OPERATOR_CANCELLATION_CUTOFF_PASSED'; end if;

  select * into v_commit
  from credit_ledger_entries
  where member_profile_id = v_reservation.member_profile_id
    and related_entry_id = v_reservation.credit_hold_entry_id
    and entry_type = 'commit';
  if not found then raise exception 'CREDIT_COMMIT_NOT_FOUND'; end if;

  v_previous_status := v_reservation.status::text;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values (
    'operator.reservation.cancellation.requested',
    p_operator_member_profile_id::text,
    v_reservation.id::text,
    p_reason,
    p_idempotency_key || ':requested',
    jsonb_build_object('targetMemberProfileId', v_reservation.member_profile_id, 'previousStatus', v_previous_status)
  )
  on conflict (idempotency_key) do nothing;

  update reservations
  set status = 'cancelled', cancelled_at = p_now, cancellation_reason = p_reason
  where id = v_reservation.id
  returning * into v_reservation;

  insert into credit_ledger_entries (member_profile_id, entry_type, amount, balance_delta, related_entry_id, idempotency_key, reason, actor_id)
  values (v_reservation.member_profile_id, 'refund', v_commit.amount, v_commit.amount, v_commit.id, 'reservation:' || v_reservation.id::text || ':credit-refund', p_reason, p_operator_member_profile_id::text)
  on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning * into v_refund;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values (
    'operator.credit.compensated',
    p_operator_member_profile_id::text,
    v_refund.id::text,
    p_reason,
    p_idempotency_key || ':credit-compensated',
    jsonb_build_object('reservationId', v_reservation.id, 'targetMemberProfileId', v_reservation.member_profile_id, 'amount', v_refund.amount)
  )
  on conflict (idempotency_key) do nothing;

  update access_grants
  set status = 'revoked', revoked_at = p_now, revocation_reason = 'Operator cancelled reservation: ' || p_reason
  where reservation_id = v_reservation.id and status = 'active'
  returning * into v_access;

  if v_access.id is not null then
    insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
    values (
      'operator.access.grant.revoked',
      p_operator_member_profile_id::text,
      v_access.id::text,
      p_reason,
      p_idempotency_key || ':access-revoked',
      jsonb_build_object('reservationId', v_reservation.id, 'previousStatus', 'active', 'newStatus', 'revoked')
    )
    on conflict (idempotency_key) do nothing;
  else
    select * into v_access from access_grants where reservation_id = v_reservation.id;
  end if;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values (
    'operator.reservation.cancelled',
    p_operator_member_profile_id::text,
    v_reservation.id::text,
    p_reason,
    p_idempotency_key,
    jsonb_build_object('targetMemberProfileId', v_reservation.member_profile_id, 'previousStatus', v_previous_status, 'newStatus', 'cancelled')
  )
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('reservation', row_to_json(v_reservation), 'accessGrant', case when v_access.id is null then null else row_to_json(v_access) end, 'availableCredits', fairway_available_credits(v_reservation.member_profile_id), 'refundedCredits', v_refund.amount, 'idempotent', false);
end;
$$;