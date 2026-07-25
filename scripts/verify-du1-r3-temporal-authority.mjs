import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { loadEnvFile } from "./demo-universe-loader.mjs";

const repoRoot = process.cwd();
const reviewRoot = process.env.FAIRWAY_DU1_REVIEW_ROOT ?? path.join("artifacts", "du1-remediation-r3-review");
const env = { ...loadEnvFile(), ...process.env, FAIRWAY_DU1_REVIEW_ROOT: reviewRoot };
const canonicalNow = new Date("2026-07-23T20:00:00.000Z");
const canonicalDue = new Date("2026-07-23T20:15:00.000Z");
if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const assertions = [];
const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await resetNormal();
  const identities = await identityFacts();
  const created = await client.query(
    "select fairway_create_reservation($1,'PLAY_NOW',null,null,null,60,null,$2,$3) result",
    [identities.tomId, "du1-r3:temporal:reservation", canonicalNow],
  );
  const reservation = created.rows[0].result.reservation;
  equal(new Date(reservation.start_at).toISOString(), canonicalNow.toISOString(), "Play Now starts at canonical clock");
  equal(reservation.suite_id, identities.suiteOneId, "canonical Play Now assigns Practice Suite 1");

  await client.query(
    "select fairway_record_access_grant($1,'fake','du1-r3-temporal-access',$2,$3,$4)",
    [
      reservation.id,
      new Date(canonicalNow.getTime() - 15 * 60_000),
      new Date(canonicalNow.getTime() + 75 * 60_000),
      "du1-r3:temporal:access",
    ],
  );
  await client.query(
    "select fairway_start_session($1,$2,'fake','du1-r3-temporal-session',$3,$4,$5)",
    [identities.tomId, reservation.id, canonicalNow, "du1-r3:temporal:start", canonicalNow],
  );

  const completed = await client.query(
    "select fairway_complete_session($1,$2,$3,$4) result",
    [identities.tomId, reservation.id, "du1-r3:temporal:complete", canonicalNow],
  );
  equal(completed.rows[0].result.idempotent, false, "first completion performs one transition");
  const retry = await client.query(
    "select fairway_complete_session($1,$2,$3,$4) result",
    [identities.tomId, reservation.id, "du1-r3:temporal:complete", new Date("2026-07-25T16:07:00.000Z")],
  );
  equal(retry.rows[0].result.idempotent, true, "completion retry remains idempotent despite different host instant");

  const facts = await completionFacts(reservation.id);
  equal(facts.reservationStatus, "completed", "reservation becomes completed");
  equal(new Date(facts.sessionEndedAt).toISOString(), canonicalNow.toISOString(), "session ended_at is canonical");
  equal(facts.accessStatus, "expired", "access is expired after completion");
  equal(facts.taskCount, 1, "exactly one turnover task exists");
  equal(facts.taskSourceReservationId, reservation.id, "turnover source reservation matches");
  equal(facts.taskSourceSessionId, facts.sessionId, "turnover source session matches");
  equal(new Date(facts.taskCreatedAt).toISOString(), canonicalNow.toISOString(), "task created_at is canonical");
  equal(new Date(facts.taskDueAt).toISOString(), canonicalDue.toISOString(), "task due_at is completion plus 15 minutes");
  equal(facts.nextReservationAt, null, "no later same-suite reservation exists");
  equal(facts.minutesUntilNextReservation, null, "same-suite service window is a long vacancy");
  equal(facts.windowLabel, "Long vacancy", "Facilities window renders Long vacancy");
  equal(facts.dueLabel, "3:15 PM", "Facilities due renders 3:15 PM Central");

  const taskId = facts.taskId;
  const claim = await client.query(
    "select fairway_claim_facility_task($1,$2,$3,$4) result",
    [identities.facilitiesId, taskId, "du1-r3:temporal:claim", canonicalNow],
  );
  equal(claim.rows[0].result.task.id, taskId, "claim preserves task identity");
  const start = await client.query(
    "select fairway_start_facility_task($1,$2,$3,$4) result",
    [identities.facilitiesId, taskId, "du1-r3:temporal:service-start", canonicalNow],
  );
  equal(start.rows[0].result.task.id, taskId, "start preserves task identity");
  const finish = await client.query(
    "select fairway_complete_facility_task($1,$2,$3,$4,$5) result",
    [identities.facilitiesId, taskId, "Temporal authority verifier", "du1-r3:temporal:service-complete", canonicalDue],
  );
  equal(finish.rows[0].result.task.id, taskId, "completion preserves task identity");
  equal(finish.rows[0].result.suite.status, "available", "Facilities completion restores Practice Suite 1");

  const finalFacts = await completionFacts(reservation.id);
  equal(finalFacts.taskCount, 1, "task lifecycle never duplicates turnover");
  equal(finalFacts.taskStatus, "completed", "turnover task completes");
  equal(finalFacts.suiteStatus, "available", "same suite returns to available inventory");

  const output = {
    gate: "DU1 R3 temporal authority",
    status: "PASS",
    canonicalClock: canonicalNow.toISOString(),
    hostClockAtExecution: new Date().toISOString(),
    hostClockDiffersFromCanonical: new Date().toISOString().slice(0, 10) !== canonicalNow.toISOString().slice(0, 10),
    reservationId: reservation.id,
    sessionId: finalFacts.sessionId,
    taskId,
    accessStatus: finalFacts.accessStatus,
    taskCreatedAt: new Date(finalFacts.taskCreatedAt).toISOString(),
    taskDueAt: new Date(finalFacts.taskDueAt).toISOString(),
    nextReservationAt: finalFacts.nextReservationAt,
    minutesUntilNextReservation: finalFacts.minutesUntilNextReservation,
    display: { window: finalFacts.windowLabel, due: finalFacts.dueLabel, timezone: "America/Chicago" },
    assertions,
  };
  const outputPath = path.join(repoRoot, reviewRoot, "reports", "temporal-authority.json");
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`DU1 R3 temporal authority: PASS (${assertions.length} assertions)`);
} finally {
  await client.end();
}

