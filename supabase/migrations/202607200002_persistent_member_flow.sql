create extension if not exists pgcrypto;

alter table reservations add column if not exists idempotency_key text;
drop index if exists reservations_idempotency_key_idx;
create unique index if not exists reservations_idempotency_key_idx on reservations(idempotency_key);

alter table access_grants add column if not exists idempotency_key text;
create unique index if not exists access_grants_reservation_id_idx on access_grants(reservation_id);
drop index if exists access_grants_idempotency_key_idx;
create unique index if not exists access_grants_idempotency_key_idx on access_grants(idempotency_key);

alter table sessions add column if not exists idempotency_key text;
create unique index if not exists sessions_reservation_id_idx on sessions(reservation_id);
drop index if exists sessions_idempotency_key_idx;
create unique index if not exists sessions_idempotency_key_idx on sessions(idempotency_key);

alter table audit_events add column if not exists idempotency_key text;
drop index if exists audit_events_idempotency_key_idx;
create unique index if not exists audit_events_idempotency_key_idx on audit_events(idempotency_key);

create unique index if not exists member_profiles_person_home_location_idx on member_profiles(person_id, home_location_id);
create unique index if not exists active_memberships_member_profile_idx on memberships(member_profile_id) where ended_at is null and status = 'active';

create or replace function fairway_seed_location_one()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into locations (id, name, timezone, suite_count, minimum_session_minutes, booking_increment_minutes, turnover_buffer_minutes, access_before_minutes, access_after_minutes, play_now_enabled)
  values ('00000000-0000-0000-0000-000000000001', 'Fairway Network Location #1', 'America/Chicago', 12, 30, 15, 15, 15, 15, true)
  on conflict (id) do update set
    name = excluded.name,
    timezone = excluded.timezone,
    suite_count = excluded.suite_count,
    minimum_session_minutes = excluded.minimum_session_minutes,
    booking_increment_minutes = excluded.booking_increment_minutes,
    turnover_buffer_minutes = excluded.turnover_buffer_minutes,
    access_before_minutes = excluded.access_before_minutes,
    access_after_minutes = excluded.access_after_minutes,
    play_now_enabled = excluded.play_now_enabled;

  insert into suites (id, location_id, name, status)
  select ('00000000-0000-0000-0000-' || lpad((1000 + n)::text, 12, '0'))::uuid,
         '00000000-0000-0000-0000-000000000001',
         'Practice Suite ' || n,
         'available'::suite_status
  from generate_series(1, 12) as n
  on conflict (location_id, name) do update set status = suites.status;

  insert into membership_plans (id, code, name, monthly_credits, booking_window_days, max_active_future_reservations, play_now_enabled, guest_allowance)
  values ('00000000-0000-0000-0000-000000000101', 'TEST_BIRDIE', 'Test Birdie', 24, 7, 2, true, 1)
  on conflict (code) do update set
    name = excluded.name,
    monthly_credits = excluded.monthly_credits,
    booking_window_days = excluded.booking_window_days,
    max_active_future_reservations = excluded.max_active_future_reservations,
    play_now_enabled = excluded.play_now_enabled,
    guest_allowance = excluded.guest_allowance;
end;
$$;

