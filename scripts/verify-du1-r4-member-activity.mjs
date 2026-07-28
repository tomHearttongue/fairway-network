import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { loadEnvFile } from "./demo-universe-loader.mjs";
import { buildDemoUniverse, deriveDemoGolfProfile, FAIRWAY_DEMO_CLOCK_ISO } from "../src/demo-universe/universe.ts";
import {
  projectMemberGolfProfile,
  selectHomeFeaturedReservation,
  sessionCompletionPresentation,
} from "../src/application/member-flow/member-activity.ts";

const repoRoot = process.cwd();
const reviewRoot = process.env.FAIRWAY_DU1_REVIEW_ROOT ?? path.join("artifacts", "du1-remediation-r4-review");
const env = { ...loadEnvFile(), ...process.env, FAIRWAY_DU1_REVIEW_ROOT: reviewRoot };
if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const canonicalNow = new Date(FAIRWAY_DEMO_CLOCK_ISO);
const assertions = [];
const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  resetNormal();
  const universe = buildDemoUniverse({ scenario: "normal" });
  const tom = universe.members.find((member) => member.id === "demo-tom");
  if (!tom) throw new Error("Demo Tom is missing.");
  const baseProfile = deriveDemoGolfProfile(universe, tom.memberProfileId);
  const identity = await identityFacts();
  const beforeFacts = await completedSessionFacts(identity.tomId);
  const beforeProfile = projectMemberGolfProfile({
    baseProfile,
    completedSessions: beforeFacts,
    seededSessionIds: new Set(universe.sessions.filter((session) => session.memberProfileId === tom.memberProfileId && session.endedAt).map((session) => session.id)),
  });
  equal(beforeProfile.completedSessionCount, 36, "pre-completion total is 36");
  equal(beforeProfile.recentActivity.length, 3, "pre-completion recent list has three rows");

  const created = await client.query(
    "select fairway_create_reservation($1,'PLAY_NOW',null,null,null,60,null,$2,$3) result",
    [identity.tomId, "du1-r4:activity:reservation", canonicalNow],
  );
  const reservation = created.rows[0].result.reservation;
  await client.query(
    "select fairway_record_access_grant($1,'fake','du1-r4-activity-access',$2,$3,$4)",
    [
      reservation.id,
      new Date(canonicalNow.getTime() - 15 * 60_000),
      new Date(canonicalNow.getTime() + 75 * 60_000),
      "du1-r4:activity:access",
    ],
  );
  const started = await client.query(
    "select fairway_start_session($1,$2,'fake','du1-r4-activity-session',$3,$4,$5) result",
    [identity.tomId, reservation.id, canonicalNow, "du1-r4:activity:start", canonicalNow],
  );
  const sessionId = started.rows[0].result.id;
  await client.query(
    "select fairway_complete_session($1,$2,$3,$4) result",
    [identity.tomId, reservation.id, "du1-r4:activity:complete", canonicalNow],
  );
  const retry = await client.query(
    "select fairway_complete_session($1,$2,$3,$4) result",
    [identity.tomId, reservation.id, "du1-r4:activity:complete", new Date("2026-07-25T16:07:00.000Z")],
  );
  equal(retry.rows[0].result.idempotent, true, "completion retry is idempotent");

  const afterFacts = await completedSessionFacts(identity.tomId);
  const afterProfile = projectMemberGolfProfile({
    baseProfile,
    completedSessions: afterFacts,
    seededSessionIds: new Set(universe.sessions.filter((session) => session.memberProfileId === tom.memberProfileId && session.endedAt).map((session) => session.id)),
  });
  equal(afterProfile.completedSessionCount, 37, "post-completion total is 37");
  equal(afterProfile.recentActivity.length, 3, "post-completion recent list remains three rows");
  equal(afterProfile.recentActivity[0].sessionId, sessionId, "runtime completion is newest activity");
  equal(afterProfile.recentActivity.filter((activity) => activity.sessionId === sessionId).length, 1, "runtime activity is not duplicated");
  equal(afterProfile.performance, beforeProfile.performance, "shot-derived baselines remain unchanged");

  const refreshedFacts = await completedSessionFacts(identity.tomId);
  equal(refreshedFacts.length, 37, "database refresh retains exactly 37 completed sessions");
  const completion = sessionCompletionPresentation({
    scheduledStartAt: reservation.start_at,
    scheduledEndAt: reservation.end_at,
    sessionStartedAt: canonicalNow,
    sessionEndedAt: canonicalNow,
  });
  equal(completion.scheduledDurationMinutes, 60, "scheduled duration is 60 minutes");
  equal(completion.elapsedDurationMinutes, 0, "elapsed duration follows session facts");
  equal(completion.bookingLabel, "60-minute booking", "completion wording identifies booking duration");

  const selectionRows = await memberReservationSelectionFacts(identity.tomId);
  const featured = selectHomeFeaturedReservation(selectionRows, reservation.id);
  equal(featured?.suiteName, "Practice Suite 10", "future Practice Suite 10 is featured");
  equal(featured?.status, "confirmed", "featured reservation remains confirmed");
  equal(featured?.startAt, "2026-07-23T21:30:00.000Z", "featured reservation starts at 4:30 PM Central");
  equal(featured?.accessStartsAt, "2026-07-23T21:15:00.000Z", "featured access opens at 4:15 PM Central");
  equal(featured?.id === reservation.id, false, "completed Practice Suite 1 is absent from Up next");

  validateStateBackedEvidencePaths();
  const output = {
    gate: "DU1 R4 member activity and completion",
    status: "PASS",
    runtime: {
      reservationId: reservation.id,
      sessionId,
      scheduledDurationMinutes: completion.scheduledDurationMinutes,
      sessionStartedAt: canonicalNow.toISOString(),
      sessionEndedAt: canonicalNow.toISOString(),
      elapsedDurationMinutes: completion.elapsedDurationMinutes,
      completionWording: completion.bookingLabel,
    },
    reconciliation: {
      before: activitySummary(beforeProfile),
      after: activitySummary(afterProfile),
      refreshedCompletedSessionCount: refreshedFacts.length,
      baselineBefore: beforeProfile.performance,
      baselineAfter: afterProfile.performance,
      featuredReservation: featured,
    },
    assertions,
  };
  const outputPath = path.join(repoRoot, reviewRoot, "reports", "member-activity-completion.json");
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`DU1 R4 member activity and completion: PASS (${assertions.length} assertions)`);
} finally {
  await client.end();
}