async function resetNormal() {
  const result = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "demo-reset.mjs"), "--scenario=normal", "--yes"], {
    cwd: repoRoot,
    env: { ...env, FAIRWAY_DEMO_RESET_CONFIRM: "RESET_FAIRWAY_DEMO" },
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) throw new Error(`Normal reset failed: ${result.error?.message ?? result.stderr}`);
}

async function identityFacts() {
  const result = await client.query(`
    select
      (select mp.id from member_profiles mp join people pe on pe.id = mp.person_id where pe.email = 'fairway-ux-demo-active-birdie@example.com') tom_id,
      (select mp.id from member_profiles mp join people pe on pe.id = mp.person_id where pe.email = 'fairway-ux-facilities-user@example.com') facilities_id,
      (select id from suites where name = 'Practice Suite 1' and location_id = '00000000-0000-0000-0000-000000000001') suite_one_id
  `);
  return {
    tomId: result.rows[0].tom_id,
    facilitiesId: result.rows[0].facilities_id,
    suiteOneId: result.rows[0].suite_one_id,
  };
}

async function completionFacts(reservationId) {
  const result = await client.query(`
    select
      r.status reservation_status,
      sess.id session_id,
      sess.ended_at session_ended_at,
      ag.status access_status,
      ft.id task_id,
      ft.status task_status,
      ft.source_reservation_id task_source_reservation_id,
      ft.source_session_id task_source_session_id,
      ft.created_at task_created_at,
      ft.due_at task_due_at,
      s.status suite_status,
      next_res.start_at next_reservation_at,
      case when next_res.start_at is null then null else floor(extract(epoch from (next_res.start_at - $2::timestamptz)) / 60)::int end minutes_until_next_reservation,
      count(*) over (partition by ft.source_session_id) task_count
    from reservations r
    join sessions sess on sess.reservation_id = r.id
    join access_grants ag on ag.reservation_id = r.id
    join facility_tasks ft on ft.source_session_id = sess.id and ft.task_type = 'turnover'
    join suites s on s.id = r.suite_id
    left join lateral (
      select future.start_at
      from reservations future
      where future.suite_id = r.suite_id
        and future.id <> r.id
        and future.status in ('held', 'confirmed')
        and future.start_at > $2::timestamptz
      order by future.start_at
      limit 1
    ) next_res on true
    where r.id = $1
  `, [reservationId, canonicalNow]);
  if (result.rowCount !== 1) throw new Error("Canonical completion facts missing.");
  const row = result.rows[0];
  return {
    reservationStatus: row.reservation_status,
    sessionId: row.session_id,
    sessionEndedAt: row.session_ended_at,
    accessStatus: row.access_status,
    taskId: row.task_id,
    taskStatus: row.task_status,
    taskSourceReservationId: row.task_source_reservation_id,
    taskSourceSessionId: row.task_source_session_id,
    taskCreatedAt: row.task_created_at,
    taskDueAt: row.task_due_at,
    suiteStatus: row.suite_status,
    nextReservationAt: row.next_reservation_at,
    minutesUntilNextReservation: row.minutes_until_next_reservation,
    taskCount: Number(row.task_count),
    windowLabel: row.next_reservation_at == null ? "Long vacancy" : `${row.minutes_until_next_reservation} min`,
    dueLabel: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(row.task_due_at),
  };
}

function equal(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
  assertions.push({ label, expected, actual, passed: true });
}
