import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { chromium } from "playwright-core";
import { clerk, clerkSetup } from "@clerk/testing/playwright";

const repoRoot = process.cwd();
const logPath = `${repoRoot}\\.verification-1b.log`;
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
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
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
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`${label}: ${lastError?.message ?? lastError}`);
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
  if (!match) throw new Error(`Credits not visible in page text: ${text.slice(0, 400)}`);
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
      'advanceReservations', (select count(*)::int from target_reservations where booking_mode='ADVANCE'),
      'playNowReservations', (select count(*)::int from target_reservations where booking_mode='PLAY_NOW'),
      'checkedInReservations', (select count(*)::int from target_reservations where status='checked_in'),
      'sessions', (select count(*)::int from sessions where member_profile_id in (select id from target_profile)),
      'accessGrants', (select count(*)::int from access_grants where member_profile_id in (select id from target_profile)),
      'auditByType', coalesce((select jsonb_object_agg(type, count) from (select type, count(*)::int from audit_events where actor_id in (select id::text from target_profile) group by type) typed), '{}'::jsonb),
      'duplicateKeyReservations', (select count(*)::int from reservations where idempotency_key = any($3::text[])),
      'duplicateKeyAccessGrants', (select count(*)::int from access_grants where idempotency_key = any($4::text[])),
      'duplicateKeySessions', (select count(*)::int from sessions where idempotency_key = any($5::text[])),
      'reservationRows', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'mode', booking_mode, 'status', status, 'suiteId', suite_id, 'startAt', start_at, 'endAt', end_at, 'idempotencyKey', idempotency_key) order by created_at) from target_reservations), '[]'::jsonb)
    ) as snapshot
  `, [email, clerkUserId, keys.reservationKeys, keys.accessKeys, keys.sessionKeys]);
  return result.rows[0].snapshot;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
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
  await retry("server did not restart", async () => {
    const response = await fetch("http://localhost:3000", { redirect: "manual" });
    if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
    return true;
  }, 45000);
}

const env = loadEnv(".env.local");
process.env.CLERK_SECRET_KEY = env.CLERK_SECRET_KEY;
process.env.CLERK_PUBLISHABLE_KEY = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!env.CLERK_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Clerk secret key is not a development sk_test key");
if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")) throw new Error("Clerk publishable key is not a development pk_test key");
if (!env.DATABASE_URL?.startsWith("postgres")) throw new Error("DATABASE_URL is not a Postgres URL");

await clerkSetup();
log("CLERK_TESTING_SETUP_VERIFIED");

const stamp = Date.now();
const email = `fairway-vs1b-${stamp}@example.com`;
const user = await clerkApi(env, "/users", {
  method: "POST",
  body: JSON.stringify({
    email_address: [email],
    first_name: "Fairway",
    last_name: "Verifier",
    skip_password_requirement: true,
    public_metadata: { fairwayRuntimeVerification: "vertical-slice-1b" },
  }),
});
log(`CLERK_USER_CREATED ${user.id} ${email}`);

const keys = { reservationKeys: [], accessKeys: [], sessionKeys: [] };
const client = await connectDb(env);
let browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const reservationBodies = [];

  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/member/reservations")) {
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
  await page.getByText("Birdie membership").waitFor({ timeout: 30000 });
  assertEqual(await visibleCredits(page), 124, "initial visible credits");
  let snapshot = await dbSnapshot(client, email, user.id, keys);
  for (const [label, value] of Object.entries({ people: 1, authPrincipals: 1, profiles: 1, memberships: 1, monthlyGrants: 1, devGrants: 1, availableCredits: 124 })) assertEqual(snapshot[label], value, label);
  log("BOOTSTRAP_AND_INITIAL_CREDITS_VERIFIED");

  await page.getByRole("button", { name: /Book/i }).first().click();
  await page.getByText(/You're booked/i).waitFor({ timeout: 30000 });
  const advanceBody = reservationBodies.at(-1);
  const advanceRetry = await page.evaluate(async (body) => {
    const response = await fetch("/api/member/reservations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, advanceBody);
  if (advanceRetry.status !== 200 || advanceRetry.body.idempotent !== true) throw new Error(`advance retry failed ${JSON.stringify(advanceRetry)}`);
  log("ADVANCE_RESERVATION_AND_RETRY_VERIFIED");

  await page.getByRole("button", { name: /Play Now/i }).click();
  await page.getByText(/You're ready to play/i).waitFor({ timeout: 30000 });
  const playNowBody = reservationBodies.at(-1);
  const playNowRetry = await page.evaluate(async (body) => {
    const response = await fetch("/api/member/reservations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, playNowBody);
  if (playNowRetry.status !== 200 || playNowRetry.body.idempotent !== true) throw new Error(`play now retry failed ${JSON.stringify(playNowRetry)}`);
  log("PLAY_NOW_AND_RETRY_VERIFIED");

  await page.getByRole("button", { name: /Start Session/i }).click();
  await page.getByText(/Session started/i).waitFor({ timeout: 30000 });
  const playNowReservationId = playNowRetry.body.reservation.id;
  const sessionRetry = await page.evaluate(async ({ reservationId, key }) => {
    const response = await fetch("/api/member/session/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reservationId, idempotencyKey: key }) });
    return { status: response.status, body: await response.json() };
  }, { reservationId: playNowReservationId, key: keys.sessionKeys.at(-1) });
  if (sessionRetry.status !== 200) throw new Error(`session retry failed ${JSON.stringify(sessionRetry)}`);
  log("SESSION_START_AND_RETRY_VERIFIED");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Practice Suite Availability" }).waitFor({ timeout: 30000 });
  assertEqual(await visibleCredits(page), 122, "visible credits after browser refresh");
  log("BROWSER_REFRESH_VERIFIED");

  const reloginContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const reloginPage = await reloginContext.newPage();
  await login(reloginPage, email);
  assertEqual(await visibleCredits(reloginPage), 122, "visible credits after fresh login");
  await reloginContext.close();
  log("LOGOUT_LOGIN_EQUIVALENT_VERIFIED");

  snapshot = await dbSnapshot(client, email, user.id, keys);
  for (const [label, value] of Object.entries({ people: 1, authPrincipals: 1, profiles: 1, memberships: 1, monthlyGrants: 1, devGrants: 1, availableCredits: 122, reservations: 2, advanceReservations: 1, playNowReservations: 1, sessions: 1, accessGrants: 2, duplicateKeyReservations: 2, duplicateKeyAccessGrants: 2, duplicateKeySessions: 1 })) assertEqual(snapshot[label], value, label);
  if (snapshot.ledgerByType.grant !== 2 || snapshot.ledgerByType.hold !== 2 || snapshot.ledgerByType.commit !== 2) throw new Error(`unexpected ledger shape ${JSON.stringify(snapshot.ledgerByType)}`);
  if (snapshot.auditByType["reservation.created"] !== 2 || snapshot.auditByType["access.grant.created"] !== 2 || snapshot.auditByType["session.started"] !== 1) throw new Error(`unexpected audit shape ${JSON.stringify(snapshot.auditByType)}`);
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
    assertEqual(await visibleCredits(restartPage), 122, "visible credits after dev server restart");
  } finally {
    await browserAfterRestart.close();
  }
  log("DEV_SERVER_RESTART_VERIFIED");

  snapshot = await dbSnapshot(client, email, user.id, keys);
  log("FINAL_DB_SUMMARY_START");
  log(JSON.stringify({
    clerkUserId: user.id,
    email,
    people: snapshot.people,
    authPrincipals: snapshot.authPrincipals,
    profiles: snapshot.profiles,
    memberships: snapshot.memberships,
    monthlyGrants: snapshot.monthlyGrants,
    devGrants: snapshot.devGrants,
    availableCredits: snapshot.availableCredits,
    ledgerByType: snapshot.ledgerByType,
    reservations: snapshot.reservations,
    advanceReservations: snapshot.advanceReservations,
    playNowReservations: snapshot.playNowReservations,
    checkedInReservations: snapshot.checkedInReservations,
    sessions: snapshot.sessions,
    accessGrants: snapshot.accessGrants,
    auditByType: snapshot.auditByType,
    reservationRows: snapshot.reservationRows,
  }, null, 2));
  log("FINAL_DB_SUMMARY_END");
} finally {
  if (browser?.isConnected()) await browser.close().catch(() => undefined);
  await client.end().catch(() => undefined);
}