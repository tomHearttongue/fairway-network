import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { loadEnvFile } from "./demo-universe-loader.mjs";

const repoRoot = process.cwd();
const reviewRoot = process.env.FAIRWAY_DU1_REVIEW_ROOT ?? path.join("artifacts", "du1-remediation-r2-review");
const env = { ...loadEnvFile(), ...process.env, FAIRWAY_DU1_REVIEW_ROOT: reviewRoot };
if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const assertions = [];
const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await resetNormal();
  let facts = await futureFacts();
  const beforeEarly = await mutationFacts(facts.reservationId);
  await expectDatabaseError(
    () => start(facts, new Date(facts.accessStartsAt.getTime() - 1_000), "du1-r2:early"),
    "SESSION_ACCESS_WINDOW_NOT_OPEN",
    "one second before access opens is denied",
  );
  equal(await mutationFacts(facts.reservationId), beforeEarly, "early denial produces zero reservation/session/audit mutation");

  const exactOpen = await start(facts, facts.accessStartsAt, "du1-r2:exact-open");
  equal(exactOpen.idempotent, false, "exact access-window open starts once");
  const duplicate = await start(facts, new Date(facts.accessStartsAt.getTime() + 1_000), "du1-r2:exact-open");
  equal(duplicate.idempotent, true, "duplicate exact key is idempotent");
  const afterDuplicate = await mutationFacts(facts.reservationId);
  equal(afterDuplicate.sessions, 1, "duplicate start keeps one session");
  equal(afterDuplicate.audits, 1, "duplicate start keeps one start audit");

  await resetNormal();
  facts = await futureFacts();
  await expectDatabaseError(
    () => start(facts, facts.accessExpiresAt, "du1-r2:expiry"),
    "SESSION_ACCESS_WINDOW_EXPIRED",
    "exact access-window expiry is denied",
  );
  equal((await mutationFacts(facts.reservationId)).sessions, 0, "expiry denial produces no session");

  await resetNormal();
  facts = await futureFacts();
  const inside = await start(facts, new Date(facts.accessExpiresAt.getTime() - 1_000), "du1-r2:inside-window");
  equal(inside.idempotent, false, "one second before expiry remains startable");

  await resetNormal();
  facts = await futureFacts();
  await inRollback(async () => {
    await client.query("update reservations set status = 'cancelled' where id = $1", [facts.reservationId]);
    await expectDatabaseError(() => start(facts, facts.accessStartsAt, "du1-r2:cancelled"), "RESERVATION_NOT_STARTABLE", "cancelled reservation is denied");
  });
  await inRollback(async () => {
    await client.query("update reservations set status = 'completed' where id = $1", [facts.reservationId]);
    await expectDatabaseError(() => start(facts, facts.accessStartsAt, "du1-r2:completed"), "RESERVATION_NOT_STARTABLE", "completed reservation is denied");
  });

  const nora = await client.query("select mp.id from member_profiles mp join people pe on pe.id = mp.person_id where pe.email = 'fairway-ux-new-golfer@example.com'");
  await expectDatabaseError(
    () => client.query(
      "select fairway_start_session($1,$2,'fake',$3,$4,$5,$6) result",
      [nora.rows[0].id, facts.reservationId, "du1-r2-wrong-member", facts.accessStartsAt, "du1-r2:wrong-member", facts.accessStartsAt],
    ),
    "RESERVATION_NOT_OWNED",
    "wrong member is denied",
  );

  await inRollback(async () => {
    const otherSuite = await client.query("select id from suites where id <> $1 order by name limit 1", [facts.suiteId]);
    await client.query("update access_grants set suite_id = $1 where reservation_id = $2", [otherSuite.rows[0].id, facts.reservationId]);
    await expectDatabaseError(() => start(facts, facts.accessStartsAt, "du1-r2:wrong-suite"), "SESSION_ACCESS_MAPPING_INVALID", "wrong suite mapping is denied");
  });

  await resetNormal();
  const output = {
    gate: "DU1 R2 session-start authority",
    status: "PASS",
    generatedAt: new Date().toISOString(),
    assertions,
  };
  const outputPath = path.join(repoRoot, reviewRoot, "reports", "session-start-authority.json");
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`DU1 R2 session-start authority: PASS (${assertions.length} assertions)`);
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

async function futureFacts() {
  const result = await client.query(`
    select r.id reservation_id, r.member_profile_id, r.suite_id, ag.starts_at, ag.expires_at
    from reservations r
    join member_profiles mp on mp.id = r.member_profile_id
    join people pe on pe.id = mp.person_id
    join access_grants ag on ag.reservation_id = r.id
    where pe.email = 'fairway-ux-demo-active-birdie@example.com'
      and r.booking_mode = 'ADVANCE'
      and r.status = 'confirmed'
    order by r.start_at
    limit 1
  `);
  if (result.rowCount !== 1) throw new Error("Demo Tom future reservation is missing.");
  return {
    reservationId: result.rows[0].reservation_id,
    memberProfileId: result.rows[0].member_profile_id,
    suiteId: result.rows[0].suite_id,
    accessStartsAt: result.rows[0].starts_at,
    accessExpiresAt: result.rows[0].expires_at,
  };
}

async function start(facts, now, key) {
  const result = await client.query(
    "select fairway_start_session($1,$2,'fake',$3,$4,$5,$6) result",
    [facts.memberProfileId, facts.reservationId, `external:${key}`, now, key, now],
  );
  return result.rows[0].result;
}

async function mutationFacts(reservationId) {
  const result = await client.query(`
    select
      (select status from reservations where id = $1) reservation_status,
      (select count(*)::int from sessions where reservation_id = $1) sessions,
      (select count(*)::int from audit_events where type = 'session.started' and resource_id in (select id::text from sessions where reservation_id = $1)) audits
  `, [reservationId]);
  return result.rows[0];
}

async function expectDatabaseError(action, expected, label) {
  let message = "";
  try {
    await action();
  } catch (error) {
    message = String(error?.message ?? error);
  }
  if (!message.includes(expected)) throw new Error(`${label}: expected ${expected}, received ${message || "no error"}`);
  assertions.push({ label, expected, actual: expected, passed: true });
}

function equal(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
  assertions.push({ label, expected, actual, passed: true });
}

async function inRollback(action) {
  await client.query("begin");
  try {
    await action();
  } finally {
    await client.query("rollback");
  }
}
