do $$ begin
  create type reservation_guest_status as enum ('active', 'removed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type agreement_acceptance_status as enum ('requested', 'completed', 'verified', 'revoked');
exception when duplicate_object then null;
end $$;

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email citext,
  created_at timestamptz not null default now(),
  unique (email)
);

create table if not exists agreement_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version text not null,
  required_for text not null check (required_for in ('guest')),
  provider text not null,
  status text not null check (status in ('active', 'retired')),
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (code, version)
);

create table if not exists agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  agreement_version_id uuid not null references agreement_versions(id),
  subject_type text not null check (subject_type in ('guest')),
  guest_id uuid not null references guests(id),
  provider text not null,
  status agreement_acceptance_status not null,
  requested_at timestamptz,
  completed_at timestamptz,
  evidence_reference text,
  verification_state text not null check (verification_state in ('pending', 'verified', 'rejected')) default 'pending',
  idempotency_key text unique not null,
  created_at timestamptz not null default now(),
  unique (agreement_version_id, guest_id)
);

create table if not exists reservation_guests (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id),
  session_id uuid references sessions(id),
  host_member_profile_id uuid not null references member_profiles(id),
  guest_id uuid not null references guests(id),
  status reservation_guest_status not null default 'active',
  idempotency_key text unique not null,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reservation_id, guest_id)
);

