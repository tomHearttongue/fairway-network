-- DU1 Round 3: one authoritative completion instant for session, access, and turnover.
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
  v_due_at := p_now + make_interval(mins => v_location.turnover_buffer_minutes);

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
    and status in ('available', 'occupied', 'turnover');

  insert into facility_tasks (
    location_id, suite_id, task_type, priority, status,
    source_reservation_id, source_session_id, due_at,
    idempotency_key, created_at, updated_at
  )
  values (
    v_reservation.location_id, v_reservation.suite_id, 'turnover', 100, 'open',
    v_reservation.id, v_session.id, v_due_at,
    'session:' || v_session.id::text || ':turnover-task', p_now, p_now
  )
  on conflict (idempotency_key) do update set updated_at = facility_tasks.updated_at
  returning * into v_task;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata, created_at)
  values ('session.completed', p_member_profile_id::text, v_session.id::text, 'Practice Suite session completed', p_idempotency_key || ':audit-session-completed', jsonb_build_object('reservationId', v_reservation.id, 'suiteId', v_reservation.suite_id), p_now)
  on conflict (idempotency_key) do nothing;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata, created_at)
  values ('reservation.completed', p_member_profile_id::text, v_reservation.id::text, 'Reservation completed after session completion', p_idempotency_key || ':audit-reservation-completed', jsonb_build_object('sessionId', v_session.id, 'suiteId', v_reservation.suite_id), p_now)
  on conflict (idempotency_key) do nothing;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata, created_at)
  values ('access.grant.expired', p_member_profile_id::text, coalesce(v_access.id::text, v_reservation.id::text), 'Session completed; simulated access no longer active', p_idempotency_key || ':audit-access-expired', jsonb_build_object('reservationId', v_reservation.id, 'status', coalesce(v_access.status::text, 'none')), p_now)
  on conflict (idempotency_key) do nothing;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata, created_at)
  values ('facility.task.created', p_member_profile_id::text, v_task.id::text, 'Turnover task created after session completion', p_idempotency_key || ':audit-task-created', jsonb_build_object('reservationId', v_reservation.id, 'sessionId', v_session.id, 'suiteId', v_reservation.suite_id, 'taskType', v_task.task_type), p_now)
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('session', row_to_json(v_session), 'reservation', row_to_json(v_reservation), 'accessGrant', case when v_access.id is null then null else row_to_json(v_access) end, 'facilityTask', row_to_json(v_task), 'idempotent', false);
end;
$$;

revoke all on function fairway_complete_session(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function fairway_complete_session(uuid, uuid, text, timestamptz) to service_role;
