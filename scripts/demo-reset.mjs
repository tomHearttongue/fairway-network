import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadDemoUniverseModule, loadEnvFile, printSummary } from "./demo-universe-loader.mjs";

const repoRoot = process.cwd();
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

const execution = {
  resetExecutionId: randomUUID(),
  scenario,
  version: universe.metadata.version,
  seed: universe.metadata.seed,
  clock: universe.metadata.clock,
  fingerprint: integrity.fingerprint,
  startedAt: new Date().toISOString(),
};
const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("begin");
  await resetDemoRows(client);
  await seedUniverse(client, universe);
  await client.query("commit");
  const reconciliation = await reconcilePersistedUniverse(client, universe);
  const receipt = { ...execution, completedAt: new Date().toISOString(), reconciliation };
  const reviewRoot = process.env.FAIRWAY_DU1_REVIEW_ROOT ?? path.join("artifacts", "du1-remediation-review");
  const runtime = path.join(repoRoot, reviewRoot, "runtime", scenario);
  const output = path.join(runtime, "reset-execution.json");
  const immutableOutput = path.join(runtime, "executions", `${execution.resetExecutionId}.json`);
  mkdirSync(path.dirname(immutableOutput), { recursive: true });
  writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
  writeFileSync(immutableOutput, `${JSON.stringify(receipt, null, 2)}\n`);
  printSummary(demo.summarizeDemoUniverse(universe), integrity);
  console.log(`Reset execution: ${execution.resetExecutionId}`);
  console.log(`Reconciliation: ${reconciliation.ok ? "PASS" : "FAIL"}`);
  if (!reconciliation.ok) process.exitCode = 1;
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  console.error(`Demo reset failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}

async function resetDemoRows(db) {
  await db.query("select fairway_seed_location_one()");
  const people = `(select id from people where email::text like 'fairway-demo-%@example.com' or email::text like 'fairway-ux-%@example.com')`;
  const profiles = `(select id from member_profiles where person_id in ${people})`;
  const reservations = `(select id from reservations where member_profile_id in ${profiles} or idempotency_key like 'du1:%')`;
  const sessions = `(select id from sessions where member_profile_id in ${profiles} or idempotency_key like 'du1:%')`;
  const guests = `(select id from guests where email::text like 'fairway-demo-guest-%@example.com')`;

  await db.query(`delete from audit_events where actor_id in (select id::text from member_profiles where id in ${profiles}) or idempotency_key like 'du1:%' or idempotency_key like 'du1-r2:%'`);
  await db.query(`delete from domain_events where idempotency_key like 'du1:%' or actor_id in (select id::text from member_profiles where id in ${profiles})`);
  await db.query(`delete from reservation_guests where reservation_id in ${reservations} or host_member_profile_id in ${profiles} or guest_id in ${guests}`);
  await db.query(`delete from agreement_acceptances where guest_id in ${guests}`);
  await db.query(`delete from guests where id in ${guests}`);
  await db.query(`delete from facility_tasks where idempotency_key like 'du1:%' or source_reservation_id in ${reservations} or source_session_id in ${sessions}`);
  await db.query(`delete from access_grants where reservation_id in ${reservations} or member_profile_id in ${profiles}`);
  await db.query(`delete from sessions where id in ${sessions}`);
  await db.query(`delete from reservations where id in ${reservations}`);
  await db.query(`delete from credit_ledger_entries where idempotency_key like 'du1:%' or member_profile_id in ${profiles}`);
  await db.query(`delete from role_assignments where member_profile_id in ${profiles}`);
  await db.query(`delete from memberships where member_profile_id in ${profiles}`);
  await db.query(`delete from auth_principals where person_id in ${people}`);
  await db.query(`delete from member_profiles where person_id in ${people}`);
  await db.query(`delete from people where id in ${people}`);
}

async function seedUniverse(db, universe) {
  for (const location of universe.locations) {
    await db.query(
      `insert into locations (id,name,timezone,suite_count,minimum_session_minutes,booking_increment_minutes,turnover_buffer_minutes,access_before_minutes,access_after_minutes,play_now_enabled)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (id) do update set name=excluded.name,timezone=excluded.timezone,suite_count=excluded.suite_count,minimum_session_minutes=excluded.minimum_session_minutes,booking_increment_minutes=excluded.booking_increment_minutes,turnover_buffer_minutes=excluded.turnover_buffer_minutes,access_before_minutes=excluded.access_before_minutes,access_after_minutes=excluded.access_after_minutes,play_now_enabled=excluded.play_now_enabled`,
      [location.id, location.name, location.timezone, location.suiteCount, location.minimumSessionMinutes, location.bookingIncrementMinutes, location.turnoverBufferMinutes, location.accessBeforeMinutes, location.accessAfterMinutes, location.playNowEnabled],
    );
  }
  for (const plan of universe.membershipPlans) {
    await db.query(
      `insert into membership_plans (id,code,name,monthly_credits,booking_window_days,max_active_future_reservations,play_now_enabled,guest_allowance)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (code) do update set name=excluded.name,monthly_credits=excluded.monthly_credits,booking_window_days=excluded.booking_window_days,max_active_future_reservations=excluded.max_active_future_reservations,play_now_enabled=excluded.play_now_enabled,guest_allowance=excluded.guest_allowance`,
      [plan.id, plan.code, plan.name, plan.monthlyCredits, plan.bookingWindowDays, plan.maxActiveFutureReservations, plan.playNowEnabled, plan.guestAllowance],
    );
  }
  for (const state of universe.facilityState) await db.query("update suites set status=$1 where id=$2", [state.status, state.suiteId]);

  for (const member of universe.members) {
    await db.query("insert into people (id,email,display_name,created_at) values ($1,$2,$3,$4)", [member.personId, member.email, member.displayName, member.personCreatedAt]);
    await db.query("insert into member_profiles (id,person_id,home_location_id,member_number,created_at) values ($1,$2,$3,$4,$5)", [member.memberProfileId, member.personId, member.homeLocationId, member.memberNumber, member.memberProfileCreatedAt]);
    if (member.role === "facilities") {
      await db.query("insert into role_assignments (member_profile_id,location_id,role,granted_by,reason,created_at) values ($1,$2,'facilities','du1','DU1 facilities-only persona',$3)", [member.memberProfileId, member.homeLocationId, member.memberProfileCreatedAt]);
    }
  }
  for (const membership of universe.memberships) {
    await db.query(
      "insert into memberships (id,member_profile_id,membership_plan_id,status,started_at,created_at) values ($1,$2,(select id from membership_plans where code=$3),$4,$5,$6)",
      [membership.id, membership.memberProfileId, membership.membershipPlanCode, membership.status, membership.startedAt, membership.createdAt],
    );
  }
  for (const entry of universe.creditLedgerEntries) {
    await db.query(
      "insert into credit_ledger_entries (id,member_profile_id,entry_type,amount,balance_delta,related_entry_id,idempotency_key,reason,actor_id,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [entry.id, entry.memberProfileId, entry.entryType, entry.amountUnits, entry.balanceDeltaUnits, entry.relatedEntryId ?? null, entry.idempotencyKey, entry.reason, entry.actorId, entry.createdAt],
    );
  }
  for (const reservation of universe.reservations) {
    const hold = universe.creditLedgerEntries.find((entry) => entry.reservationId === reservation.id && entry.entryType === "hold");
    await db.query(
      "insert into reservations (id,location_id,suite_id,member_profile_id,booking_mode,status,start_at,end_at,credit_hold_entry_id,idempotency_key,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [reservation.id, reservation.locationId, reservation.suiteId, reservation.memberProfileId, reservation.bookingMode, reservation.status, reservation.startAt, reservation.endAt, hold?.id ?? null, reservation.idempotencyKey, reservation.createdAt],
    );
  }
  for (const session of universe.sessions) {
    await db.query(
      "insert into sessions (id,reservation_id,member_profile_id,suite_id,started_at,ended_at,provider,external_session_id,idempotency_key,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [session.id, session.reservationId, session.memberProfileId, session.suiteId, session.startedAt, session.endedAt ?? null, session.provider, session.externalSessionId, `du1:session:${session.id}`, session.createdAt],
    );
  }
  for (const grant of universe.accessGrants) {
    await db.query(
      "insert into access_grants (id,reservation_id,member_profile_id,location_id,suite_id,provider,external_grant_id,starts_at,expires_at,status,idempotency_key,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      [grant.id, grant.reservationId, grant.memberProfileId, grant.locationId, grant.suiteId, grant.provider, grant.externalGrantId, grant.startsAt, grant.expiresAt, grant.status, `du1:access:${grant.id}`, grant.createdAt],
    );
  }
  for (const task of universe.facilityTasks) {
    await db.query(
      `insert into facility_tasks (id,location_id,suite_id,task_type,priority,status,source_reservation_id,source_session_id,claimed_by,claimed_at,started_at,completed_at,due_at,completion_notes,idempotency_key,created_at,updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [task.id, task.locationId, task.suiteId, task.taskType, task.priority, task.status, task.sourceReservationId ?? null, task.sourceSessionId ?? null, task.claimedByMemberProfileId ?? null, task.claimedAt ?? null, task.startedAt ?? null, task.completedAt ?? null, task.dueAt, task.completionNotes ?? null, task.idempotencyKey, task.createdAt, task.updatedAt],
    );
  }
  for (const version of universe.agreementVersions) {
    await db.query(
      `insert into agreement_versions (id,code,version,required_for,provider,status,effective_at,created_at)
       values ($1,$2,$3,'guest',$4,$5,$6,$7)
       on conflict (code,version) do update set provider=excluded.provider,status=excluded.status,effective_at=excluded.effective_at`,
      [version.id, version.code, version.version, version.provider, version.status, version.effectiveAt, version.createdAt],
    );
  }
  for (const guest of universe.guests) await db.query("insert into guests (id,full_name,email,created_at) values ($1,$2,$3,$4)", [guest.id, guest.fullName, guest.email, guest.createdAt]);
  for (const acceptance of universe.agreementAcceptances) {
    await db.query(
      "insert into agreement_acceptances (id,agreement_version_id,subject_type,guest_id,provider,status,requested_at,completed_at,evidence_reference,verification_state,idempotency_key,created_at) values ($1,$2,'guest',$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [acceptance.id, acceptance.agreementVersionId, acceptance.guestId, acceptance.provider, acceptance.status, acceptance.requestedAt, acceptance.completedAt ?? null, acceptance.evidenceReference, acceptance.verificationState, acceptance.idempotencyKey, acceptance.createdAt],
    );
  }
  for (const association of universe.reservationGuests) {
    await db.query(
      "insert into reservation_guests (id,reservation_id,session_id,host_member_profile_id,guest_id,status,idempotency_key,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8)",
      [association.id, association.reservationId, association.sessionId ?? null, association.hostMemberProfileId, association.guestId, association.status, association.idempotencyKey, association.createdAt],
    );
  }
}