create table if not exists domain_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  actor_id text not null,
  occurred_at timestamptz not null default now(),
  idempotency_key text unique not null,
  dimensions jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function fairway_seed_guest_agreement()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into agreement_versions (id, code, version, required_for, provider, status, effective_at)
  values ('00000000-0000-0000-0000-000000000501', 'GUEST_WAIVER', 'dev-2026-07', 'guest', 'fake', 'active', now())
  on conflict (code, version) do update set status = 'active'
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function fairway_record_domain_event(
  p_event_name text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_actor_id text,
  p_idempotency_key text,
  p_dimensions jsonb default '{}'::jsonb,
  p_payload jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into domain_events (event_name, aggregate_type, aggregate_id, actor_id, idempotency_key, dimensions, payload, occurred_at)
  values (p_event_name, p_aggregate_type, p_aggregate_id, p_actor_id, p_idempotency_key, coalesce(p_dimensions, '{}'::jsonb), coalesce(p_payload, '{}'::jsonb), p_occurred_at)
  on conflict (idempotency_key) do nothing;
end;
$$;

create or replace function fairway_active_guest_agreement_version()
returns agreement_versions
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_agreement agreement_versions%rowtype;
begin
  perform fairway_seed_guest_agreement();
  select * into v_agreement from agreement_versions where code = 'GUEST_WAIVER' and required_for = 'guest' and status = 'active' order by effective_at desc limit 1;
  return v_agreement;
end;
$$;

create or replace function fairway_guest_ready(p_reservation_guest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select rg.status = 'active'
    and r.status in ('confirmed', 'checked_in')
    and exists (
      select 1
      from agreement_acceptances aa
      join agreement_versions av on av.id = aa.agreement_version_id
      where aa.guest_id = rg.guest_id
        and av.code = 'GUEST_WAIVER'
        and av.status = 'active'
        and aa.status in ('completed', 'verified')
        and aa.verification_state = 'verified'
    )
  from reservation_guests rg
  join reservations r on r.id = rg.reservation_id
  where rg.id = p_reservation_guest_id;
$$;

create or replace function fairway_guest_access_eligible(p_reservation_guest_id uuid, p_now timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select fairway_guest_ready(rg.id)
    and ag.status = 'active'
    and p_now >= ag.starts_at
    and p_now < ag.expires_at
  from reservation_guests rg
  join access_grants ag on ag.reservation_id = rg.reservation_id
  where rg.id = p_reservation_guest_id and rg.status = 'active';
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

create or replace function fairway_add_reservation_guest(
  p_host_member_profile_id uuid,
  p_reservation_id uuid,
  p_guest_name text,
  p_guest_email text,
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
  v_plan membership_plans%rowtype;
  v_guest guests%rowtype;
  v_rg reservation_guests%rowtype;
  v_active_count integer;
  v_existing reservation_guests%rowtype;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if p_guest_name is null or length(trim(p_guest_name)) = 0 then raise exception 'GUEST_NAME_REQUIRED'; end if;

  select * into v_existing from reservation_guests where idempotency_key = p_idempotency_key;
  if found then return jsonb_build_object('reservationGuest', row_to_json(v_existing), 'guest', (select row_to_json(g) from guests g where g.id = v_existing.guest_id), 'ready', fairway_guest_ready(v_existing.id), 'idempotent', true); end if;

  select * into v_reservation from reservations where id = p_reservation_id and member_profile_id = p_host_member_profile_id for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if v_reservation.status not in ('confirmed', 'checked_in') then raise exception 'RESERVATION_NOT_GUEST_ELIGIBLE'; end if;

  select plan.* into v_plan
  from memberships mem join membership_plans plan on plan.id = mem.membership_plan_id
  where mem.member_profile_id = p_host_member_profile_id and mem.status = 'active' and mem.ended_at is null;
  if not found then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED'; end if;

  select count(*) into v_active_count from reservation_guests where reservation_id = p_reservation_id and status = 'active';
  if v_active_count >= v_plan.guest_allowance then
    perform fairway_record_domain_event('guest.allowance_rejected', 'reservation', p_reservation_id, p_host_member_profile_id::text, p_idempotency_key || ':event-allowance-rejected', jsonb_build_object('location_id', v_reservation.location_id, 'reservation_id', p_reservation_id, 'host_member_profile_id', p_host_member_profile_id, 'membership_plan_id', v_plan.id, 'failure_reason', 'GUEST_ALLOWANCE_EXCEEDED'), '{}'::jsonb, p_now);
    raise exception 'GUEST_ALLOWANCE_EXCEEDED';
  end if;

  if p_guest_email is not null and length(trim(p_guest_email)) > 0 then
    insert into guests (full_name, email) values (trim(p_guest_name), lower(trim(p_guest_email))::citext)
    on conflict (email) do update set full_name = excluded.full_name
    returning * into v_guest;
  else
    insert into guests (full_name) values (trim(p_guest_name)) returning * into v_guest;
  end if;

  insert into reservation_guests (reservation_id, session_id, host_member_profile_id, guest_id, status, idempotency_key)
  values (p_reservation_id, (select id from sessions where reservation_id = p_reservation_id limit 1), p_host_member_profile_id, v_guest.id, 'active', p_idempotency_key)
  on conflict (reservation_id, guest_id) do update set status = 'active', removed_at = null
  returning * into v_rg;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('guest.associated', p_host_member_profile_id::text, v_rg.id::text, 'Guest associated with reservation', p_idempotency_key || ':audit-associated', jsonb_build_object('reservationId', p_reservation_id, 'guestId', v_guest.id, 'hostMemberProfileId', p_host_member_profile_id))
  on conflict (idempotency_key) do nothing;

  perform fairway_record_domain_event('guest.invited', 'reservation_guest', v_rg.id, p_host_member_profile_id::text, p_idempotency_key || ':event-invited', jsonb_build_object('location_id', v_reservation.location_id, 'reservation_id', p_reservation_id, 'host_member_profile_id', p_host_member_profile_id, 'guest_id', v_guest.id, 'membership_plan_id', v_plan.id), '{}'::jsonb, p_now);
  perform fairway_record_domain_event('guest.associated', 'reservation_guest', v_rg.id, p_host_member_profile_id::text, p_idempotency_key || ':event-associated', jsonb_build_object('location_id', v_reservation.location_id, 'reservation_id', p_reservation_id, 'host_member_profile_id', p_host_member_profile_id, 'guest_id', v_guest.id, 'membership_plan_id', v_plan.id), '{}'::jsonb, p_now);

  return jsonb_build_object('reservationGuest', row_to_json(v_rg), 'guest', row_to_json(v_guest), 'ready', fairway_guest_ready(v_rg.id), 'idempotent', false);
end;
$$;


create or replace function fairway_record_guest_allowance_rejection(
  p_host_member_profile_id uuid,
  p_reservation_id uuid,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation reservations%rowtype;
  v_plan membership_plans%rowtype;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  select * into v_reservation from reservations where id = p_reservation_id and member_profile_id = p_host_member_profile_id;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  select plan.* into v_plan
  from memberships mem join membership_plans plan on plan.id = mem.membership_plan_id
  where mem.member_profile_id = p_host_member_profile_id and mem.status = 'active' and mem.ended_at is null;
  if not found then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED'; end if;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('guest.allowance_rejected', p_host_member_profile_id::text, p_reservation_id::text, 'Guest allowance exceeded', p_idempotency_key || ':audit-allowance-rejected', jsonb_build_object('reservationId', p_reservation_id, 'membershipPlanId', v_plan.id, 'failureReason', 'GUEST_ALLOWANCE_EXCEEDED'))
  on conflict (idempotency_key) do nothing;

  perform fairway_record_domain_event('guest.allowance_rejected', 'reservation', p_reservation_id, p_host_member_profile_id::text, p_idempotency_key || ':event-allowance-rejected', jsonb_build_object('location_id', v_reservation.location_id, 'reservation_id', p_reservation_id, 'host_member_profile_id', p_host_member_profile_id, 'membership_plan_id', v_plan.id, 'failure_reason', 'GUEST_ALLOWANCE_EXCEEDED'), '{}'::jsonb, p_now);
end;
$$;
create or replace function fairway_request_guest_waiver(
  p_host_member_profile_id uuid,
  p_reservation_guest_id uuid,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rg reservation_guests%rowtype;
  v_reservation reservations%rowtype;
  v_agreement agreement_versions%rowtype;
  v_acceptance agreement_acceptances%rowtype;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  select * into v_rg from reservation_guests where id = p_reservation_guest_id and host_member_profile_id = p_host_member_profile_id and status = 'active';
  if not found then raise exception 'RESERVATION_GUEST_NOT_FOUND'; end if;
  select * into v_reservation from reservations where id = v_rg.reservation_id;
  select * into v_agreement from fairway_active_guest_agreement_version();

  insert into agreement_acceptances (agreement_version_id, subject_type, guest_id, provider, status, requested_at, evidence_reference, verification_state, idempotency_key)
  values (v_agreement.id, 'guest', v_rg.guest_id, 'fake', 'requested', p_now, 'fake-waiver-request-' || v_rg.id::text, 'pending', p_idempotency_key)
  on conflict (agreement_version_id, guest_id) do update set requested_at = coalesce(agreement_acceptances.requested_at, excluded.requested_at)
  returning * into v_acceptance;

  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('guest.waiver_requested', p_host_member_profile_id::text, v_rg.id::text, 'Fake guest waiver requested', p_idempotency_key || ':audit-waiver-requested', jsonb_build_object('guestId', v_rg.guest_id, 'agreementVersionId', v_agreement.id))
  on conflict (idempotency_key) do nothing;
  perform fairway_record_domain_event('guest.waiver_requested', 'reservation_guest', v_rg.id, p_host_member_profile_id::text, p_idempotency_key || ':event-waiver-requested', jsonb_build_object('location_id', v_reservation.location_id, 'reservation_id', v_rg.reservation_id, 'host_member_profile_id', p_host_member_profile_id, 'guest_id', v_rg.guest_id, 'agreement_version_id', v_agreement.id, 'provider', 'fake'), '{}'::jsonb, p_now);

  return jsonb_build_object('reservationGuest', row_to_json(v_rg), 'acceptance', row_to_json(v_acceptance), 'agreementVersion', row_to_json(v_agreement), 'ready', fairway_guest_ready(v_rg.id));
end;
$$;

create or replace function fairway_complete_guest_waiver(
  p_host_member_profile_id uuid,
  p_reservation_guest_id uuid,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rg reservation_guests%rowtype;
  v_reservation reservations%rowtype;
  v_agreement agreement_versions%rowtype;
  v_acceptance agreement_acceptances%rowtype;
  v_ready boolean;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  select * into v_rg from reservation_guests where id = p_reservation_guest_id and host_member_profile_id = p_host_member_profile_id and status = 'active';
  if not found then raise exception 'RESERVATION_GUEST_NOT_FOUND'; end if;
  select * into v_reservation from reservations where id = v_rg.reservation_id;
  select * into v_agreement from fairway_active_guest_agreement_version();

  insert into agreement_acceptances (agreement_version_id, subject_type, guest_id, provider, status, requested_at, completed_at, evidence_reference, verification_state, idempotency_key)
  values (v_agreement.id, 'guest', v_rg.guest_id, 'fake', 'completed', coalesce((select requested_at from agreement_acceptances where agreement_version_id = v_agreement.id and guest_id = v_rg.guest_id), p_now), p_now, 'fake-waiver-evidence-' || v_rg.id::text, 'verified', p_idempotency_key)
  on conflict (agreement_version_id, guest_id) do update set status = 'completed', completed_at = coalesce(agreement_acceptances.completed_at, excluded.completed_at), verification_state = 'verified', evidence_reference = excluded.evidence_reference
  returning * into v_acceptance;

  v_ready := fairway_guest_ready(v_rg.id);
  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('guest.waiver_completed', p_host_member_profile_id::text, v_rg.id::text, 'Fake guest waiver completed and verified', p_idempotency_key || ':audit-waiver-completed', jsonb_build_object('guestId', v_rg.guest_id, 'agreementVersionId', v_agreement.id, 'evidenceReference', v_acceptance.evidence_reference))
  on conflict (idempotency_key) do nothing;
  perform fairway_record_domain_event('guest.waiver_completed', 'reservation_guest', v_rg.id, p_host_member_profile_id::text, p_idempotency_key || ':event-waiver-completed', jsonb_build_object('location_id', v_reservation.location_id, 'reservation_id', v_rg.reservation_id, 'host_member_profile_id', p_host_member_profile_id, 'guest_id', v_rg.guest_id, 'agreement_version_id', v_agreement.id, 'provider', 'fake'), '{}'::jsonb, p_now);
    if fairway_guest_access_eligible(v_rg.id, p_now) then
    perform fairway_record_domain_event('guest.access_eligible', 'reservation_guest', v_rg.id, p_host_member_profile_id::text, p_idempotency_key || ':event-access-eligible', jsonb_build_object('location_id', v_reservation.location_id, 'reservation_id', v_rg.reservation_id, 'host_member_profile_id', p_host_member_profile_id, 'guest_id', v_rg.guest_id), '{}'::jsonb, p_now);
  end if;

  return jsonb_build_object('reservationGuest', row_to_json(v_rg), 'acceptance', row_to_json(v_acceptance), 'agreementVersion', row_to_json(v_agreement), 'ready', v_ready, 'accessEligible', fairway_guest_access_eligible(v_rg.id, p_now));
end;
$$;

create or replace function fairway_check_guest_access_eligibility(
  p_host_member_profile_id uuid,
  p_reservation_guest_id uuid,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rg reservation_guests%rowtype;
  v_reservation reservations%rowtype;
  v_ready boolean;
  v_access_eligible boolean;
  v_blocked_reason text;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  select * into v_rg from reservation_guests where id = p_reservation_guest_id and host_member_profile_id = p_host_member_profile_id;
  if not found then raise exception 'RESERVATION_GUEST_NOT_FOUND'; end if;
  select * into v_reservation from reservations where id = v_rg.reservation_id;

  v_ready := coalesce(fairway_guest_ready(v_rg.id), false);
  v_access_eligible := coalesce(fairway_guest_access_eligible(v_rg.id, p_now), false);

  if v_rg.status <> 'active' then
    v_blocked_reason := 'GUEST_REMOVED';
  elsif not v_ready then
    v_blocked_reason := 'WAIVER_ACCEPTANCE_REQUIRED';
  elsif not v_access_eligible then
    v_blocked_reason := 'ACCESS_WINDOW_INACTIVE';
  end if;

  if v_access_eligible then
    insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
    values ('guest.access_eligible', p_host_member_profile_id::text, v_rg.id::text, 'Guest access prerequisites satisfied', p_idempotency_key || ':audit-access-eligible', jsonb_build_object('reservationId', v_rg.reservation_id, 'guestId', v_rg.guest_id))
    on conflict (idempotency_key) do nothing;
    perform fairway_record_domain_event('guest.access_eligible', 'reservation_guest', v_rg.id, p_host_member_profile_id::text, p_idempotency_key || ':event-access-eligible', jsonb_build_object('location_id', v_reservation.location_id, 'reservation_id', v_rg.reservation_id, 'host_member_profile_id', p_host_member_profile_id, 'guest_id', v_rg.guest_id), '{}'::jsonb, p_now);
  else
    insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
    values ('guest.access_blocked', p_host_member_profile_id::text, v_rg.id::text, coalesce(v_blocked_reason, 'Guest access blocked'), p_idempotency_key || ':audit-access-blocked', jsonb_build_object('reservationId', v_rg.reservation_id, 'guestId', v_rg.guest_id, 'blockedReason', v_blocked_reason))
    on conflict (idempotency_key) do nothing;
    perform fairway_record_domain_event('guest.access_blocked', 'reservation_guest', v_rg.id, p_host_member_profile_id::text, p_idempotency_key || ':event-access-blocked', jsonb_build_object('location_id', v_reservation.location_id, 'reservation_id', v_rg.reservation_id, 'host_member_profile_id', p_host_member_profile_id, 'guest_id', v_rg.guest_id, 'failure_reason', v_blocked_reason), '{}'::jsonb, p_now);
  end if;

  return jsonb_build_object('ready', v_ready, 'accessEligible', v_access_eligible, 'blockedReason', v_blocked_reason);
end;
$$;
create or replace function fairway_remove_reservation_guest(
  p_host_member_profile_id uuid,
  p_reservation_guest_id uuid,
  p_idempotency_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rg reservation_guests%rowtype;
  v_reservation reservations%rowtype;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  select * into v_rg from reservation_guests where id = p_reservation_guest_id and host_member_profile_id = p_host_member_profile_id for update;
  if not found then raise exception 'RESERVATION_GUEST_NOT_FOUND'; end if;
  select * into v_reservation from reservations where id = v_rg.reservation_id;
  if v_rg.status = 'removed' then return jsonb_build_object('reservationGuest', row_to_json(v_rg), 'idempotent', true); end if;

  update reservation_guests set status = 'removed', removed_at = p_now where id = v_rg.id returning * into v_rg;
  insert into audit_events (type, actor_id, resource_id, reason, idempotency_key, metadata)
  values ('guest.removed', p_host_member_profile_id::text, v_rg.id::text, 'Guest removed from reservation', p_idempotency_key || ':audit-removed', jsonb_build_object('reservationId', v_rg.reservation_id, 'guestId', v_rg.guest_id))
  on conflict (idempotency_key) do nothing;
  perform fairway_record_domain_event('guest.removed', 'reservation_guest', v_rg.id, p_host_member_profile_id::text, p_idempotency_key || ':event-removed', jsonb_build_object('location_id', v_reservation.location_id, 'reservation_id', v_rg.reservation_id, 'host_member_profile_id', p_host_member_profile_id, 'guest_id', v_rg.guest_id), '{}'::jsonb, p_now);
  return jsonb_build_object('reservationGuest', row_to_json(v_rg), 'idempotent', false);
end;
$$;