create or replace function fairway_available_credits(p_member_profile_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with committed as (
    select coalesce(sum(balance_delta), 0)::integer as balance
    from credit_ledger_entries
    where member_profile_id = p_member_profile_id
  ), open_holds as (
    select coalesce(sum(hold.amount), 0)::integer as amount
    from credit_ledger_entries hold
    where hold.member_profile_id = p_member_profile_id
      and hold.entry_type = 'hold'
      and not exists (
        select 1
        from credit_ledger_entries closing
        where closing.related_entry_id = hold.id
          and closing.entry_type in ('commit', 'release')
      )
  )
  select committed.balance - open_holds.amount from committed, open_holds;
$$;

create or replace function fairway_bootstrap_clerk_member(
  p_clerk_user_id text,
  p_email text,
  p_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person_id uuid;
  v_member_profile_id uuid;
  v_plan_id uuid;
  v_member_number text;
begin
  if p_clerk_user_id is null or length(trim(p_clerk_user_id)) = 0 then
    raise exception 'CLERK_USER_REQUIRED';
  end if;

  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'EMAIL_REQUIRED';
  end if;

  perform fairway_seed_location_one();

  select ap.person_id into v_person_id
  from auth_principals ap
  where ap.provider = 'clerk' and ap.external_id = p_clerk_user_id;

  if v_person_id is null then
    insert into people (email, display_name)
    values (p_email, coalesce(nullif(trim(p_display_name), ''), p_email))
    on conflict (email) do update set display_name = excluded.display_name
    returning id into v_person_id;

    insert into auth_principals (provider, external_id, person_id)
    values ('clerk', p_clerk_user_id, v_person_id)
    on conflict (provider, external_id) do update set person_id = excluded.person_id;
  else
    update people
    set email = p_email,
        display_name = coalesce(nullif(trim(p_display_name), ''), p_email)
    where id = v_person_id;
  end if;

  v_member_number := 'FN-' || upper(substr(md5(v_person_id::text), 1, 8));

  insert into member_profiles (person_id, home_location_id, member_number)
  values (v_person_id, '00000000-0000-0000-0000-000000000001', v_member_number)
  on conflict (person_id, home_location_id) do update set member_number = member_profiles.member_number
  returning id into v_member_profile_id;

  select id into v_plan_id from membership_plans where code = 'TEST_BIRDIE';

  insert into memberships (member_profile_id, membership_plan_id, status, started_at)
  select v_member_profile_id, v_plan_id, 'active', now()
  where not exists (
    select 1 from memberships where member_profile_id = v_member_profile_id and status = 'active' and ended_at is null
  );

  insert into credit_ledger_entries (member_profile_id, entry_type, amount, balance_delta, idempotency_key, reason, actor_id)
  values (v_member_profile_id, 'grant', 24, 24, 'seed:test-birdie-monthly-grant:' || v_member_profile_id::text, 'TEST_BIRDIE monthly seed grant', 'system')
  on conflict (idempotency_key) do nothing;

  insert into credit_ledger_entries (member_profile_id, entry_type, amount, balance_delta, idempotency_key, reason, actor_id)
  values (v_member_profile_id, 'grant', 100, 100, 'seed:development-100-credit-grant:' || v_member_profile_id::text, 'Development-only workflow exercise grant', 'system')
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('memberProfileId', v_member_profile_id);
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
    'reservations', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'locationId', r.location_id, 'suiteId', r.suite_id, 'memberProfileId', r.member_profile_id, 'bookingMode', r.booking_mode, 'status', r.status, 'startAt', r.start_at, 'endAt', r.end_at, 'creditHoldEntryId', r.credit_hold_entry_id, 'idempotencyKey', r.idempotency_key, 'createdAt', r.created_at) order by r.start_at) from reservations r where r.location_id = loc.id and r.status in ('held', 'confirmed', 'checked_in')), '[]'::jsonb),
    'auditEvents', coalesce((select jsonb_agg(jsonb_build_object('id', ae.id, 'type', ae.type, 'actorId', ae.actor_id, 'resourceId', ae.resource_id, 'reason', ae.reason, 'createdAt', ae.created_at) order by ae.created_at desc) from audit_events ae where ae.actor_id = mp.id::text limit 25), '[]'::jsonb)
  )
  from member_profiles mp
  join people pe on pe.id = mp.person_id
  join locations loc on loc.id = mp.home_location_id
  join memberships mem on mem.member_profile_id = mp.id and mem.status = 'active' and mem.ended_at is null
  join membership_plans plan on plan.id = mem.membership_plan_id
  where mp.id = p_member_profile_id;
$$;

