import { Client } from "pg";
import { loadDemoUniverseModule, loadEnvFile, printSummary } from "./demo-universe-loader.mjs";

const args = new Set(process.argv.slice(2));
const scenarioArg = process.argv.find((arg) => arg.startsWith("--scenario="));
const scenario = scenarioArg?.split("=")[1] ?? process.env.FAIRWAY_DEMO_SCENARIO ?? "normal";
const confirmed = args.has("--yes") || process.env.FAIRWAY_DEMO_RESET_CONFIRM === "RESET_FAIRWAY_DEMO";
if (!confirmed) {
  console.error("Cannot reset Demo Universe without explicit confirmation. Re-run with --yes or FAIRWAY_DEMO_RESET_CONFIRM=RESET_FAIRWAY_DEMO.");
  process.exit(1);
}

const env = { ...loadEnvFile(), ...process.env };
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is required for pnpm demo:reset.");
  process.exit(1);
}
if (/prod|production/i.test(env.DATABASE_URL) && process.env.FAIRWAY_ALLOW_PRODUCTION_DEMO_RESET !== "I_UNDERSTAND_THE_RISK") {
  console.error("Refusing to reset a DATABASE_URL that appears production-like.");
  process.exit(1);
}

const demo = await loadDemoUniverseModule();
const universe = demo.buildDemoUniverse({ scenario });
const integrity = demo.verifyDemoUniverse(universe);
if (!integrity.ok) {
  printSummary(demo.summarizeDemoUniverse(universe), integrity);
  process.exit(1);
}

