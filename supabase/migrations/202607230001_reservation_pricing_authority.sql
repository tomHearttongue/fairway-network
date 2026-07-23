create table if not exists fairway_schema_markers (
  key text primary key,
  applied_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from fairway_schema_markers where key = 'credit-ledger-half-units-v1') then
    update credit_ledger_entries
    set amount = amount * 2,
        balance_delta = balance_delta * 2;

    insert into fairway_schema_markers (key)
    values ('credit-ledger-half-units-v1');
  end if;
end;
$$;

comment on column credit_ledger_entries.amount is 'Integer credit units. Fairway credit granularity is 0.5 credit; 1 displayed credit = 2 ledger units.';
comment on column credit_ledger_entries.balance_delta is 'Integer credit units. Fairway credit granularity is 0.5 credit; 1 displayed credit = 2 ledger units.';

create table if not exists location_demand_band_windows (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  band text not null check (band in ('OFF_PEAK', 'STANDARD', 'PRIME')),
  starts_at time not null,
  ends_at time not null,
  credit_units_per_hour integer not null check (credit_units_per_hour > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (location_id, band, starts_at, ends_at)
);

comment on table location_demand_band_windows is 'Development/demo demand-band pricing config. Production schedules remain location-configurable product policy.';

drop function if exists fairway_member_state(uuid);
drop function if exists fairway_cancel_reservation(uuid, uuid, text, timestamptz);
drop function if exists fairway_operator_cancel_reservation(uuid, uuid, text, text, timestamptz);
drop function if exists fairway_create_reservation(uuid, booking_mode, uuid, timestamptz, timestamptz, integer, integer, text, timestamptz);
drop function if exists fairway_available_credits(uuid);
create or replace function fairway_credit_units_to_credits(p_units integer)
returns numeric
language sql
immutable
as $$
  select (p_units::numeric / 2.0)::numeric;
$$;

create or replace function fairway_credit_units_for_rate(p_credit_units_per_hour integer, p_duration_minutes integer)
returns integer
language plpgsql
immutable
as $$
declare
  v_units numeric;
begin
  v_units := (p_credit_units_per_hour::numeric * p_duration_minutes::numeric) / 60.0;
  if v_units <> trunc(v_units) then
    raise exception 'INVALID_CREDIT_PRECISION';
  end if;
  return v_units::integer;
end;
$$;

create or replace function fairway_available_credit_units(p_member_profile_id uuid)
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

create or replace function fairway_available_credits(p_member_profile_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select fairway_credit_units_to_credits(fairway_available_credit_units(p_member_profile_id));
$$;

create or replace function fairway_seed_location_one()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into locations (id, name, timezone, suite_count, minimum_session_minutes, booking_increment_minutes, turnover_buffer_minutes, access_before_minutes, access_after_minutes, play_now_enabled)
  values ('00000000-0000-0000-0000-000000000001', 'Fairway KC', 'America/Chicago', 12, 30, 15, 15, 15, 15, true)
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

  insert into location_demand_band_windows (location_id, band, starts_at, ends_at, credit_units_per_hour, sort_order)
  values
    ('00000000-0000-0000-0000-000000000001', 'OFF_PEAK', '00:00', '06:00', 8, 10),
    ('00000000-0000-0000-0000-000000000001', 'STANDARD', '06:00', '16:00', 12, 20),
    ('00000000-0000-0000-0000-000000000001', 'PRIME', '16:00', '21:00', 16, 30),
    ('00000000-0000-0000-0000-000000000001', 'OFF_PEAK', '21:00', '00:00', 8, 40)
  on conflict (location_id, band, starts_at, ends_at) do update set
    credit_units_per_hour = excluded.credit_units_per_hour,
    sort_order = excluded.sort_order;
end;
$$;

select fairway_seed_location_one();

create or replace function fairway_location_demand_band(p_location_id uuid, p_start_at timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_location locations%rowtype;
  v_local_time time;
  v_window location_demand_band_windows%rowtype;
begin
  select * into v_location from locations where id = p_location_id;
  if not found then raise exception 'LOCATION_NOT_FOUND'; end if;

  v_local_time := (p_start_at at time zone v_location.timezone)::time;

  select * into v_window
  from location_demand_band_windows w
  where w.location_id = p_location_id
    and (
      (w.starts_at < w.ends_at and v_local_time >= w.starts_at and v_local_time < w.ends_at)
      or
      (w.starts_at > w.ends_at and (v_local_time >= w.starts_at or v_local_time < w.ends_at))
    )
  order by w.sort_order, w.starts_at
  limit 1;

  if not found then raise exception 'DEMAND_BAND_NOT_CONFIGURED'; end if;

  return jsonb_build_object(
    'band', v_window.band,
    'creditUnitsPerHour', v_window.credit_units_per_hour
  );
end;
$$;

create or replace function fairway_reservation_price(p_location_id uuid, p_start_at timestamptz, p_duration_minutes integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_location locations%rowtype;
  v_band jsonb;
  v_units integer;
begin
  select * into v_location from locations where id = p_location_id;
  if not found then raise exception 'LOCATION_NOT_FOUND'; end if;
  if p_duration_minutes is null or p_duration_minutes < v_location.minimum_session_minutes then raise exception 'RESERVATION_TOO_SHORT'; end if;
  if p_duration_minutes % v_location.booking_increment_minutes <> 0 then raise exception 'INVALID_BOOKING_INCREMENT'; end if;

  v_band := fairway_location_demand_band(p_location_id, p_start_at);
  v_units := fairway_credit_units_for_rate((v_band->>'creditUnitsPerHour')::integer, p_duration_minutes);

  return jsonb_build_object(
    'demandBand', v_band->>'band',
    'creditUnits', v_units,
    'creditCost', fairway_credit_units_to_credits(v_units)
  );
end;
$$;

create or replace function fairway_quote_play_now(
  p_member_profile_id uuid,
  p_requested_minutes integer default null,
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
  v_plan membership_plans%rowtype;
  v_suite_id uuid;
  v_suite_name text;
  v_available_until timestamptz;
  v_max_minutes integer;
  v_selected_minutes integer;
  v_price jsonb;
  v_available_units integer;
  v_options jsonb;
begin
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

  if not v_location.play_now_enabled or not v_plan.play_now_enabled then
    return jsonb_build_object('available', false, 'blockedReason', 'PLAY_NOW_DISABLED', 'options', '[]'::jsonb, 'memberAvailableCredits', fairway_available_credits(p_member_profile_id));
  end if;

  select candidate.suite_id, candidate.suite_name, candidate.available_until into v_suite_id, v_suite_name, v_available_until
  from (
    select s.id as suite_id,
           s.name as suite_name,
           coalesce((select min(r.start_at) - make_interval(mins => v_location.turnover_buffer_minutes) from reservations r where r.suite_id = s.id and r.status in ('held', 'confirmed', 'checked_in') and r.start_at > p_now), p_now + interval '4 hours') as available_until
    from suites s
    where s.location_id = v_location.id
      and s.status = 'available'
      and not exists (select 1 from reservations r where r.suite_id = s.id and r.status in ('held', 'confirmed', 'checked_in') and tstzrange(r.start_at, r.end_at, '[)') && tstzrange(p_now, p_now + make_interval(mins => v_location.minimum_session_minutes), '[)'))
    order by s.name
  ) candidate
  where floor(extract(epoch from (candidate.available_until - p_now)) / 60 / v_location.booking_increment_minutes) * v_location.booking_increment_minutes >= v_location.minimum_session_minutes
  limit 1;

  if v_suite_id is null then
    return jsonb_build_object('available', false, 'blockedReason', 'NO_SUITE_AVAILABLE', 'options', '[]'::jsonb, 'memberAvailableCredits', fairway_available_credits(p_member_profile_id));
  end if;

  v_max_minutes := floor(extract(epoch from (v_available_until - p_now)) / 60 / v_location.booking_increment_minutes)::integer * v_location.booking_increment_minutes;
  v_available_units := fairway_available_credit_units(p_member_profile_id);

  select coalesce(jsonb_agg(option_payload order by (option_payload->>'durationMinutes')::integer), '[]'::jsonb) into v_options
  from (
    select jsonb_build_object(
      'durationMinutes', minutes,
      'demandBand', priced.price->>'demandBand',
      'creditUnits', (priced.price->>'creditUnits')::integer,
      'creditCost', (priced.price->>'creditCost')::numeric,
      'sufficientCredits', v_available_units >= (priced.price->>'creditUnits')::integer
    ) as option_payload
    from (values (30), (45), (60)) as durations(minutes)
    cross join lateral (select fairway_reservation_price(v_location.id, p_now, durations.minutes) as price) priced
    where durations.minutes <= v_max_minutes
  ) options;

  v_selected_minutes := coalesce(p_requested_minutes, case when v_max_minutes >= 60 then 60 when v_max_minutes >= 45 then 45 else v_location.minimum_session_minutes end);
  if v_selected_minutes < v_location.minimum_session_minutes then raise exception 'PLAY_NOW_TOO_SHORT'; end if;
  if v_selected_minutes % v_location.booking_increment_minutes <> 0 then raise exception 'INVALID_BOOKING_INCREMENT'; end if;
  if v_selected_minutes > v_max_minutes then raise exception 'PLAY_NOW_DURATION_UNAVAILABLE'; end if;

  v_price := fairway_reservation_price(v_location.id, p_now, v_selected_minutes);

  return jsonb_build_object(
    'available', true,
    'suiteId', v_suite_id,
    'suiteName', v_suite_name,
    'availableUntil', v_available_until,
    'maxDurationMinutes', v_max_minutes,
    'durationMinutes', v_selected_minutes,
    'demandBand', v_price->>'demandBand',
    'creditUnits', (v_price->>'creditUnits')::integer,
    'creditCost', (v_price->>'creditCost')::numeric,
    'memberAvailableCredits', fairway_available_credits(p_member_profile_id),
    'sufficientCredits', v_available_units >= (v_price->>'creditUnits')::integer,
    'options', v_options
  );
end;
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
  values (v_member_profile_id, 'grant', 48, 48, 'seed:test-birdie-monthly-grant:' || v_member_profile_id::text, 'TEST_BIRDIE monthly seed grant: 24 credits / 48 half-credit units', 'system')
  on conflict (idempotency_key) do nothing;

  insert into credit_ledger_entries (member_profile_id, entry_type, amount, balance_delta, idempotency_key, reason, actor_id)
  values (v_member_profile_id, 'grant', 200, 200, 'seed:development-100-credit-grant:' || v_member_profile_id::text, 'Development-only workflow exercise grant: 100 credits / 200 half-credit units', 'system')
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
    'membershipPlan', jsonb_build_object('id', plan.id, 'code', plan.code, 'name', plan.name, 'monthlyCredits', plan.monthly_credits, 'bookingWindowDays', plan.booking_window_days, 'maxActiveFutureReservations', plan.max_active_future_reservations, 'playNowEnabled', plan.play_now_enabled, 'guestAllowance', plan.guest_allowance),
    'availableCredits', fairway_available_credits(mp.id),
    'playNowQuote', fairway_quote_play_now(mp.id),
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
        'creditsCommitted', fairway_credit_units_to_credits(coalesce(commit_entry.amount, 0)),
        'canCancel', (r.status = 'confirmed' and r.start_at > now() and sess.id is null),
        'canCompleteSession', (r.status = 'checked_in' and sess.id is not null and sess.ended_at is null),
        'sessionStartedAt', sess.started_at,
        'sessionEndedAt', sess.ended_at,
        'guests', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', rg.id,
            'guestId', g.id,
            'displayName', g.full_name,
            'status', rg.status,
            'waiverStatus', coalesce(aa.status::text, 'not_requested'),
            'verificationState', coalesce(aa.verification_state, 'pending'),
            'agreementVersion', av.version,
            'ready', fairway_guest_ready(rg.id),
            'accessEligible', fairway_guest_access_eligible(rg.id, now()),
            'createdAt', rg.created_at,
            'removedAt', rg.removed_at
          ) order by rg.created_at)
          from reservation_guests rg
          join guests g on g.id = rg.guest_id
          left join lateral (select * from agreement_acceptances aa where aa.guest_id = g.id order by aa.created_at desc limit 1) aa on true
          left join agreement_versions av on av.id = aa.agreement_version_id
          where rg.reservation_id = r.id
        ), '[]'::jsonb),
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
  v_requested_minutes integer;
  v_active_future_count integer;
  v_available_units integer;
  v_price jsonb;
  v_credit_units integer;
  v_hold_id uuid;
  v_reservation reservations%rowtype;
  v_quote jsonb;
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

  if p_booking_mode = 'PLAY_NOW' then
    if not v_location.play_now_enabled or not v_plan.play_now_enabled then raise exception 'PLAY_NOW_DISABLED'; end if;
    v_requested_minutes := coalesce(p_requested_minutes, 60);
    v_quote := fairway_quote_play_now(p_member_profile_id, v_requested_minutes, p_now);
    if not coalesce((v_quote->>'available')::boolean, false) then raise exception '%', coalesce(v_quote->>'blockedReason', 'NO_SUITE_AVAILABLE'); end if;
    if not coalesce((v_quote->>'sufficientCredits')::boolean, false) then raise exception 'INSUFFICIENT_CREDITS'; end if;
    v_suite_id := (v_quote->>'suiteId')::uuid;
    v_start_at := p_now;
    v_end_at := p_now + make_interval(mins => (v_quote->>'durationMinutes')::integer);
    v_price := jsonb_build_object('demandBand', v_quote->>'demandBand', 'creditUnits', (v_quote->>'creditUnits')::integer, 'creditCost', (v_quote->>'creditCost')::numeric);
  else
    v_suite_id := p_suite_id;
    v_start_at := p_start_at;
    v_end_at := p_end_at;

    if v_start_at is null or v_end_at is null then raise exception 'RESERVATION_TIME_REQUIRED'; end if;
    if p_booking_mode = 'ADVANCE' then
      select count(*) into v_active_future_count
      from reservations
      where member_profile_id = p_member_profile_id and status = 'confirmed' and start_at > p_now;
      if v_active_future_count >= v_plan.max_active_future_reservations then raise exception 'ACTIVE_RESERVATION_LIMIT_REACHED'; end if;
      if v_start_at > p_now + make_interval(days => v_plan.booking_window_days) then raise exception 'BOOKING_WINDOW_EXCEEDED'; end if;
    end if;
    v_price := fairway_reservation_price(v_location.id, v_start_at, floor(extract(epoch from (v_end_at - v_start_at)) / 60)::integer);
  end if;

  if v_suite_id is null then raise exception 'SUITE_REQUIRED'; end if;
  if v_end_at <= v_start_at then raise exception 'INVALID_RESERVATION_TIME'; end if;
  if floor(extract(epoch from (v_end_at - v_start_at)) / 60)::integer % v_location.booking_increment_minutes <> 0 then raise exception 'INVALID_BOOKING_INCREMENT'; end if;

  if not exists (select 1 from suites where id = v_suite_id and location_id = v_location.id and status = 'available') then
    raise exception 'SUITE_NOT_AVAILABLE';
  end if;

  if exists (select 1 from reservations where suite_id = v_suite_id and status in ('held', 'confirmed', 'checked_in') and tstzrange(start_at, end_at, '[)') && tstzrange(v_start_at, v_end_at, '[)')) then
    raise exception 'RESERVATION_CONFLICT';
  end if;

  v_credit_units := (v_price->>'creditUnits')::integer;
  select fairway_available_credit_units(p_member_profile_id) into v_available_units;
  if v_available_units < v_credit_units then raise exception 'INSUFFICIENT_CREDITS'; end if;

  insert into credit_ledger_entries (member_profile_id, entry_type, amount, balance_delta, idempotency_key, reason, actor_id)
  values (p_member_profile_id, 'hold', v_credit_units, 0, p_idempotency_key || ':credit-hold', p_booking_mode::text || ' reservation credit hold', p_member_profile_id::text)
  returning id into v_hold_id;

  insert into reservations (location_id, suite_id, member_profile_id, booking_mode, status, start_at, end_at, credit_hold_entry_id, idempotency_key)
  values (v_location.id, v_suite_id, p_member_profile_id, p_booking_mode, 'confirmed', v_start_at, v_end_at, v_hold_id, p_idempotency_key)
  returning * into v_reservation;

  insert into credit_ledger_entries (member_profile_id, entry_type, amount, balance_delta, related_entry_id, idempotency_key, reason, actor_id)
  values (p_member_profile_id, 'commit', v_credit_units, -v_credit_units, v_hold_id, p_idempotency_key || ':credit-commit', p_booking_mode::text || ' reservation credit commit', p_member_profile_id::text);

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('reservation.created', p_member_profile_id::text, v_reservation.id::text, p_booking_mode::text || ' reservation created', p_idempotency_key || ':audit-reservation-created', jsonb_build_object('demandBand', v_price->>'demandBand', 'creditUnits', v_credit_units, 'creditCost', (v_price->>'creditCost')::numeric))
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('reservation', row_to_json(v_reservation), 'idempotent', false, 'price', v_price);
exception
  when exclusion_violation or unique_violation then
    raise exception 'RESERVATION_CONFLICT';
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
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;

  select * into v_reservation from reservations where id = p_reservation_id and member_profile_id = p_member_profile_id for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;

  if v_reservation.status = 'cancelled' then
    select * into v_access from access_grants where reservation_id = v_reservation.id;
    return jsonb_build_object('reservation', row_to_json(v_reservation), 'accessGrant', case when v_access.id is null then null else row_to_json(v_access) end, 'availableCredits', fairway_available_credits(p_member_profile_id), 'refundedCredits', 0, 'idempotent', true);
  end if;

  if v_reservation.status = 'checked_in' or exists (select 1 from sessions where reservation_id = v_reservation.id) then raise exception 'SESSION_ALREADY_STARTED'; end if;
  if v_reservation.status <> 'confirmed' then raise exception 'RESERVATION_NOT_CANCELLABLE'; end if;
  if v_reservation.start_at <= p_now then raise exception 'RESERVATION_CANCELLATION_CUTOFF_PASSED'; end if;

  select * into v_commit from credit_ledger_entries where member_profile_id = p_member_profile_id and related_entry_id = v_reservation.credit_hold_entry_id and entry_type = 'commit';
  if not found then raise exception 'CREDIT_COMMIT_NOT_FOUND'; end if;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key)
  values ('reservation.cancellation.requested', p_member_profile_id::text, v_reservation.id::text, v_reason, 'reservation:' || v_reservation.id::text || ':audit-cancellation-requested')
  on conflict (idempotency_key) do nothing;

  update reservations set status = 'cancelled', cancelled_at = p_now, cancellation_reason = v_reason where id = v_reservation.id returning * into v_reservation;

  insert into credit_ledger_entries (member_profile_id, entry_type, amount, balance_delta, related_entry_id, idempotency_key, reason, actor_id)
  values (p_member_profile_id, 'refund', v_commit.amount, v_commit.amount, v_commit.id, 'reservation:' || v_reservation.id::text || ':credit-refund', v_reason, p_member_profile_id::text)
  on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning * into v_refund;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('credit.compensated', p_member_profile_id::text, v_refund.id::text, 'Reservation cancellation credit refund recorded', 'reservation:' || v_reservation.id::text || ':audit-credit-compensated', jsonb_build_object('creditUnits', v_refund.amount, 'creditCost', fairway_credit_units_to_credits(v_refund.amount)))
  on conflict (idempotency_key) do nothing;

  update access_grants set status = 'revoked', revoked_at = p_now, revocation_reason = 'Reservation cancelled' where reservation_id = v_reservation.id and status = 'active' returning * into v_access;

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

  return jsonb_build_object('reservation', row_to_json(v_reservation), 'accessGrant', case when v_access.id is null then null else row_to_json(v_access) end, 'availableCredits', fairway_available_credits(p_member_profile_id), 'refundedCredits', fairway_credit_units_to_credits(v_refund.amount), 'idempotent', false);
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

  if v_reservation.status = 'checked_in' or exists (select 1 from sessions where reservation_id = v_reservation.id) then raise exception 'SESSION_ALREADY_STARTED_OPERATOR_WORKFLOW_UNRESOLVED'; end if;
  if v_reservation.status <> 'confirmed' then raise exception 'RESERVATION_NOT_CANCELLABLE'; end if;
  if v_reservation.start_at <= p_now then raise exception 'OPERATOR_CANCELLATION_CUTOFF_PASSED'; end if;

  select * into v_commit from credit_ledger_entries where member_profile_id = v_reservation.member_profile_id and related_entry_id = v_reservation.credit_hold_entry_id and entry_type = 'commit';
  if not found then raise exception 'CREDIT_COMMIT_NOT_FOUND'; end if;

  v_previous_status := v_reservation.status::text;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('operator.reservation.cancellation.requested', p_operator_member_profile_id::text, v_reservation.id::text, p_reason, p_idempotency_key || ':requested', jsonb_build_object('targetMemberProfileId', v_reservation.member_profile_id, 'previousStatus', v_previous_status))
  on conflict (idempotency_key) do nothing;

  update reservations set status = 'cancelled', cancelled_at = p_now, cancellation_reason = p_reason where id = v_reservation.id returning * into v_reservation;

  insert into credit_ledger_entries (member_profile_id, entry_type, amount, balance_delta, related_entry_id, idempotency_key, reason, actor_id)
  values (v_reservation.member_profile_id, 'refund', v_commit.amount, v_commit.amount, v_commit.id, 'reservation:' || v_reservation.id::text || ':credit-refund', p_reason, p_operator_member_profile_id::text)
  on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning * into v_refund;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('operator.credit.compensated', p_operator_member_profile_id::text, v_refund.id::text, p_reason, p_idempotency_key || ':credit-compensated', jsonb_build_object('reservationId', v_reservation.id, 'targetMemberProfileId', v_reservation.member_profile_id, 'creditUnits', v_refund.amount, 'creditCost', fairway_credit_units_to_credits(v_refund.amount)))
  on conflict (idempotency_key) do nothing;

  update access_grants set status = 'revoked', revoked_at = p_now, revocation_reason = 'Operator cancelled reservation: ' || p_reason where reservation_id = v_reservation.id and status = 'active' returning * into v_access;

  if v_access.id is not null then
    insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
    values ('operator.access.grant.revoked', p_operator_member_profile_id::text, v_access.id::text, p_reason, p_idempotency_key || ':access-revoked', jsonb_build_object('reservationId', v_reservation.id, 'previousStatus', 'active', 'newStatus', 'revoked'))
    on conflict (idempotency_key) do nothing;
  else
    select * into v_access from access_grants where reservation_id = v_reservation.id;
  end if;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('operator.reservation.cancelled', p_operator_member_profile_id::text, v_reservation.id::text, p_reason, p_idempotency_key, jsonb_build_object('targetMemberProfileId', v_reservation.member_profile_id, 'previousStatus', v_previous_status, 'newStatus', 'cancelled'))
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('reservation', row_to_json(v_reservation), 'accessGrant', case when v_access.id is null then null else row_to_json(v_access) end, 'availableCredits', fairway_available_credits(v_reservation.member_profile_id), 'refundedCredits', fairway_credit_units_to_credits(v_refund.amount), 'idempotent', false);
end;
$$;