create or replace function fairway_create_reservation(
  p_member_profile_id uuid,
  p_booking_mode booking_mode,
  p_suite_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_requested_minutes integer,
  p_credit_cost integer,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing reservations%rowtype;
  v_location locations%rowtype;
  v_plan membership_plans%rowtype;
  v_suite_id uuid;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_available_until timestamptz;
  v_requested_minutes integer;
  v_active_future_count integer;
  v_available_credits integer;
  v_hold_id uuid;
  v_reservation reservations%rowtype;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  select * into v_existing from reservations where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('reservation', row_to_json(v_existing), 'idempotent', true);
  end if;

  select loc.* into v_location
  from member_profiles mp
  join locations loc on loc.id = mp.home_location_id
  where mp.id = p_member_profile_id;
  if not found then raise exception 'MEMBER_PROFILE_NOT_FOUND'; end if;

  select plan.* into v_plan
  from memberships mem
  join membership_plans plan on plan.id = mem.membership_plan_id
  where mem.member_profile_id = p_member_profile_id and mem.status = 'active' and mem.ended_at is null;
  if not found then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED'; end if;

  if p_credit_cost is null or p_credit_cost <= 0 then raise exception 'INVALID_CREDIT_COST'; end if;

  if p_booking_mode = 'PLAY_NOW' then
    if not v_location.play_now_enabled or not v_plan.play_now_enabled then raise exception 'PLAY_NOW_DISABLED'; end if;
    v_start_at := p_now;
    v_requested_minutes := coalesce(p_requested_minutes, v_location.minimum_session_minutes);
    if v_requested_minutes < v_location.minimum_session_minutes then raise exception 'PLAY_NOW_TOO_SHORT'; end if;

    select candidate.suite_id, candidate.available_until into v_suite_id, v_available_until
    from (
      select s.id as suite_id,
             coalesce((select min(r.start_at) - make_interval(mins => v_location.turnover_buffer_minutes) from reservations r where r.suite_id = s.id and r.status in ('held', 'confirmed', 'checked_in') and r.start_at > p_now), p_now + make_interval(mins => v_requested_minutes)) as available_until
      from suites s
      where s.location_id = v_location.id
        and s.status = 'available'
        and not exists (select 1 from reservations r where r.suite_id = s.id and r.status in ('held', 'confirmed', 'checked_in') and tstzrange(r.start_at, r.end_at, '[)') && tstzrange(p_now, p_now + make_interval(mins => v_location.minimum_session_minutes), '[)'))
      order by s.name
    ) candidate
    where floor(extract(epoch from (candidate.available_until - p_now)) / 60 / v_location.booking_increment_minutes) * v_location.booking_increment_minutes >= v_location.minimum_session_minutes
    limit 1;

    if v_suite_id is null then raise exception 'NO_SUITE_AVAILABLE'; end if;
    v_end_at := p_now + make_interval(mins => least(v_requested_minutes, floor(extract(epoch from (v_available_until - p_now)) / 60 / v_location.booking_increment_minutes)::integer * v_location.booking_increment_minutes));
  else
    v_suite_id := p_suite_id;
    v_start_at := p_start_at;
    v_end_at := p_end_at;

    if p_booking_mode = 'ADVANCE' then
      select count(*) into v_active_future_count
      from reservations
      where member_profile_id = p_member_profile_id and status = 'confirmed' and start_at > p_now;
      if v_active_future_count >= v_plan.max_active_future_reservations then raise exception 'ACTIVE_RESERVATION_LIMIT_REACHED'; end if;
      if v_start_at > p_now + make_interval(days => v_plan.booking_window_days) then raise exception 'BOOKING_WINDOW_EXCEEDED'; end if;
    end if;
  end if;

  if v_suite_id is null then raise exception 'SUITE_REQUIRED'; end if;
  if v_end_at <= v_start_at then raise exception 'INVALID_RESERVATION_TIME'; end if;

  if not exists (select 1 from suites where id = v_suite_id and location_id = v_location.id and status = 'available') then
    raise exception 'SUITE_NOT_AVAILABLE';
  end if;

  if exists (select 1 from reservations where suite_id = v_suite_id and status in ('held', 'confirmed', 'checked_in') and tstzrange(start_at, end_at, '[)') && tstzrange(v_start_at, v_end_at, '[)')) then
    raise exception 'RESERVATION_CONFLICT';
  end if;

  select fairway_available_credits(p_member_profile_id) into v_available_credits;
  if v_available_credits < p_credit_cost then raise exception 'INSUFFICIENT_CREDITS'; end if;

  insert into credit_ledger_entries (member_profile_id, entry_type, amount, balance_delta, idempotency_key, reason, actor_id)
  values (p_member_profile_id, 'hold', p_credit_cost, 0, p_idempotency_key || ':credit-hold', p_booking_mode::text || ' reservation credit hold', p_member_profile_id::text)
  returning id into v_hold_id;

  insert into reservations (location_id, suite_id, member_profile_id, booking_mode, status, start_at, end_at, credit_hold_entry_id, idempotency_key)
  values (v_location.id, v_suite_id, p_member_profile_id, p_booking_mode, 'confirmed', v_start_at, v_end_at, v_hold_id, p_idempotency_key)
  returning * into v_reservation;

  insert into credit_ledger_entries (member_profile_id, entry_type, amount, balance_delta, related_entry_id, idempotency_key, reason, actor_id)
  values (p_member_profile_id, 'commit', p_credit_cost, -p_credit_cost, v_hold_id, p_idempotency_key || ':credit-commit', p_booking_mode::text || ' reservation credit commit', p_member_profile_id::text);

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key)
  values ('reservation.created', p_member_profile_id::text, v_reservation.id::text, p_booking_mode::text || ' reservation created', p_idempotency_key || ':audit-reservation-created')
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('reservation', row_to_json(v_reservation), 'idempotent', false);
exception
  when exclusion_violation or unique_violation then
    raise exception 'RESERVATION_CONFLICT';
