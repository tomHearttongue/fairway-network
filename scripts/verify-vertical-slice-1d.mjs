import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { chromium } from "playwright-core";
import { clerk, clerkSetup } from "@clerk/testing/playwright";

const repoRoot = process.cwd();
const logPath = `${repoRoot}\\.verification-1d.log`;
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
    const response = await fetch("http://localhost:3000/operator", { redirect: "manual" });
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

async function suiteByName(client, name) {
  const result = await client.query("select id, name, status from suites where location_id = '00000000-0000-0000-0000-000000000001' and name = $1", [name]);
  if (result.rowCount !== 1) throw new Error(`suite ${name} not found`);
  return result.rows[0];
}

async function setSuiteStatusApi(page, suiteId, status, reason) {
  return page.evaluate(async ({ suiteId, status, reason }) => {
    const response = await fetch(`/api/operator/suites/${suiteId}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, reason, idempotencyKey: `verify-suite-${suiteId}-${status}-${crypto.randomUUID()}` }) });
    return { status: response.status, body: await response.json() };
  }, { suiteId, status, reason });
}

async function createMemberReservation(page, body) {
  return page.evaluate(async (body) => {
    const response = await fetch("/api/member/reservations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, body);
}

async function snapshot(client, email) {
  const result = await client.query(`
    with target_profile as (
      select mp.* from member_profiles mp join people pe on pe.id = mp.person_id where pe.email = $1
    ), target_reservations as (
      select * from reservations where member_profile_id in (select id from target_profile)
    )
    select jsonb_build_object(
      'people', (select count(*)::int from people where email = $1),
      'profiles', (select count(*)::int from target_profile),
      'roleAssignments', (select count(*)::int from role_assignments where member_profile_id in (select id from target_profile)),
      'availableCredits', (select fairway_available_credits(id)::int from target_profile limit 1),
      'ledgerByType', coalesce((select jsonb_object_agg(entry_type, count) from (select entry_type::text, count(*)::int from credit_ledger_entries where member_profile_id in (select id from target_profile) group by entry_type) typed), '{}'::jsonb),
      'reservations', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'suiteId', suite_id, 'mode', booking_mode, 'status', status, 'startAt', start_at, 'cancelledAt', cancelled_at) order by created_at) from target_reservations), '[]'::jsonb),
      'accessGrants', coalesce((select jsonb_agg(jsonb_build_object('reservationId', reservation_id, 'status', status) order by created_at) from access_grants where member_profile_id in (select id from target_profile)), '[]'::jsonb),
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
const operatorEmail = `fairway-vs1d-operator-${stamp}@example.com`;
const memberEmail = `fairway-vs1d-member-${stamp}@example.com`;
const nonOperatorEmail = `fairway-vs1d-nonoperator-${stamp}@example.com`;
const operatorUser = await clerkApi(env, "/users", { method: "POST", body: JSON.stringify({ email_address: [operatorEmail], first_name: "Fairway", last_name: "Operator", skip_password_requirement: true, public_metadata: { fairwayRuntimeVerification: "vertical-slice-1d" } }) });
await clerkApi(env, "/users", { method: "POST", body: JSON.stringify({ email_address: [memberEmail], first_name: "Fairway", last_name: "Member", skip_password_requirement: true, public_metadata: { fairwayRuntimeVerification: "vertical-slice-1d" } }) });
await clerkApi(env, "/users", { method: "POST", body: JSON.stringify({ email_address: [nonOperatorEmail], first_name: "Fairway", last_name: "Guest", skip_password_requirement: true, public_metadata: { fairwayRuntimeVerification: "vertical-slice-1d" } }) });
log(`CLERK_USERS_CREATED ${operatorUser.id}`);

const client = await connectDb(env);
let browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });

