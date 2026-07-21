create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create extension if not exists citext;

create type suite_status as enum ('available', 'occupied', 'turnover', 'inspection_required', 'maintenance', 'out_of_service', 'administrative_hold');
create type booking_mode as enum ('ADVANCE', 'PLAY_NOW', 'OPERATOR', 'INSTRUCTOR');
create type reservation_status as enum ('held', 'confirmed', 'checked_in', 'cancelled', 'completed');
create type credit_entry_type as enum ('grant', 'hold', 'commit', 'release', 'refund', 'expiration', 'adjustment');

create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null,
  suite_count integer not null check (suite_count > 0),
  minimum_session_minutes integer not null check (minimum_session_minutes > 0),
  booking_increment_minutes integer not null check (booking_increment_minutes > 0),
  turnover_buffer_minutes integer not null check (turnover_buffer_minutes >= 0),
  access_before_minutes integer not null check (access_before_minutes >= 0),
  access_after_minutes integer not null check (access_after_minutes >= 0),
  play_now_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table suites (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  name text not null,
  status suite_status not null default 'available',
  created_at timestamptz not null default now(),
  unique (location_id, name)
);

create table people (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table auth_principals (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  person_id uuid not null references people(id),
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table member_profiles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id),
  home_location_id uuid not null references locations(id),
  member_number text unique not null,
  created_at timestamptz not null default now()
);

create table membership_plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  monthly_credits integer not null check (monthly_credits >= 0),
  booking_window_days integer not null check (booking_window_days >= 0),
  max_active_future_reservations integer not null check (max_active_future_reservations >= 0),
  play_now_enabled boolean not null,
  guest_allowance integer not null check (guest_allowance >= 0),
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  member_profile_id uuid not null references member_profiles(id),
  membership_plan_id uuid not null references membership_plans(id),
  status text not null check (status in ('active', 'suspended', 'cancelled')),
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table credit_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  member_profile_id uuid not null references member_profiles(id),
  entry_type credit_entry_type not null,
  amount integer not null check (amount > 0),
  balance_delta integer not null,
  related_entry_id uuid references credit_ledger_entries(id),
  idempotency_key text unique not null,
  reason text not null,
  actor_id text,
  created_at timestamptz not null default now()
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  suite_id uuid not null references suites(id),
  member_profile_id uuid not null references member_profiles(id),
  booking_mode booking_mode not null,
  status reservation_status not null default 'confirmed',
  start_at timestamptz not null,
  end_at timestamptz not null,
  credit_hold_entry_id uuid references credit_ledger_entries(id),
  created_at timestamptz not null default now(),
  check (end_at > start_at),
  exclude using gist (suite_id with =, tstzrange(start_at, end_at, '[)') with &&) where (status in ('held', 'confirmed', 'checked_in'))
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id),
  member_profile_id uuid not null references member_profiles(id),
  suite_id uuid not null references suites(id),
  started_at timestamptz not null,
  ended_at timestamptz,
  provider text not null,
  external_session_id text,
  created_at timestamptz not null default now()
);

create table access_grants (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id),
  member_profile_id uuid not null references member_profiles(id),
  location_id uuid not null references locations(id),
  suite_id uuid not null references suites(id),
  provider text not null,
  external_grant_id text,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  actor_id text not null,
  resource_id text not null,
  reason text not null,
  created_at timestamptz not null default now()
);