end;
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

  insert into access_grants (reservation_id, member_profile_id, location_id, suite_id, provider, external_grant_id, starts_at, expires_at, idempotency_key)
  values (v_reservation.id, v_reservation.member_profile_id, v_reservation.location_id, v_reservation.suite_id, p_provider, p_external_grant_id, p_starts_at, p_expires_at, p_idempotency_key)
  on conflict (reservation_id) do update set starts_at = excluded.starts_at, expires_at = excluded.expires_at, external_grant_id = excluded.external_grant_id
  returning * into v_access;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key)
  values ('access.grant.created', v_reservation.member_profile_id::text, v_access.id::text, 'Simulated access grant persisted', p_idempotency_key || ':audit-access-grant-created')
  on conflict (idempotency_key) do nothing;

  return row_to_json(v_access)::jsonb;
end;
$$;

create or replace function fairway_start_session(
  p_member_profile_id uuid,
  p_reservation_id uuid,
  p_provider text,
  p_external_session_id text,
  p_started_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation reservations%rowtype;
  v_session sessions%rowtype;
begin
  select * into v_reservation from reservations where id = p_reservation_id and member_profile_id = p_member_profile_id and status in ('confirmed', 'checked_in');
  if not found then raise exception 'RESERVATION_NOT_STARTABLE'; end if;

  insert into sessions (reservation_id, member_profile_id, suite_id, started_at, provider, external_session_id, idempotency_key)
  values (v_reservation.id, p_member_profile_id, v_reservation.suite_id, p_started_at, p_provider, p_external_session_id, p_idempotency_key)
  on conflict (reservation_id) do update set started_at = sessions.started_at
  returning * into v_session;

  update reservations set status = 'checked_in' where id = v_reservation.id and status = 'confirmed';

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key)
  values ('session.started', p_member_profile_id::text, v_session.id::text, 'Practice Suite session started', p_idempotency_key || ':audit-session-started')
  on conflict (idempotency_key) do nothing;

  return row_to_json(v_session)::jsonb;
end;
$$;