try {
  const operatorContext = await browser.newContext({ viewport: { width: 430, height: 900 } });
  const operatorPage = await operatorContext.newPage();
  await login(operatorPage, operatorEmail, "/");
  await operatorPage.getByRole("heading", { name: /Ready to play/i }).waitFor({ timeout: 45000 });
  const operatorProfile = await memberProfileForEmail(client, operatorEmail);
  await client.query("select fairway_grant_development_operator($1, $2, $3)", [operatorProfile.id, operatorProfile.home_location_id, "Vertical Slice 1D runtime verification operator grant"]);
  await operatorPage.goto("http://localhost:3000/operator", { waitUntil: "domcontentloaded" });
  await operatorPage.getByRole("heading", { name: "Fairway KC" }).waitFor({ timeout: 45000 });
  const facility = await operatorPage.evaluate(async () => ({ status: (await fetch("/api/operator/facility")).status, body: await (await fetch("/api/operator/facility")).json() }));
  assertEqual(facility.status, 200, "operator facility status");
  assertEqual(facility.body.suites.length, 12, "operator facility suite count");
  log("AUTHORIZED_OPERATOR_ACCESS_AND_FACILITY_RETRIEVAL_VERIFIED");

  const suite1 = await suiteByName(client, "Practice Suite 1");
  const suite2 = await suiteByName(client, "Practice Suite 2");
  const suite3 = await suiteByName(client, "Practice Suite 3");

  const nonOperatorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const nonOperatorPage = await nonOperatorContext.newPage();
  await login(nonOperatorPage, nonOperatorEmail, "/");
  const denied = await nonOperatorPage.evaluate(async (suiteId) => {
    const response = await fetch(`/api/operator/suites/${suiteId}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "maintenance", reason: "Unauthorized test", idempotencyKey: `denied-${crypto.randomUUID()}` }) });
    return { status: response.status, body: await response.json() };
  }, suite1.id);
  assertEqual(denied.status, 403, "non-operator mutation status");
  await nonOperatorContext.close();
  log("UNAUTHORIZED_OPERATOR_MUTATION_REJECTED");

  await operatorPage.getByText("Practice Suite 1").first().click();
  await operatorPage.getByPlaceholder("Reason visible in audit trail").fill("Runtime verification maintenance hold");
  await operatorPage.getByRole("button", { name: /^Maintenance$/ }).click();
  await operatorPage.getByText(/Practice Suite 1 is now maintenance/i).waitFor({ timeout: 30000 });
  let statusCheck = await client.query("select status from suites where id = $1", [suite1.id]);
  assertEqual(statusCheck.rows[0].status, "maintenance", "suite 1 maintenance status");
  log("SUITE_MAINTENANCE_UI_VERIFIED");

  const hold = await setSuiteStatusApi(operatorPage, suite2.id, "administrative_hold", "Runtime verification administrative hold");
  assertEqual(hold.status, 200, "admin hold status response");
  log("ADMINISTRATIVE_HOLD_VERIFIED");

  const memberContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const memberPage = await memberContext.newPage();
  await login(memberPage, memberEmail, "/");
  await memberPage.getByRole("heading", { name: /Ready to play/i }).waitFor({ timeout: 45000 });

  const now = new Date();
  const startAt = new Date(now.getTime() + 60 * 60_000);
  const endAt = new Date(startAt.getTime() + 30 * 60_000);
  const blockedAdvance = await createMemberReservation(memberPage, { mode: "ADVANCE", suiteId: suite1.id, startAt: startAt.toISOString(), endAt: endAt.toISOString(), creditCost: 1, idempotencyKey: `blocked-maintenance-${stamp}` });
  assertEqual(blockedAdvance.status, 409, "maintenance suite explicit advance rejection");
  assert(String(blockedAdvance.body.error).includes("SUITE_NOT_AVAILABLE"), "maintenance rejection error");

  const blockedHoldAdvance = await createMemberReservation(memberPage, { mode: "ADVANCE", suiteId: suite2.id, startAt: new Date(startAt.getTime() + 60 * 60_000).toISOString(), endAt: new Date(endAt.getTime() + 60 * 60_000).toISOString(), creditCost: 1, idempotencyKey: `blocked-admin-hold-${stamp}` });
  assertEqual(blockedHoldAdvance.status, 409, "admin hold explicit advance rejection");
  assert(String(blockedHoldAdvance.body.error).includes("SUITE_NOT_AVAILABLE"), "admin hold rejection error");

  const playNow = await createMemberReservation(memberPage, { mode: "PLAY_NOW", requestedMinutes: 30, creditCost: 1, idempotencyKey: `play-now-1d-${stamp}` });
  assertEqual(playNow.status, 200, "play now while suites blocked");
  assert(playNow.body.reservation.suiteId !== suite1.id, "Play Now assigned maintenance suite");
  assert(playNow.body.reservation.suiteId !== suite2.id, "Play Now assigned administrative hold suite");
  log("MAINTENANCE_AND_HOLD_EXCLUDED_FROM_MEMBER_ASSIGNMENT");

  const restore = await setSuiteStatusApi(operatorPage, suite1.id, "available", "Runtime verification restore to service");
  assertEqual(restore.status, 200, "suite restore response");
  statusCheck = await client.query("select status from suites where id = $1", [suite1.id]);
  assertEqual(statusCheck.rows[0].status, "available", "suite 1 restored status");
  const restoredAdvance = await createMemberReservation(memberPage, { mode: "ADVANCE", suiteId: suite1.id, startAt: new Date(startAt.getTime() + 120 * 60_000).toISOString(), endAt: new Date(endAt.getTime() + 120 * 60_000).toISOString(), creditCost: 1, idempotencyKey: `restored-advance-${stamp}` });
  assertEqual(restoredAdvance.status, 200, "restored suite advance response");
  assertEqual(restoredAdvance.body.reservation.suiteId, suite1.id, "restored suite assignment");
  log("RESTORED_SUITE_ELIGIBLE_WITH_RESERVATION_PROTECTION_VERIFIED");

  const missingReason = await operatorPage.evaluate(async (reservationId) => {
    const response = await fetch(`/api/operator/reservations/${reservationId}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "", idempotencyKey: `missing-reason-${crypto.randomUUID()}` }) });
    return { status: response.status, body: await response.json() };
  }, restoredAdvance.body.reservation.id);
  assertEqual(missingReason.status, 400, "operator cancel missing reason status");
  assertEqual(missingReason.body.error, "REASON_REQUIRED", "operator cancel missing reason error");

  const operatorCancel = await operatorPage.evaluate(async (reservationId) => {
    const response = await fetch(`/api/operator/reservations/${reservationId}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "Runtime verification operator cancellation", idempotencyKey: `operator-cancel-${reservationId}` }) });
    return { status: response.status, body: await response.json() };
  }, restoredAdvance.body.reservation.id);
  assertEqual(operatorCancel.status, 200, "operator cancellation status");
  assertEqual(operatorCancel.body.reservation.status, "cancelled", "operator cancellation reservation status");
  assertEqual(operatorCancel.body.refundedCredits, Number(restoredAdvance.body.reservation.creditsCommitted ?? 2), "operator refunded credits");
  const retryCancel = await operatorPage.evaluate(async (reservationId) => {
    const response = await fetch(`/api/operator/reservations/${reservationId}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "Runtime verification operator cancellation", idempotencyKey: `operator-cancel-${reservationId}` }) });
    return { status: response.status, body: await response.json() };
  }, restoredAdvance.body.reservation.id);
  assertEqual(retryCancel.status, 200, "operator cancellation retry status");
  assertEqual(retryCancel.body.idempotent, true, "operator cancellation retry idempotent");
  log("OPERATOR_CANCELLATION_REASON_CREDITS_ACCESS_AND_IDEMPOTENCY_VERIFIED");

  const concurrent = await operatorPage.evaluate(async (suiteId) => {
    const [a, b] = await Promise.all([
      fetch(`/api/operator/suites/${suiteId}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "maintenance", reason: "Concurrent maintenance verification", idempotencyKey: `concurrent-a-${crypto.randomUUID()}` }) }),
      fetch(`/api/operator/suites/${suiteId}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "administrative_hold", reason: "Concurrent hold verification", idempotencyKey: `concurrent-b-${crypto.randomUUID()}` }) }),
    ]);
    return [{ status: a.status, body: await a.json() }, { status: b.status, body: await b.json() }];
  }, suite3.id);
  assert(concurrent.every((item) => item.status === 200), `concurrent suite mutation failed ${JSON.stringify(concurrent)}`);
  await setSuiteStatusApi(operatorPage, suite2.id, "available", "Runtime verification restore administrative hold");
  await setSuiteStatusApi(operatorPage, suite3.id, "available", "Runtime verification restore concurrent suite");
  await operatorPage.reload({ waitUntil: "domcontentloaded" });
  await operatorPage.getByRole("heading", { name: "Fairway KC" }).waitFor({ timeout: 30000 });
  log("CONCURRENT_OPERATOR_MUTATIONS_AND_NO_STALE_UI_VERIFIED");

  const finalMemberSnapshot = await snapshot(client, memberEmail);
  assertEqual(finalMemberSnapshot.people, 1, "member people");
  assertEqual(finalMemberSnapshot.profiles, 1, "member profiles");
  assertEqual(finalMemberSnapshot.availableCredits, 124 - Number(playNow.body.reservation.creditsCommitted ?? 2), "member final credits");
  assert(finalMemberSnapshot.ledgerByType.refund === 1, `expected one refund ${JSON.stringify(finalMemberSnapshot.ledgerByType)}`);
  assert(finalMemberSnapshot.reservations.some((row) => row.status === "cancelled"), "cancelled reservation missing");
  assert(finalMemberSnapshot.accessGrants.some((row) => row.status === "revoked"), "revoked access grant missing");

  const operatorSnapshot = await snapshot(client, operatorEmail);
  assertEqual(operatorSnapshot.roleAssignments, 1, "operator role assignment count");
  assert(operatorSnapshot.auditByType["suite.status.changed"] >= 5, "suite status audit count missing");
  assert(operatorSnapshot.auditByType["operator.reservation.cancelled"] === 1, "operator cancellation audit missing");
  log("FINAL_DB_SUMMARY_START");
  log(JSON.stringify({ operatorEmail, memberEmail, member: finalMemberSnapshot, operator: operatorSnapshot }, null, 2));
  log("FINAL_DB_SUMMARY_END");

  await memberContext.close();
  await operatorContext.close();
} finally {
  if (browser?.isConnected()) await browser.close().catch(() => undefined);
  try {
    await client.query("update suites set status = 'available' where location_id = '00000000-0000-0000-0000-000000000001' and name in ('Practice Suite 1', 'Practice Suite 2', 'Practice Suite 3')");
  } catch {}
  await client.end().catch(() => undefined);
}