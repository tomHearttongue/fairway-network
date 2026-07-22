alter table role_assignments drop constraint if exists role_assignments_role_check;
alter table role_assignments add constraint role_assignments_role_check check (role in ('operator', 'facilities'));

create type facility_task_type as enum ('turnover', 'inspection');
create type facility_task_status as enum ('open', 'claimed', 'in_progress', 'completed', 'cancelled');

create table if not exists facility_tasks (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  suite_id uuid references suites(id),
  task_type facility_task_type not null,
  priority integer not null default 0,
  status facility_task_status not null default 'open',
  source_reservation_id uuid references reservations(id),
  source_session_id uuid references sessions(id),
  claimed_by uuid references member_profiles(id),
  claimed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  due_at timestamptz,
  completion_notes text,
  idempotency_key text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (suite_id is not null)
);

create unique index if not exists facility_tasks_source_session_turnover_idx
  on facility_tasks(source_session_id, task_type)
  where source_session_id is not null and task_type = 'turnover';

create or replace function fairway_has_location_role(
  p_member_profile_id uuid,
  p_location_id uuid,
  p_roles text[]
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
      and ra.role = any(p_roles)
  );
$$;

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
  select fairway_has_location_role(p_member_profile_id, p_location_id, array['operator']);
$$;

create or replace function fairway_is_location_facilities(
  p_member_profile_id uuid,
  p_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select fairway_has_location_role(p_member_profile_id, p_location_id, array['operator', 'facilities']);
$$;

create or replace function fairway_grant_development_facilities(
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
  values (p_member_profile_id, p_location_id, 'facilities', 'development-bootstrap', p_reason)
  on conflict (member_profile_id, location_id, role) do update set reason = role_assignments.reason
  returning * into v_role;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values (
    'facilities.role.granted',
    p_member_profile_id::text,
    v_role.id::text,
    p_reason,
    'development-facilities-role:' || p_member_profile_id::text || ':' || p_location_id::text,
    jsonb_build_object('memberProfileId', p_member_profile_id, 'locationId', p_location_id, 'role', 'facilities')
  )
  on conflict (idempotency_key) do nothing;

  return row_to_json(v_role)::jsonb;
end;
$$;

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
        'canCompleteSession', (r.status = 'checked_in' and sess.id is not null and sess.ended_at is null),
        'sessionStartedAt', sess.started_at,
        'sessionEndedAt', sess.ended_at,
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

create or replace function fairway_complete_session(
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
  v_session sessions%rowtype;
  v_access access_grants%rowtype;
  v_task facility_tasks%rowtype;
  v_location locations%rowtype;
  v_due_at timestamptz;
  v_previous_suite_status text;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;

  select * into v_reservation
  from reservations
  where id = p_reservation_id and member_profile_id = p_member_profile_id
  for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;

  select * into v_session
  from sessions
  where reservation_id = v_reservation.id and member_profile_id = p_member_profile_id
  for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  if v_session.ended_at is not null and v_reservation.status = 'completed' then
    select * into v_access from access_grants where reservation_id = v_reservation.id;
    select * into v_task from facility_tasks where source_session_id = v_session.id and task_type = 'turnover';
    return jsonb_build_object('session', row_to_json(v_session), 'reservation', row_to_json(v_reservation), 'accessGrant', case when v_access.id is null then null else row_to_json(v_access) end, 'facilityTask', case when v_task.id is null then null else row_to_json(v_task) end, 'idempotent', true);
  end if;

  if v_reservation.status <> 'checked_in' then raise exception 'RESERVATION_NOT_COMPLETABLE'; end if;

  select * into v_location from locations where id = v_reservation.location_id;
  select min(r.start_at) - make_interval(mins => v_location.turnover_buffer_minutes) into v_due_at
  from reservations r
  where r.suite_id = v_reservation.suite_id
    and r.status in ('held', 'confirmed')
    and r.start_at > p_now;
  v_due_at := coalesce(v_due_at, p_now + make_interval(mins => v_location.turnover_buffer_minutes));

  update sessions
  set ended_at = p_now
  where id = v_session.id and ended_at is null
  returning * into v_session;

  update reservations
  set status = 'completed'
  where id = v_reservation.id and status = 'checked_in'
  returning * into v_reservation;

  update access_grants
  set status = 'expired'
  where reservation_id = v_reservation.id and status = 'active'
  returning * into v_access;
  if v_access.id is null then select * into v_access from access_grants where reservation_id = v_reservation.id; end if;

  select status::text into v_previous_suite_status from suites where id = v_reservation.suite_id for update;
  update suites
  set status = 'turnover'
  where id = v_reservation.suite_id
    and status in ('available', 'occupied', 'turnover')
  returning status::text into v_previous_suite_status;

  insert into facility_tasks (location_id, suite_id, task_type, priority, status, source_reservation_id, source_session_id, due_at, idempotency_key)
  values (v_reservation.location_id, v_reservation.suite_id, 'turnover', 100, 'open', v_reservation.id, v_session.id, v_due_at, 'session:' || v_session.id::text || ':turnover-task')
  on conflict (idempotency_key) do update set updated_at = facility_tasks.updated_at
  returning * into v_task;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('session.completed', p_member_profile_id::text, v_session.id::text, 'Practice Suite session completed', p_idempotency_key || ':audit-session-completed', jsonb_build_object('reservationId', v_reservation.id, 'suiteId', v_reservation.suite_id))
  on conflict (idempotency_key) do nothing;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('reservation.completed', p_member_profile_id::text, v_reservation.id::text, 'Reservation completed after session completion', p_idempotency_key || ':audit-reservation-completed', jsonb_build_object('sessionId', v_session.id, 'suiteId', v_reservation.suite_id))
  on conflict (idempotency_key) do nothing;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('access.grant.expired', p_member_profile_id::text, coalesce(v_access.id::text, v_reservation.id::text), 'Session completed; simulated access no longer active', p_idempotency_key || ':audit-access-expired', jsonb_build_object('reservationId', v_reservation.id, 'status', coalesce(v_access.status::text, 'none')))
  on conflict (idempotency_key) do nothing;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('facility.task.created', p_member_profile_id::text, v_task.id::text, 'Turnover task created after session completion', p_idempotency_key || ':audit-task-created', jsonb_build_object('reservationId', v_reservation.id, 'sessionId', v_session.id, 'suiteId', v_reservation.suite_id, 'taskType', v_task.task_type))
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('session', row_to_json(v_session), 'reservation', row_to_json(v_reservation), 'accessGrant', case when v_access.id is null then null else row_to_json(v_access) end, 'facilityTask', row_to_json(v_task), 'idempotent', false);
end;
$$;

create or replace function fairway_facilities_state(
  p_actor_member_profile_id uuid,
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
  where mp.id = p_actor_member_profile_id
    and loc.id = coalesce(p_location_id, mp.home_location_id)
  limit 1;
  if not found then raise exception 'LOCATION_NOT_FOUND'; end if;
  if not fairway_is_location_facilities(p_actor_member_profile_id, v_location.id) then raise exception 'FACILITIES_FORBIDDEN'; end if;

  return jsonb_build_object(
    'actor', jsonb_build_object('memberProfileId', p_actor_member_profile_id),
    'location', jsonb_build_object('id', v_location.id, 'name', v_location.name, 'timezone', v_location.timezone, 'suiteCount', v_location.suite_count, 'minimumSessionMinutes', v_location.minimum_session_minutes, 'bookingIncrementMinutes', v_location.booking_increment_minutes, 'turnoverBufferMinutes', v_location.turnover_buffer_minutes, 'accessBeforeMinutes', v_location.access_before_minutes, 'accessAfterMinutes', v_location.access_after_minutes, 'playNowEnabled', v_location.play_now_enabled),
    'suites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'locationId', s.location_id,
        'name', s.name,
        'status', s.status,
        'occupiedUntil', current_res.end_at,
        'nextReservationAt', next_res.start_at,
        'minutesUntilNextReservation', case when next_res.start_at is null then null else floor(extract(epoch from (next_res.start_at - p_now)) / 60)::int end,
        'openTaskCount', coalesce(task_counts.open_count, 0)
      ) order by s.name)
      from suites s
      left join lateral (
        select r.* from reservations r
        where r.suite_id = s.id and r.status = 'checked_in'
        order by r.end_at desc limit 1
      ) current_res on true
      left join lateral (
        select r.* from reservations r
        where r.suite_id = s.id and r.status in ('held', 'confirmed') and r.start_at > p_now
        order by r.start_at limit 1
      ) next_res on true
      left join lateral (
        select count(*)::int as open_count from facility_tasks ft where ft.suite_id = s.id and ft.status in ('open', 'claimed', 'in_progress')
      ) task_counts on true
      where s.location_id = v_location.id
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ranked.id,
        'locationId', ranked.location_id,
        'suiteId', ranked.suite_id,
        'suiteName', ranked.suite_name,
        'taskType', ranked.task_type,
        'priority', ranked.computed_priority,
        'status', ranked.status,
        'dueAt', ranked.due_at,
        'createdAt', ranked.created_at,
        'claimedBySelf', ranked.claimed_by = p_actor_member_profile_id,
        'claimedAt', ranked.claimed_at,
        'startedAt', ranked.started_at,
        'completedAt', ranked.completed_at,
        'nextReservationAt', ranked.next_reservation_at,
        'minutesUntilNextReservation', ranked.minutes_until_next,
        'occupiedUntil', ranked.occupied_until
      ) order by ranked.computed_priority desc, ranked.due_at asc nulls last, ranked.created_at asc)
      from (
        select ft.*, s.name as suite_name, current_res.end_at as occupied_until, next_res.start_at as next_reservation_at,
               case when next_res.start_at is null then null else floor(extract(epoch from (next_res.start_at - p_now)) / 60)::int end as minutes_until_next,
               ft.priority
               + case when ft.due_at is not null and ft.due_at <= p_now then 50 else 0 end
               + case when next_res.start_at is not null and next_res.start_at <= p_now + interval '90 minutes' then 25 else 0 end
               + case when ft.status = 'in_progress' then 20 when ft.status = 'claimed' then 10 else 0 end as computed_priority
        from facility_tasks ft
        join suites s on s.id = ft.suite_id
        left join lateral (
          select r.* from reservations r where r.suite_id = ft.suite_id and r.status = 'checked_in' order by r.end_at desc limit 1
        ) current_res on true
        left join lateral (
          select r.* from reservations r where r.suite_id = ft.suite_id and r.status in ('held', 'confirmed') and r.start_at > p_now order by r.start_at limit 1
        ) next_res on true
        where ft.location_id = v_location.id and ft.status in ('open', 'claimed', 'in_progress')
      ) ranked
    ), '[]'::jsonb),
    'auditEvents', coalesce((
      select jsonb_agg(jsonb_build_object('id', ae.id, 'type', ae.type, 'actorId', ae.actor_id, 'resourceId', ae.resource_id, 'reason', ae.reason, 'createdAt', ae.created_at, 'metadata', ae.metadata) order by ae.created_at desc)
      from (
        select * from audit_events ae
        where ae.type in ('session.completed', 'reservation.completed', 'access.grant.expired', 'facility.task.created', 'facility.task.claimed', 'facility.task.started', 'facility.task.completed', 'facility.inspection.requested', 'suite.returned.ready')
        order by ae.created_at desc
        limit 40
      ) ae
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function fairway_claim_facility_task(
  p_actor_member_profile_id uuid,
  p_task_id uuid,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task facility_tasks%rowtype;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  select * into v_task from facility_tasks where id = p_task_id for update;
  if not found then raise exception 'FACILITY_TASK_NOT_FOUND'; end if;
  if not fairway_is_location_facilities(p_actor_member_profile_id, v_task.location_id) then raise exception 'FACILITIES_FORBIDDEN'; end if;
  if v_task.status in ('completed', 'cancelled') then raise exception 'FACILITY_TASK_NOT_CLAIMABLE'; end if;
  if v_task.claimed_by is not null and v_task.claimed_by <> p_actor_member_profile_id then raise exception 'FACILITY_TASK_ALREADY_CLAIMED'; end if;
  if v_task.status in ('claimed', 'in_progress') and v_task.claimed_by = p_actor_member_profile_id then
    return jsonb_build_object('task', row_to_json(v_task), 'idempotent', true);
  end if;

  update facility_tasks set status = 'claimed', claimed_by = p_actor_member_profile_id, claimed_at = p_now, updated_at = p_now where id = v_task.id returning * into v_task;
  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('facility.task.claimed', p_actor_member_profile_id::text, v_task.id::text, 'Facility task claimed', p_idempotency_key || ':audit-claimed', jsonb_build_object('suiteId', v_task.suite_id, 'taskType', v_task.task_type))
  on conflict (idempotency_key) do nothing;
  return jsonb_build_object('task', row_to_json(v_task), 'idempotent', false);
end;
$$;

create or replace function fairway_start_facility_task(
  p_actor_member_profile_id uuid,
  p_task_id uuid,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task facility_tasks%rowtype;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  select * into v_task from facility_tasks where id = p_task_id for update;
  if not found then raise exception 'FACILITY_TASK_NOT_FOUND'; end if;
  if not fairway_is_location_facilities(p_actor_member_profile_id, v_task.location_id) then raise exception 'FACILITIES_FORBIDDEN'; end if;
  if v_task.status = 'completed' then raise exception 'FACILITY_TASK_ALREADY_COMPLETED'; end if;
  if v_task.claimed_by is not null and v_task.claimed_by <> p_actor_member_profile_id then raise exception 'FACILITY_TASK_CLAIMED_BY_ANOTHER'; end if;
  if v_task.status = 'in_progress' and v_task.claimed_by = p_actor_member_profile_id then return jsonb_build_object('task', row_to_json(v_task), 'idempotent', true); end if;

  update facility_tasks set status = 'in_progress', claimed_by = coalesce(claimed_by, p_actor_member_profile_id), claimed_at = coalesce(claimed_at, p_now), started_at = coalesce(started_at, p_now), updated_at = p_now where id = v_task.id returning * into v_task;
  update suites set status = case when v_task.task_type = 'inspection' then 'inspection_required'::suite_status else 'turnover'::suite_status end where id = v_task.suite_id and status in ('available', 'turnover', 'inspection_required');
  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('facility.task.started', p_actor_member_profile_id::text, v_task.id::text, 'Facility task started', p_idempotency_key || ':audit-started', jsonb_build_object('suiteId', v_task.suite_id, 'taskType', v_task.task_type))
  on conflict (idempotency_key) do nothing;
  return jsonb_build_object('task', row_to_json(v_task), 'idempotent', false);
end;
$$;

create or replace function fairway_complete_facility_task(
  p_actor_member_profile_id uuid,
  p_task_id uuid,
  p_completion_notes text,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task facility_tasks%rowtype;
  v_suite suites%rowtype;
  v_returned boolean := false;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  select * into v_task from facility_tasks where id = p_task_id for update;
  if not found then raise exception 'FACILITY_TASK_NOT_FOUND'; end if;
  if not fairway_is_location_facilities(p_actor_member_profile_id, v_task.location_id) then raise exception 'FACILITIES_FORBIDDEN'; end if;
  if v_task.status = 'completed' then return jsonb_build_object('task', row_to_json(v_task), 'suite', (select row_to_json(s) from suites s where s.id = v_task.suite_id), 'idempotent', true); end if;
  if v_task.status = 'cancelled' then raise exception 'FACILITY_TASK_CANCELLED'; end if;
  if v_task.claimed_by is not null and v_task.claimed_by <> p_actor_member_profile_id then raise exception 'FACILITY_TASK_CLAIMED_BY_ANOTHER'; end if;

  update facility_tasks set status = 'completed', completed_at = p_now, completion_notes = nullif(trim(coalesce(p_completion_notes, '')), ''), updated_at = p_now where id = v_task.id returning * into v_task;

  if not exists (select 1 from facility_tasks ft where ft.suite_id = v_task.suite_id and ft.status in ('open', 'claimed', 'in_progress') and ft.id <> v_task.id) then
    update suites set status = 'available' where id = v_task.suite_id and status in ('turnover', 'inspection_required') returning * into v_suite;
    v_returned := found;
  end if;
  if v_suite.id is null then select * into v_suite from suites where id = v_task.suite_id; end if;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('facility.task.completed', p_actor_member_profile_id::text, v_task.id::text, coalesce(nullif(trim(coalesce(p_completion_notes, '')), ''), 'Facility task completed'), p_idempotency_key || ':audit-completed', jsonb_build_object('suiteId', v_task.suite_id, 'taskType', v_task.task_type, 'suiteReturnedReady', v_returned))
  on conflict (idempotency_key) do nothing;

  if v_returned then
    insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
    values ('suite.returned.ready', p_actor_member_profile_id::text, v_task.suite_id::text, 'Suite returned to available inventory after facility task completion', p_idempotency_key || ':audit-suite-ready', jsonb_build_object('taskId', v_task.id, 'newStatus', 'available'))
    on conflict (idempotency_key) do nothing;
  end if;

  return jsonb_build_object('task', row_to_json(v_task), 'suite', row_to_json(v_suite), 'idempotent', false);
end;
$$;

create or replace function fairway_flag_suite_inspection(
  p_actor_member_profile_id uuid,
  p_suite_id uuid,
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
  v_suite suites%rowtype;
  v_task facility_tasks%rowtype;
  v_previous_status text;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'REASON_REQUIRED'; end if;
  select * into v_suite from suites where id = p_suite_id for update;
  if not found then raise exception 'SUITE_NOT_FOUND'; end if;
  if not fairway_is_location_facilities(p_actor_member_profile_id, v_suite.location_id) then raise exception 'FACILITIES_FORBIDDEN'; end if;

  v_previous_status := v_suite.status::text;
  update suites set status = 'inspection_required' where id = p_suite_id and status in ('available', 'turnover', 'inspection_required') returning * into v_suite;
  if v_suite.id is null then select * into v_suite from suites where id = p_suite_id; end if;

  insert into facility_tasks (location_id, suite_id, task_type, priority, status, due_at, idempotency_key)
  values (v_suite.location_id, v_suite.id, 'inspection', 125, 'open', p_now, p_idempotency_key || ':inspection-task')
  on conflict (idempotency_key) do update set updated_at = facility_tasks.updated_at
  returning * into v_task;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('facility.inspection.requested', p_actor_member_profile_id::text, v_task.id::text, p_reason, p_idempotency_key || ':audit-inspection-requested', jsonb_build_object('suiteId', v_suite.id, 'previousStatus', v_previous_status, 'newStatus', v_suite.status))
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('task', row_to_json(v_task), 'suite', row_to_json(v_suite), 'idempotent', false);
end;
$$;