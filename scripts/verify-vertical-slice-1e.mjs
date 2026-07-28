import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { chromium } from "playwright-core";
import { clerk, clerkSetup } from "@clerk/testing/playwright";

const repoRoot = process.cwd();
const logPath = `${repoRoot}\\.verification-1e.log`;
writeFileSync(logPath, "", "utf8");
function log(message) { appendFileSync(logPath, `${message}\n`, "utf8"); }

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    let value = line.slice(index + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[line.slice(0, index).trim()] = value;
  }
  return env;
}

async function clerkApi(env, path, init = {}) {
  const response = await fetch(`https://api.clerk.com/v1${path}`, { ...init, headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`CLERK_${path}_FAILED ${response.status} ${JSON.stringify(body).slice(0, 500)}`);
  return body;
}

async function connectDb(env) {
  const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

async function retry(label, fn, timeoutMs = 30000) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try { return await fn(); } catch (error) { lastError = error; await new Promise((resolve) => setTimeout(resolve, 500)); }
  }
  throw new Error(`${label}: ${lastError?.message ?? lastError}`);
}

function restartDevServer() {
  const ps = `
    $conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }
    Start-Sleep -Seconds 2
    $env:NODE_OPTIONS='--use-system-ca'
    Start-Process -FilePath 'C:\\Users\\TheMachine\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\bin\\pnpm.cmd' -ArgumentList 'dev' -WorkingDirectory '${repoRoot.replaceAll("'", "''")}' -WindowStyle Hidden -RedirectStandardOutput '${repoRoot.replaceAll("'", "''")}\\.next-dev.out.log' -RedirectStandardError '${repoRoot.replaceAll("'", "''")}\\.next-dev.err.log'
  `;
  execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], { stdio: "ignore" });
}

async function waitForServer() {
  await retry("server did not respond", async () => {
    const response = await fetch("http://localhost:3000", { redirect: "manual" });
    if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
    return true;
  }, 60000);
}

async function login(page, email, path = "/") {
  await page.goto(`http://localhost:3000${path}`, { waitUntil: "domcontentloaded" });
  await clerk.signIn({ page, emailAddress: email });
  await page.goto(`http://localhost:3000${path}`, { waitUntil: "domcontentloaded" });
}

async function memberProfileForEmail(client, email) {
  const result = await client.query("select mp.id, mp.home_location_id from member_profiles mp join people pe on pe.id = mp.person_id where pe.email = $1", [email]);
  if (result.rowCount !== 1) throw new Error(`expected one member profile for ${email}, got ${result.rowCount}`);
  return result.rows[0];
}

async function suiteRow(client, suiteId) {
  const result = await client.query("select id, name, status from suites where id = $1", [suiteId]);
  if (result.rowCount !== 1) throw new Error(`suite ${suiteId} not found`);
  return result.rows[0];
}

async function snapshot(client, email) {
  const result = await client.query(`
    with target_profile as (select mp.* from member_profiles mp join people pe on pe.id = mp.person_id where pe.email = $1),
    target_reservations as (select * from reservations where member_profile_id in (select id from target_profile)),
    target_sessions as (select * from sessions where member_profile_id in (select id from target_profile))
    select jsonb_build_object(
      'people', (select count(*)::int from people where email = $1),
      'profiles', (select count(*)::int from target_profile),
      'roles', coalesce((select jsonb_object_agg(role, count) from (select role, count(*)::int from role_assignments where member_profile_id in (select id from target_profile) group by role) typed), '{}'::jsonb),
      'reservations', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'suiteId', suite_id, 'mode', booking_mode, 'status', status, 'startAt', start_at, 'endAt', end_at) order by created_at) from target_reservations), '[]'::jsonb),
      'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'reservationId', reservation_id, 'suiteId', suite_id, 'startedAt', started_at, 'endedAt', ended_at) order by created_at) from target_sessions), '[]'::jsonb),
      'accessGrants', coalesce((select jsonb_agg(jsonb_build_object('reservationId', reservation_id, 'status', status) order by created_at) from access_grants where member_profile_id in (select id from target_profile)), '[]'::jsonb),
      'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', ft.id, 'suiteId', ft.suite_id, 'type', ft.task_type, 'status', ft.status, 'claimedBy', ft.claimed_by, 'startedAt', ft.started_at, 'completedAt', ft.completed_at) order by ft.created_at) from facility_tasks ft where ft.source_session_id in (select id from target_sessions)), '[]'::jsonb),
      'auditByType', coalesce((select jsonb_object_agg(type, count) from (select type, count(*)::int from audit_events where actor_id in (select id::text from target_profile) group by type) typed), '{}'::jsonb)
    ) as snapshot
  `, [email]);
  return result.rows[0].snapshot;
}

