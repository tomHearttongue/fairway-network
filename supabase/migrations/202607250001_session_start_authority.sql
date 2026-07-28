drop function if exists fairway_start_session(uuid, uuid, text, text, timestamptz, text);

create or replace function fairway_start_session(
  p_member_profile_id uuid,
  p_reservation_id uuid,
  p_provider text,
  p_external_session_id text,
  p_started_at timestamptz,
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
  v_access access_grants%rowtype;
  v_session sessions%rowtype;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  select *
  into v_reservation
  from reservations
  where id = p_reservation_id
  for update;

  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if v_reservation.member_profile_id <> p_member_profile_id then raise exception 'RESERVATION_NOT_OWNED'; end if;

  select *
  into v_session
  from sessions
  where reservation_id = v_reservation.id;

  if found then
    if v_reservation.status = 'checked_in'
      and v_session.member_profile_id = p_member_profile_id
      and v_session.suite_id = v_reservation.suite_id
      and v_session.idempotency_key = p_idempotency_key then
      return row_to_json(v_session)::jsonb || jsonb_build_object('idempotent', true);
    end if;
    raise exception 'SESSION_ALREADY_STARTED';
  end if;

  if v_reservation.status <> 'confirmed' then raise exception 'RESERVATION_NOT_STARTABLE'; end if;

  select *
  into v_access
  from access_grants
  where reservation_id = v_reservation.id
  for update;

  if not found then raise exception 'SESSION_ACCESS_GRANT_REQUIRED'; end if;
  if v_access.member_profile_id <> p_member_profile_id
    or v_access.location_id <> v_reservation.location_id
    or v_access.suite_id <> v_reservation.suite_id then
    raise exception 'SESSION_ACCESS_MAPPING_INVALID';
  end if;
  if v_access.status <> 'active' then raise exception 'SESSION_ACCESS_REVOKED'; end if;
  if p_now < v_access.starts_at then raise exception 'SESSION_ACCESS_WINDOW_NOT_OPEN'; end if;
  if p_now >= v_access.expires_at then raise exception 'SESSION_ACCESS_WINDOW_EXPIRED'; end if;

  insert into sessions (
    reservation_id,
    member_profile_id,
    suite_id,
    started_at,
    provider,
    external_session_id,
    idempotency_key
  )
  values (
    v_reservation.id,
    p_member_profile_id,
    v_reservation.suite_id,
    p_now,
    p_provider,
    p_external_session_id,
    p_idempotency_key
  )
  returning * into v_session;

  update reservations
  set status = 'checked_in'
  where id = v_reservation.id and status = 'confirmed';

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key)
  values (
    'session.started',
    p_member_profile_id::text,
    v_session.id::text,
    'Practice Suite session started inside its authorized access window',
    p_idempotency_key || ':audit-session-started'
  )
  on conflict (idempotency_key) do nothing;

  return row_to_json(v_session)::jsonb || jsonb_build_object('idempotent', false);
end;
$$;

revoke all on function fairway_start_session(uuid, uuid, text, text, timestamptz, text, timestamptz) from public;
revoke all on function fairway_start_session(uuid, uuid, text, text, timestamptz, text, timestamptz) from anon;
revoke all on function fairway_start_session(uuid, uuid, text, text, timestamptz, text, timestamptz) from authenticated;
grant execute on function fairway_start_session(uuid, uuid, text, text, timestamptz, text, timestamptz) to service_role;