function resetNormal() {
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
      mp.id tom_id
    from member_profiles mp
    join people pe on pe.id = mp.person_id
    where pe.email = 'fairway-ux-demo-active-birdie@example.com'
  `);
  if (result.rowCount !== 1) throw new Error("Demo Tom identity is missing.");
  return { tomId: result.rows[0].tom_id };
}

async function completedSessionFacts(memberProfileId) {
  const result = await client.query(`
    select sess.id session_id, r.id reservation_id, r.booking_mode, s.name suite_name,
      r.start_at, r.end_at, sess.started_at, sess.ended_at
    from sessions sess
    join reservations r on r.id = sess.reservation_id
    join suites s on s.id = sess.suite_id
    where sess.member_profile_id = $1 and sess.ended_at is not null
    order by sess.ended_at desc, sess.id
  `, [memberProfileId]);
  return result.rows.map((row) => ({
    sessionId: row.session_id,
    reservationId: row.reservation_id,
    bookingMode: row.booking_mode,
    suiteName: row.suite_name,
    scheduledStartAt: row.start_at.toISOString(),
    scheduledEndAt: row.end_at.toISOString(),
    sessionStartedAt: row.started_at.toISOString(),
    sessionEndedAt: row.ended_at.toISOString(),
  }));
}

async function memberReservationSelectionFacts(memberProfileId) {
  const result = await client.query(`
    select r.id, r.status, r.booking_mode, r.start_at, r.end_at, s.name suite_name,
      sess.started_at session_started_at, sess.ended_at session_ended_at,
      ag.starts_at access_starts_at
    from reservations r
    join suites s on s.id = r.suite_id
    left join sessions sess on sess.reservation_id = r.id
    left join access_grants ag on ag.reservation_id = r.id
    where r.member_profile_id = $1
    order by r.start_at
  `, [memberProfileId]);
  return result.rows.map((row) => ({
    id: row.id,
    suiteName: row.suite_name,
    status: row.status,
    bookingMode: row.booking_mode,
    startAt: row.start_at.toISOString(),
    endAt: row.end_at.toISOString(),
    sessionStartedAt: row.session_started_at?.toISOString(),
    sessionEndedAt: row.session_ended_at?.toISOString(),
    accessStartsAt: row.access_starts_at?.toISOString(),
  }));
}

function validateStateBackedEvidencePaths() {
  const manifestPath = path.join(repoRoot, reviewRoot, "evidence", "screenshot-manifest.json");
  if (!existsSync(manifestPath)) return;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const capture of manifest) {
    const reconciliation = JSON.parse(readFileSync(path.join(repoRoot, reviewRoot, capture.reconciliationPath), "utf8"));
    for (const assertion of capture.structuredAssertions.filter((item) => item.sourceKind === "state-backed")) {
      if (!resolvePath(reconciliation.snapshot, assertion.sourcePath).found) {
        throw new Error(`State-backed assertion source path is missing: ${assertion.id} -> ${assertion.sourcePath}`);
      }
    }
  }
  assertions.push({ label: "all state-backed UI assertion source paths resolve", expected: true, actual: true, passed: true });
}

function resolvePath(value, sourcePath) {
  let current = value;
  for (const segment of sourcePath.split(".")) {
    if (current === null || typeof current !== "object" || !(segment in current)) return { found: false };
    current = current[segment];
  }
  return { found: current !== undefined, value: current };
}

function activitySummary(profile) {
  return {
    totalCompletedSessions: profile.completedSessionCount,
    recentActivityRowCount: profile.recentActivity.length,
    latestActivity: profile.recentActivity[0],
  };
}

function equal(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
  assertions.push({ label, expected, actual, passed: true });
}