async function reconcilePersistedUniverse(db, universe) {
  const profileIds = universe.members.map((member) => member.memberProfileId);
  const counts = await db.query(
    `select
      (select count(*)::int from member_profiles where id=any($1::uuid[])) profiles,
      (select count(*)::int from memberships where member_profile_id=any($1::uuid[])) memberships,
      (select count(*)::int from credit_ledger_entries where member_profile_id=any($1::uuid[])) ledger,
      (select count(*)::int from reservations where member_profile_id=any($1::uuid[])) reservations,
      (select count(*)::int from sessions where member_profile_id=any($1::uuid[])) sessions,
      (select count(*)::int from access_grants where member_profile_id=any($1::uuid[])) access_grants,
      (select count(*)::int from facility_tasks where idempotency_key like 'du1:%') facility_tasks,
      (select count(*)::int from reservation_guests where idempotency_key like 'du1:%') reservation_guests`,
    [profileIds],
  );
  const actual = counts.rows[0];
  const expected = {
    profiles: universe.members.length,
    memberships: universe.memberships.length,
    ledger: universe.creditLedgerEntries.length,
    reservations: universe.reservations.length,
    sessions: universe.sessions.length,
    access_grants: universe.accessGrants.length,
    facility_tasks: universe.facilityTasks.length,
    reservation_guests: universe.reservationGuests.length,
  };
  return { ok: Object.entries(expected).every(([key, value]) => actual[key] === value), expected, actual };
}