const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("begin");
  await resetDemoRows(client);
  await seedUniverse(client, demo, universe);
  await client.query("commit");
} catch (error) {
  await client.query("rollback");
  console.error(`Demo reset failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}

if (process.exitCode !== 1) printSummary(demo.summarizeDemoUniverse(universe), integrity);

async function resetDemoRows(db) {
  await db.query("select fairway_seed_location_one()");
  await db.query(`
    with demo_people as (
      select id from people where email::text like 'fairway-demo-%@example.com' or email::text like 'fairway-ux-%@example.com'
    ), demo_profiles as (
      select id from member_profiles where person_id in (select id from demo_people)
    ), demo_reservations as (
      select id from reservations where member_profile_id in (select id from demo_profiles) or idempotency_key like 'du1:%'
    ), demo_sessions as (
      select id from sessions where member_profile_id in (select id from demo_profiles) or idempotency_key like 'du1:%'
    ), demo_guests as (
      select id from guests where email::text like 'fairway-demo-guest-%@example.com'
    )
    delete from domain_events where idempotency_key like 'du1:%' or actor_id in (select id::text from demo_profiles)
  `);
  await db.query(`
    with demo_people as (select id from people where email::text like 'fairway-demo-%@example.com' or email::text like 'fairway-ux-%@example.com'),
    demo_profiles as (select id from member_profiles where person_id in (select id from demo_people)),
    demo_reservations as (select id from reservations where member_profile_id in (select id from demo_profiles) or idempotency_key like 'du1:%'),
    demo_sessions as (select id from sessions where member_profile_id in (select id from demo_profiles) or idempotency_key like 'du1:%'),
    demo_guests as (select id from guests where email::text like 'fairway-demo-guest-%@example.com')
    delete from reservation_guests where reservation_id in (select id from demo_reservations) or host_member_profile_id in (select id from demo_profiles) or guest_id in (select id from demo_guests)
  `);
  await db.query("delete from agreement_acceptances where guest_id in (select id from guests where email::text like 'fairway-demo-guest-%@example.com')");
  await db.query("delete from guests where email::text like 'fairway-demo-guest-%@example.com'");
  await db.query("delete from facility_tasks where idempotency_key like 'du1:%' or source_reservation_id in (select r.id from reservations r join member_profiles mp on mp.id = r.member_profile_id join people p on p.id = mp.person_id where p.email::text like 'fairway-demo-%@example.com' or p.email::text like 'fairway-ux-%@example.com')");
  await db.query("delete from access_grants where idempotency_key like 'du1:%' or reservation_id in (select r.id from reservations r join member_profiles mp on mp.id = r.member_profile_id join people p on p.id = mp.person_id where p.email::text like 'fairway-demo-%@example.com' or p.email::text like 'fairway-ux-%@example.com')");
  await db.query("delete from sessions where idempotency_key like 'du1:%' or member_profile_id in (select mp.id from member_profiles mp join people p on p.id = mp.person_id where p.email::text like 'fairway-demo-%@example.com' or p.email::text like 'fairway-ux-%@example.com')");
  await db.query("delete from reservations where idempotency_key like 'du1:%' or member_profile_id in (select mp.id from member_profiles mp join people p on p.id = mp.person_id where p.email::text like 'fairway-demo-%@example.com' or p.email::text like 'fairway-ux-%@example.com')");
  await db.query("delete from credit_ledger_entries where idempotency_key like 'du1:%' or member_profile_id in (select mp.id from member_profiles mp join people p on p.id = mp.person_id where p.email::text like 'fairway-demo-%@example.com' or p.email::text like 'fairway-ux-%@example.com')");
  await db.query("delete from role_assignments where member_profile_id in (select mp.id from member_profiles mp join people p on p.id = mp.person_id where p.email::text like 'fairway-demo-%@example.com' or p.email::text like 'fairway-ux-%@example.com')");
  await db.query("delete from memberships where member_profile_id in (select mp.id from member_profiles mp join people p on p.id = mp.person_id where p.email::text like 'fairway-demo-%@example.com' or p.email::text like 'fairway-ux-%@example.com')");
  await db.query("delete from auth_principals where person_id in (select id from people where email::text like 'fairway-demo-%@example.com' or email::text like 'fairway-ux-%@example.com')");
  await db.query("delete from member_profiles where person_id in (select id from people where email::text like 'fairway-demo-%@example.com' or email::text like 'fairway-ux-%@example.com')");
  await db.query("delete from people where email::text like 'fairway-demo-%@example.com' or email::text like 'fairway-ux-%@example.com'");
}

async function seedUniverse(db, demo, universe) {
  for (const location of universe.locations) {
    await db.query(
      `insert into locations (id, name, timezone, suite_count, minimum_session_minutes, booking_increment_minutes, turnover_buffer_minutes, access_before_minutes, access_after_minutes, play_now_enabled)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (id) do update set name=excluded.name, timezone=excluded.timezone, suite_count=excluded.suite_count, minimum_session_minutes=excluded.minimum_session_minutes, booking_increment_minutes=excluded.booking_increment_minutes, turnover_buffer_minutes=excluded.turnover_buffer_minutes, access_before_minutes=excluded.access_before_minutes, access_after_minutes=excluded.access_after_minutes, play_now_enabled=excluded.play_now_enabled`,
      [location.id, location.name, location.timezone, location.suiteCount, location.minimumSessionMinutes, location.bookingIncrementMinutes, location.turnoverBufferMinutes, location.accessBeforeMinutes, location.accessAfterMinutes, location.playNowEnabled],
    );
  }
  for (const plan of universe.membershipPlans) {
    await db.query(
      `insert into membership_plans (id, code, name, monthly_credits, booking_window_days, max_active_future_reservations, play_now_enabled, guest_allowance)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (code) do update set name=excluded.name, monthly_credits=excluded.monthly_credits, booking_window_days=excluded.booking_window_days, max_active_future_reservations=excluded.max_active_future_reservations, play_now_enabled=excluded.play_now_enabled, guest_allowance=excluded.guest_allowance`,
      [plan.id, plan.code, plan.name, plan.monthlyCredits, plan.bookingWindowDays, plan.maxActiveFutureReservations, plan.playNowEnabled, plan.guestAllowance],
    );
  }
  for (const state of universe.facilityState) {
    await db.query("update suites set status = $1 where id = $2", [state.status, state.suiteId]);
  }
  for (const member of universe.members) {
    await db.query("insert into people (id, email, display_name, created_at) values ($1,$2,$3,$4)", [member.personId, member.email, member.displayName, universe.metadata.clock]);
    await db.query("insert into member_profiles (id, person_id, home_location_id, member_number, created_at) values ($1,$2,$3,$4,$5)", [member.memberProfileId, member.personId, member.homeLocationId, member.memberNumber, universe.metadata.clock]);
    await db.query("insert into memberships (id, member_profile_id, membership_plan_id, status, started_at, created_at) values ($1,$2,(select id from membership_plans where code=$3),'active',$4,$4)", [demo.stableDemoUuid(`membership:${member.id}`), member.memberProfileId, member.membershipPlanCode, universe.metadata.clock]);
    if (member.role === "facilities") {
      await db.query("insert into role_assignments (member_profile_id, location_id, role, granted_by, reason, created_at) values ($1,$2,'facilities','du1','DU1 facilities persona',$3) on conflict (member_profile_id, location_id, role) do nothing", [member.memberProfileId, member.homeLocationId, universe.metadata.clock]);
    }
  }
  for (const member of universe.members) {
    const committedUnits = universe.reservations.filter((reservation) => reservation.memberProfileId === member.memberProfileId).reduce((sum, reservation) => sum + reservation.creditUnits, 0);
    const grantUnits = member.targetAvailableCreditUnits + committedUnits;
    await db.query("insert into credit_ledger_entries (id, member_profile_id, entry_type, amount, balance_delta, idempotency_key, reason, actor_id, created_at) values ($1,$2,'grant',$3,$3,$4,$5,'du1',$6)", [demo.stableDemoUuid(`credit:grant:${member.id}`), member.memberProfileId, grantUnits, `du1:credit:grant:${member.id}`, "DU1 deterministic demo credit grant in half-credit units", universe.metadata.clock]);
  }
  for (const reservation of universe.reservations) {
    const holdId = demo.stableDemoUuid(`credit:hold:${reservation.id}`);
    await db.query("insert into credit_ledger_entries (id, member_profile_id, entry_type, amount, balance_delta, idempotency_key, reason, actor_id, created_at) values ($1,$2,'hold',$3,0,$4,$5,$6,$7)", [holdId, reservation.memberProfileId, reservation.creditUnits, `${reservation.idempotencyKey}:credit-hold`, "DU1 reservation credit hold", reservation.memberProfileId, reservation.startAt]);
    await db.query("insert into reservations (id, location_id, suite_id, member_profile_id, booking_mode, status, start_at, end_at, credit_hold_entry_id, idempotency_key, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$7)", [reservation.id, reservation.locationId, reservation.suiteId, reservation.memberProfileId, reservation.bookingMode, reservation.status, reservation.startAt, reservation.endAt, holdId, reservation.idempotencyKey]);
    await db.query("insert into credit_ledger_entries (id, member_profile_id, entry_type, amount, balance_delta, related_entry_id, idempotency_key, reason, actor_id, created_at) values ($1,$2,'commit',$3,$4,$5,$6,$7,$8,$9)", [demo.stableDemoUuid(`credit:commit:${reservation.id}`), reservation.memberProfileId, reservation.creditUnits, -reservation.creditUnits, holdId, `${reservation.idempotencyKey}:credit-commit`, "DU1 reservation credit commit", reservation.memberProfileId, reservation.startAt]);
  }
  for (const session of universe.sessions) {
    await db.query("insert into sessions (id, reservation_id, member_profile_id, suite_id, started_at, ended_at, provider, external_session_id, idempotency_key, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$5)", [session.id, session.reservationId, session.memberProfileId, session.suiteId, session.startedAt, session.endedAt ?? null, session.provider, session.externalSessionId, `du1:session:${session.id}`]);
  }
  for (const grant of universe.accessGrants) {
    await db.query("insert into access_grants (id, reservation_id, member_profile_id, location_id, suite_id, provider, external_grant_id, starts_at, expires_at, status, idempotency_key, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$8)", [grant.id, grant.reservationId, grant.memberProfileId, grant.locationId, grant.suiteId, grant.provider, grant.externalGrantId, grant.startsAt, grant.expiresAt, grant.status, `du1:access:${grant.id}`]);
  }
  for (const task of universe.facilityTasks) {
    await db.query("insert into facility_tasks (id, location_id, suite_id, task_type, priority, status, source_reservation_id, source_session_id, due_at, idempotency_key, created_at, updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$9,$9)", [task.id, task.locationId, task.suiteId, task.taskType, task.priority, task.status, task.sourceReservationId ?? null, task.sourceSessionId ?? null, task.dueAt, task.idempotencyKey]);
  }
}