function assert(condition, message) { if (!condition) throw new Error(message); }
function assertEqual(actual, expected, label) { if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`); }

const env = loadEnv(".env.local");
process.env.CLERK_SECRET_KEY = env.CLERK_SECRET_KEY;
process.env.CLERK_PUBLISHABLE_KEY = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!env.CLERK_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Clerk secret key is not a development sk_test key");
if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")) throw new Error("Clerk publishable key is not a development pk_test key");
if (!env.DATABASE_URL?.startsWith("postgres")) throw new Error("DATABASE_URL is not a Postgres URL");

restartDevServer();
await waitForServer();
await clerkSetup();
log("SERVER_AND_CLERK_TESTING_READY");

const stamp = Date.now();
const memberEmail = `fairway-vs1e-member-${stamp}@example.com`;
const facilitiesEmailA = `fairway-vs1e-facilities-a-${stamp}@example.com`;
const facilitiesEmailB = `fairway-vs1e-facilities-b-${stamp}@example.com`;
const unauthorizedEmail = `fairway-vs1e-unauthorized-${stamp}@example.com`;
await clerkApi(env, "/users", { method: "POST", body: JSON.stringify({ email_address: [memberEmail], first_name: "Fairway", last_name: "Completer", skip_password_requirement: true, public_metadata: { fairwayRuntimeVerification: "vertical-slice-1e" } }) });
await clerkApi(env, "/users", { method: "POST", body: JSON.stringify({ email_address: [facilitiesEmailA], first_name: "Fairway", last_name: "FacilitiesA", skip_password_requirement: true, public_metadata: { fairwayRuntimeVerification: "vertical-slice-1e" } }) });
await clerkApi(env, "/users", { method: "POST", body: JSON.stringify({ email_address: [facilitiesEmailB], first_name: "Fairway", last_name: "FacilitiesB", skip_password_requirement: true, public_metadata: { fairwayRuntimeVerification: "vertical-slice-1e" } }) });
await clerkApi(env, "/users", { method: "POST", body: JSON.stringify({ email_address: [unauthorizedEmail], first_name: "Fairway", last_name: "NoAccess", skip_password_requirement: true, public_metadata: { fairwayRuntimeVerification: "vertical-slice-1e" } }) });
log("CLERK_USERS_CREATED");

const client = await connectDb(env);
let browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });

try {
  const memberContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const memberPage = await memberContext.newPage();
  await login(memberPage, memberEmail, "/");
  await memberPage.getByRole("heading", { name: /Ready to play/i }).waitFor({ timeout: 45000 });

  const playNow = await memberPage.evaluate(async (stamp) => {
    const response = await fetch("/api/member/reservations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "PLAY_NOW", requestedMinutes: 30, creditCost: 1, idempotencyKey: `vs1e-playnow-${stamp}` }) });
    return { status: response.status, body: await response.json() };
  }, stamp);
  assertEqual(playNow.status, 200, "Play Now create status");
  const reservationId = playNow.body.reservation.id;
  const suiteId = playNow.body.reservation.suiteId;

  const futureStart = new Date(new Date(playNow.body.reservation.endAt).getTime() + (24 * 60 + (stamp % 120)) * 60_000);
  const futureEnd = new Date(futureStart.getTime() + 30 * 60_000);
  const future = await memberPage.evaluate(async ({ suiteId, futureStart, futureEnd, stamp }) => {
    const response = await fetch("/api/member/reservations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "ADVANCE", suiteId, startAt: futureStart, endAt: futureEnd, creditCost: 1, idempotencyKey: `vs1e-future-${stamp}` }) });
    return { status: response.status, body: await response.json() };
  }, { suiteId, futureStart: futureStart.toISOString(), futureEnd: futureEnd.toISOString(), stamp });
  assertEqual(future.status, 200, "future reservation status");

  const started = await memberPage.evaluate(async (reservationId) => {
    const response = await fetch("/api/member/session/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reservationId, idempotencyKey: `session-${reservationId}` }) });
    return { status: response.status, body: await response.json() };
  }, reservationId);
  assertEqual(started.status, 200, "session start status");

  const completed = await memberPage.evaluate(async (reservationId) => {
    const response = await fetch("/api/member/session/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reservationId, idempotencyKey: `complete-${reservationId}` }) });
    return { status: response.status, body: await response.json() };
  }, reservationId);
  assertEqual(completed.status, 200, "session completion status");
  assertEqual(completed.body.reservation.status, "completed", "completed reservation status");
  assertEqual(completed.body.accessGrant.status, "expired", "access expired after completion");
  assertEqual(completed.body.facilityTask.taskType, "turnover", "turnover task created");
  const taskId = completed.body.facilityTask.id;

  const retryComplete = await memberPage.evaluate(async (reservationId) => {
    const response = await fetch("/api/member/session/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reservationId, idempotencyKey: `complete-${reservationId}` }) });
    return { status: response.status, body: await response.json() };
  }, reservationId);
  assertEqual(retryComplete.status, 200, "idempotent completion status");
  assertEqual(retryComplete.body.idempotent, true, "idempotent completion flag");
  assertEqual((await suiteRow(client, suiteId)).status, "turnover", "suite turnover status after completion");
  log("SESSION_RESERVATION_ACCESS_AND_TASK_COMPLETION_VERIFIED");

  const blockedAdvance = await memberPage.evaluate(async ({ suiteId, stamp }) => {
    const now = new Date();
    const startAt = new Date(now.getTime() + 3 * 60 * 60_000);
    const endAt = new Date(startAt.getTime() + 30 * 60_000);
    const response = await fetch("/api/member/reservations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "ADVANCE", suiteId, startAt: startAt.toISOString(), endAt: endAt.toISOString(), creditCost: 1, idempotencyKey: `vs1e-blocked-turnover-${stamp}` }) });
    return { status: response.status, body: await response.json() };
  }, { suiteId, stamp });
  assertEqual(blockedAdvance.status, 409, "turnover suite advance blocked status");
  assert(String(blockedAdvance.body.error).includes("SUITE_NOT_AVAILABLE"), "turnover suite rejection error");
  log("ACTIVE_TURNOVER_BLOCKS_ASSIGNMENT_VERIFIED");

  const unauthorizedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const unauthorizedPage = await unauthorizedContext.newPage();
  await login(unauthorizedPage, unauthorizedEmail, "/");
  const denied = await unauthorizedPage.evaluate(async () => ({ status: (await fetch("/api/facilities/state")).status, body: await (await fetch("/api/facilities/state")).json() }));
  assertEqual(denied.status, 403, "unauthorized facilities state status");
  await unauthorizedContext.close();
  log("UNAUTHORIZED_FACILITIES_ACCESS_REJECTED");

  const facilitiesContextA = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const facilitiesPageA = await facilitiesContextA.newPage();
  await login(facilitiesPageA, facilitiesEmailA, "/");
  await facilitiesPageA.getByRole("heading", { name: /Ready to play/i }).waitFor({ timeout: 45000 });
  const facilitiesProfileA = await memberProfileForEmail(client, facilitiesEmailA);
  await client.query("select fairway_grant_development_facilities($1, $2, $3)", [facilitiesProfileA.id, facilitiesProfileA.home_location_id, "Vertical Slice 1E runtime verification facilities grant A"]);

  const facilitiesContextB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const facilitiesPageB = await facilitiesContextB.newPage();
  await login(facilitiesPageB, facilitiesEmailB, "/");
  await facilitiesPageB.getByRole("heading", { name: /Ready to play/i }).waitFor({ timeout: 45000 });
  const facilitiesProfileB = await memberProfileForEmail(client, facilitiesEmailB);
  await client.query("select fairway_grant_development_facilities($1, $2, $3)", [facilitiesProfileB.id, facilitiesProfileB.home_location_id, "Vertical Slice 1E runtime verification facilities grant B"]);

  await facilitiesPageA.goto("http://localhost:3000/facilities", { waitUntil: "domcontentloaded" });
  await facilitiesPageA.getByRole("heading", { name: "What should I service now?" }).waitFor({ timeout: 45000 });
  await facilitiesPageA.getByText("Next Best Action").waitFor({ timeout: 30000 });
  log("FACILITIES_ROLE_AND_CLEANING_QUEUE_VERIFIED");

  const concurrentClaim = await Promise.all([
    facilitiesPageA.evaluate(async (taskId) => {
      const response = await fetch(`/api/facilities/tasks/${taskId}/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: `claim-a-${taskId}` }) });
      return { status: response.status, body: await response.json() };
    }, taskId),
    facilitiesPageB.evaluate(async (taskId) => {
      const response = await fetch(`/api/facilities/tasks/${taskId}/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: `claim-b-${taskId}` }) });
      return { status: response.status, body: await response.json() };
    }, taskId),
  ]);
  assertEqual(concurrentClaim.filter((item) => item.status === 200).length, 1, "one successful concurrent claim");
  assertEqual(concurrentClaim.filter((item) => item.status === 409).length, 1, "one rejected concurrent claim");
  log("CONCURRENT_FACILITY_CLAIM_PROTECTION_VERIFIED");

  const claimantPage = concurrentClaim[0].status === 200 ? facilitiesPageA : facilitiesPageB;
  const startedTask = await claimantPage.evaluate(async (taskId) => {
    const response = await fetch(`/api/facilities/tasks/${taskId}/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: `start-${taskId}` }) });
    return { status: response.status, body: await response.json() };
  }, taskId);
  assertEqual(startedTask.status, 200, "facility task start status");
  assertEqual(startedTask.body.task.status, "in_progress", "facility task in progress");

  const completedTask = await claimantPage.evaluate(async (taskId) => {
    const response = await fetch(`/api/facilities/tasks/${taskId}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ completionNotes: "Verified ready", idempotencyKey: `complete-task-${taskId}` }) });
    return { status: response.status, body: await response.json() };
  }, taskId);
  assertEqual(completedTask.status, 200, "facility task complete status");
  assertEqual(completedTask.body.task.status, "completed", "facility task completed");
  assertEqual((await suiteRow(client, suiteId)).status, "available", "suite available after turnover completion");

  const retryTaskComplete = await claimantPage.evaluate(async (taskId) => {
    const response = await fetch(`/api/facilities/tasks/${taskId}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ completionNotes: "Verified ready", idempotencyKey: `complete-task-${taskId}` }) });
    return { status: response.status, body: await response.json() };
  }, taskId);
  assertEqual(retryTaskComplete.status, 200, "facility task retry complete status");
  assertEqual(retryTaskComplete.body.idempotent, true, "facility task completion idempotent");
  log("TASK_START_COMPLETION_AND_INVENTORY_RESTORATION_VERIFIED");

  const inspection = await claimantPage.evaluate(async (suiteId) => {
    const response = await fetch(`/api/facilities/suites/${suiteId}/inspection`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "Runtime verification inspection flag", idempotencyKey: `inspection-${suiteId}-${crypto.randomUUID()}` }) });
    return { status: response.status, body: await response.json() };
  }, suiteId);
  assertEqual(inspection.status, 200, "inspection flag status");
  assertEqual(inspection.body.suite.status, "inspection_required", "inspection suite status");
  await client.query("update suites set status = 'administrative_hold' where id = $1", [suiteId]);
  const inspectionTaskId = inspection.body.task.id;
  await claimantPage.evaluate(async (taskId) => {
    await fetch(`/api/facilities/tasks/${taskId}/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: `claim-inspection-${taskId}` }) });
    await fetch(`/api/facilities/tasks/${taskId}/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: `start-inspection-${taskId}` }) });
    const response = await fetch(`/api/facilities/tasks/${taskId}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ completionNotes: "Inspection complete but hold remains", idempotencyKey: `complete-inspection-${taskId}` }) });
    return { status: response.status, body: await response.json() };
  }, inspectionTaskId);
  assertEqual((await suiteRow(client, suiteId)).status, "administrative_hold", "admin hold remains after cleaning completion");
  await client.query("update suites set status = 'available' where id = $1", [suiteId]);
  log("INSPECTION_ESCALATION_AND_HOLD_AUTHORITY_VERIFIED");

  await facilitiesPageA.reload({ waitUntil: "domcontentloaded" });
  await facilitiesPageA.getByRole("heading", { name: "What should I service now?" }).waitFor({ timeout: 30000 });
  restartDevServer();
  await waitForServer();
  await facilitiesPageA.goto("http://localhost:3000/facilities", { waitUntil: "domcontentloaded" });
  await facilitiesPageA.getByRole("heading", { name: "What should I service now?" }).waitFor({ timeout: 45000 });
  log("PERSISTENCE_REFRESH_AND_RESTART_VERIFIED");

  const memberSummary = await snapshot(client, memberEmail);
  assertEqual(memberSummary.people, 1, "member people");
  assertEqual(memberSummary.profiles, 1, "member profiles");
  assertEqual(memberSummary.sessions.length, 1, "member session count");
  assert(memberSummary.sessions[0].endedAt, "session ended_at missing");
  assert(memberSummary.reservations.some((row) => row.status === "completed"), "completed reservation missing");
  assert(memberSummary.reservations.some((row) => row.id === future.body.reservation.id && row.status === "confirmed"), "future reservation not preserved");
  assert(memberSummary.accessGrants.some((row) => row.status === "expired"), "expired access grant missing");
  assertEqual(memberSummary.tasks.filter((task) => task.type === "turnover").length, 1, "one turnover task");
  const facilitiesSummary = await snapshot(client, facilitiesEmailA);
  assert(facilitiesSummary.roles.facilities === 1, "facilities role missing");
  log("FINAL_DB_SUMMARY_START");
  log(JSON.stringify({ memberEmail, facilitiesEmailA, member: memberSummary, facilities: facilitiesSummary }, null, 2));
  log("FINAL_DB_SUMMARY_END");

  await memberContext.close();
  await facilitiesContextA.close();
  await facilitiesContextB.close();
} finally {
  if (browser?.isConnected()) await browser.close().catch(() => undefined);
  await client.end().catch(() => undefined);
}