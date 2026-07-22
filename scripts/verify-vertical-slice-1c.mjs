import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { chromium } from "playwright-core";
import { clerk, clerkSetup } from "@clerk/testing/playwright";

const repoRoot = process.cwd();
const logPath = `${repoRoot}\\.verification-1c.log`;
writeFileSync(logPath, "", "utf8");
function log(message) { appendFileSync(logPath, `${message}\n`, "utf8"); }

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    let value = rest.join("=").trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[key.trim()] = value;
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

async function waitForServer() {
  await retry("server did not respond", async () => {
    const response = await fetch("http://localhost:3000", { redirect: "manual" });
    if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
    return true;
  }, 45000);
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

async function login(page, email) {
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await clerk.signIn({ page, emailAddress: email });
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Practice Suite Availability" }).waitFor({ timeout: 45000 });
}

async function visibleCredits(page) {
  const text = await page.locator("body").innerText();
  const match = text.match(/Credits\s+(\d+)/i) ?? text.match(/(\d+)\s+credits/i);
  if (!match) throw new Error(`Credits not visible: ${text.slice(0, 500)}`);
  return Number(match[1]);
}

async function dbSnapshot(client, email, clerkUserId, keys) {
  const result = await client.query(`
    with target_person as (select * from people where email = $1),
    target_profile as (select mp.* from member_profiles mp join target_person pe on pe.id = mp.person_id),
    target_reservations as (select * from reservations where member_profile_id in (select id from target_profile))
    select jsonb_build_object(
      'people', (select count(*)::int from target_person),
      'authPrincipals', (select count(*)::int from auth_principals where provider='clerk' and external_id=$2),
      'profiles', (select count(*)::int from target_profile),
      'memberships', (select count(*)::int from memberships where member_profile_id in (select id from target_profile) and status='active' and ended_at is null),
      'monthlyGrants', (select count(*)::int from credit_ledger_entries where member_profile_id in (select id from target_profile) and idempotency_key like 'seed:test-birdie-monthly-grant:%'),
      'devGrants', (select count(*)::int from credit_ledger_entries where member_profile_id in (select id from target_profile) and idempotency_key like 'seed:development-100-credit-grant:%'),
      'availableCredits', (select fairway_available_credits(id)::int from target_profile limit 1),
      'ledgerByType', coalesce((select jsonb_object_agg(entry_type, count) from (select entry_type::text, count(*)::int from credit_ledger_entries where member_profile_id in (select id from target_profile) group by entry_type) typed), '{}'::jsonb),
      'reservations', (select count(*)::int from target_reservations),
      'cancelledReservations', (select count(*)::int from target_reservations where status='cancelled'),
      'checkedInReservations', (select count(*)::int from target_reservations where status='checked_in'),
      'advanceReservations', (select count(*)::int from target_reservations where booking_mode='ADVANCE'),
      'playNowReservations', (select count(*)::int from target_reservations where booking_mode='PLAY_NOW'),
      'sessions', (select count(*)::int from sessions where member_profile_id in (select id from target_profile)),
      'accessGrants', (select count(*)::int from access_grants where member_profile_id in (select id from target_profile)),
      'revokedAccessGrants', (select count(*)::int from access_grants where member_profile_id in (select id from target_profile) and status='revoked'),
      'activeAccessGrants', (select count(*)::int from access_grants where member_profile_id in (select id from target_profile) and status='active'),
      'auditByType', coalesce((select jsonb_object_agg(type, count) from (select type, count(*)::int from audit_events where actor_id in (select id::text from target_profile) group by type) typed), '{}'::jsonb),
      'reservationKeyRows', (select count(*)::int from reservations where idempotency_key = any($3::text[])),
      'accessKeyRows', (select count(*)::int from access_grants where idempotency_key = any($4::text[])),
      'sessionKeyRows', (select count(*)::int from sessions where idempotency_key = any($5::text[])),
      'reservationRows', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'mode', booking_mode, 'status', status, 'startAt', start_at, 'endAt', end_at, 'cancelledAt', cancelled_at, 'idempotencyKey', idempotency_key) order by created_at) from target_reservations), '[]'::jsonb)
    ) as snapshot
  `, [email, clerkUserId, keys.reservationKeys, keys.accessKeys, keys.sessionKeys]);
  return result.rows[0].snapshot;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

const env = loadEnv(".env.local");
process.env.CLERK_SECRET_KEY = env.CLERK_SECRET_KEY;
process.env.CLERK_PUBLISHABLE_KEY = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!env.CLERK_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Clerk secret key is not a development sk_test key");
if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")) throw new Error("Clerk publishable key is not a development pk_test key");
await waitForServer();
await clerkSetup();
log("CLERK_TESTING_SETUP_VERIFIED");

const email = `fairway-vs1c-${Date.now()}@example.com`;
const user = await clerkApi(env, "/users", { method: "POST", body: JSON.stringify({ email_address: [email], first_name: "Fairway", last_name: "Lifecycle", skip_password_requirement: true, public_metadata: { fairwayRuntimeVerification: "vertical-slice-1c" } }) });
log(`CLERK_USER_CREATED ${user.id} ${email}`);

const keys = { reservationKeys: [], accessKeys: [], sessionKeys: [] };
const client = await connectDb(env);
let browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const reservationBodies = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/member/reservations") && !request.url().includes("/cancel")) {
      const body = request.postDataJSON();
      reservationBodies.push(body);
      if (!keys.reservationKeys.includes(body.idempotencyKey)) keys.reservationKeys.push(body.idempotencyKey);
      const accessKey = `${body.idempotencyKey}:access-grant`;
      if (!keys.accessKeys.includes(accessKey)) keys.accessKeys.push(accessKey);
    }
    if (request.method() === "POST" && request.url().includes("/api/member/session/start")) {
      const body = request.postDataJSON();
      if (!keys.sessionKeys.includes(body.idempotencyKey)) keys.sessionKeys.push(body.idempotencyKey);
    }
  });

  await login(page, email);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByText("Upcoming", { exact: true }).waitFor({ timeout: 30000 });
  assertEqual(await visibleCredits(page), 124, "initial visible credits");
  let snapshot = await dbSnapshot(client, email, user.id, keys);
  for (const [label, value] of Object.entries({ people: 1, authPrincipals: 1, profiles: 1, memberships: 1, monthlyGrants: 1, devGrants: 1, availableCredits: 124 })) assertEqual(snapshot[label], value, label);
  log("BOOTSTRAP_AND_RESERVATION_RETRIEVAL_VERIFIED");

  await page.getByRole("button", { name: /Book/i }).first().click();
  await page.getByText(/You're booked/i).waitFor({ timeout: 30000 });
  await page.getByText("Booked ahead").first().waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /Cancel/i }).first().click();
  await page.getByText(/Reservation cancelled/i).waitFor({ timeout: 30000 });
  assertEqual(await visibleCredits(page), 124, "credits after UI cancellation");
  log("UI_CANCELLATION_AND_CREDIT_RESTORE_VERIFIED");

  const firstCancelledId = (await dbSnapshot(client, email, user.id, keys)).reservationRows[0].id;
  const retryCancel = await page.evaluate(async (reservationId) => {
    const response = await fetch(`/api/member/reservations/${reservationId}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: `cancel-${reservationId}` }) });
    return { status: response.status, body: await response.json() };
  }, firstCancelledId);
  if (retryCancel.status !== 200 || retryCancel.body.idempotent !== true) throw new Error(`retry cancel failed ${JSON.stringify(retryCancel)}`);
  log("IDEMPOTENT_CANCEL_RETRY_VERIFIED");

  await page.getByRole("button", { name: /Book/i }).first().click();
  await page.getByText(/You're booked/i).waitFor({ timeout: 30000 });
  const secondAdvance = (await dbSnapshot(client, email, user.id, keys)).reservationRows.find((row) => row.status === "confirmed" && row.mode === "ADVANCE");
  const concurrentCancel = await page.evaluate(async (reservationId) => {
    const [a, b] = await Promise.all([
      fetch(`/api/member/reservations/${reservationId}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: `cancel-concurrent-a-${reservationId}` }) }),
      fetch(`/api/member/reservations/${reservationId}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: `cancel-concurrent-b-${reservationId}` }) }),
    ]);
    return [{ status: a.status, body: await a.json() }, { status: b.status, body: await b.json() }];
  }, secondAdvance.id);
  if (!concurrentCancel.every((item) => item.status === 200)) throw new Error(`concurrent cancel failed ${JSON.stringify(concurrentCancel)}`);
  log("CONCURRENT_CANCEL_VERIFIED");

  await page.getByRole("button", { name: /Play Now/i }).click();
  await page.getByText(/You're ready to play/i).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /Start Session/i }).click();
  await page.getByText(/Session started/i).waitFor({ timeout: 30000 });
  const playNow = (await dbSnapshot(client, email, user.id, keys)).reservationRows.find((row) => row.mode === "PLAY_NOW");
  const cancelStartedSession = await page.evaluate(async (reservationId) => {
    const response = await fetch(`/api/member/reservations/${reservationId}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: `cancel-started-${reservationId}` }) });
    return { status: response.status, body: await response.json() };
  }, playNow.id);
  if (cancelStartedSession.status !== 409 || cancelStartedSession.body.error !== "SESSION_ALREADY_STARTED") throw new Error(`started-session cancellation was not rejected ${JSON.stringify(cancelStartedSession)}`);
  log("SESSION_START_CANCELLATION_BOUNDARY_VERIFIED");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Practice Suite Availability" }).waitFor({ timeout: 30000 });
  assertEqual(await visibleCredits(page), 123, "credits after refresh");
  log("BROWSER_REFRESH_VERIFIED");

  const reloginContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const reloginPage = await reloginContext.newPage();
  await login(reloginPage, email);
  assertEqual(await visibleCredits(reloginPage), 123, "credits after fresh login");
  await reloginContext.close();
  log("LOGOUT_LOGIN_EQUIVALENT_VERIFIED");

  let finalSnapshot = await dbSnapshot(client, email, user.id, keys);
  for (const [label, value] of Object.entries({ people: 1, authPrincipals: 1, profiles: 1, memberships: 1, monthlyGrants: 1, devGrants: 1, availableCredits: 123, reservations: 3, cancelledReservations: 2, checkedInReservations: 1, advanceReservations: 2, playNowReservations: 1, sessions: 1, accessGrants: 3, revokedAccessGrants: 2, activeAccessGrants: 1 })) assertEqual(finalSnapshot[label], value, label);
  if (finalSnapshot.ledgerByType.grant !== 2 || finalSnapshot.ledgerByType.hold !== 3 || finalSnapshot.ledgerByType.commit !== 3 || finalSnapshot.ledgerByType.refund !== 2) throw new Error(`unexpected ledger shape ${JSON.stringify(finalSnapshot.ledgerByType)}`);
  for (const [type, count] of Object.entries({ "reservation.created": 3, "access.grant.created": 3, "reservation.cancellation.requested": 2, "reservation.cancelled": 2, "credit.compensated": 2, "access.grant.revoked": 2, "session.started": 1 })) {
    if (finalSnapshot.auditByType[type] !== count) throw new Error(`audit ${type}: expected ${count}, got ${finalSnapshot.auditByType[type]}`);
  }
  log("DATABASE_RECORDS_AND_IDEMPOTENCY_VERIFIED");

  await context.close();
  await browser.close();
  browser = null;

  restartDevServer();
  await waitForServer();
  const browserAfterRestart = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
  try {
    const restartPage = await (await browserAfterRestart.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await login(restartPage, email);
    assertEqual(await visibleCredits(restartPage), 123, "credits after dev server restart");
    await restartPage.getByRole("button", { name: "Play", exact: true }).click();
    await restartPage.getByText("History", { exact: true }).waitFor({ timeout: 30000 });
  } finally {
    await browserAfterRestart.close();
  }
  log("DEV_SERVER_RESTART_VERIFIED");

  finalSnapshot = await dbSnapshot(client, email, user.id, keys);
  log("FINAL_DB_SUMMARY_START");
  log(JSON.stringify({
    clerkUserId: user.id,
    email,
    people: finalSnapshot.people,
    authPrincipals: finalSnapshot.authPrincipals,
    profiles: finalSnapshot.profiles,
    memberships: finalSnapshot.memberships,
    monthlyGrants: finalSnapshot.monthlyGrants,
    devGrants: finalSnapshot.devGrants,
    availableCredits: finalSnapshot.availableCredits,
    ledgerByType: finalSnapshot.ledgerByType,
    reservations: finalSnapshot.reservations,
    cancelledReservations: finalSnapshot.cancelledReservations,
    checkedInReservations: finalSnapshot.checkedInReservations,
    sessions: finalSnapshot.sessions,
    accessGrants: finalSnapshot.accessGrants,
    revokedAccessGrants: finalSnapshot.revokedAccessGrants,
    activeAccessGrants: finalSnapshot.activeAccessGrants,
    auditByType: finalSnapshot.auditByType,
    reservationRows: finalSnapshot.reservationRows,
  }, null, 2));
  log("FINAL_DB_SUMMARY_END");
} finally {
  if (browser?.isConnected()) await browser.close().catch(() => undefined);
  await client.end().catch(() => undefined);
}