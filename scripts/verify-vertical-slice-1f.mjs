import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { chromium } from "playwright-core";
import { clerk, clerkSetup } from "@clerk/testing/playwright";

const repoRoot = process.cwd();
const logPath = `${repoRoot}\\.verification-1f.log`;
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

async function guestSnapshot(client, hostEmail) {
  const result = await client.query(`
    with target_profile as (select mp.* from member_profiles mp join people pe on pe.id = mp.person_id where pe.email = $1),
    target_reservations as (select * from reservations where member_profile_id in (select id from target_profile)),
    target_guests as (select rg.* from reservation_guests rg where rg.reservation_id in (select id from target_reservations))
    select jsonb_build_object(
      'people', (select count(*)::int from people where email = $1),
      'profiles', (select count(*)::int from target_profile),
      'reservations', (select count(*)::int from target_reservations),
      'reservationGuests', coalesce((select jsonb_agg(jsonb_build_object('id', rg.id, 'status', rg.status, 'guestId', rg.guest_id) order by rg.created_at) from target_guests rg), '[]'::jsonb),
      'agreementAcceptances', coalesce((select jsonb_agg(jsonb_build_object('guestId', aa.guest_id, 'status', aa.status, 'verificationState', aa.verification_state, 'evidenceReference', aa.evidence_reference) order by aa.created_at) from agreement_acceptances aa where aa.guest_id in (select guest_id from target_guests)), '[]'::jsonb),
      'domainEvents', coalesce((select jsonb_object_agg(event_name, count) from (select event_name, count(*)::int from domain_events where actor_id in (select id::text from target_profile) group by event_name) typed), '{}'::jsonb),
      'auditByType', coalesce((select jsonb_object_agg(type, count) from (select type, count(*)::int from audit_events where actor_id in (select id::text from target_profile) group by type) typed), '{}'::jsonb)
    ) as snapshot
  `, [hostEmail]);
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
const hostEmail = `fairway-vs1f-host-${stamp}@example.com`;
const concurrentHostEmail = `fairway-vs1f-concurrent-${stamp}@example.com`;
const unauthorizedEmail = `fairway-vs1f-unauthorized-${stamp}@example.com`;
const facilitiesEmail = `fairway-vs1f-facilities-${stamp}@example.com`;
for (const [email, lastName] of [[hostEmail, "Host"], [concurrentHostEmail, "Concurrent"], [unauthorizedEmail, "NoAccess"], [facilitiesEmail, "Facilities"]]) {
  await clerkApi(env, "/users", { method: "POST", body: JSON.stringify({ email_address: [email], first_name: "Fairway", last_name: lastName, skip_password_requirement: true, public_metadata: { fairwayRuntimeVerification: "vertical-slice-1f" } }) });
}
log("CLERK_USERS_CREATED");

const client = await connectDb(env);
await client.query(`
  with verifier_profiles as (
    select mp.id from member_profiles mp join people pe on pe.id = mp.person_id where pe.email like 'fairway-vs1%@example.com'
  ), verifier_reservations as (
    select id from reservations where member_profile_id in (select id from verifier_profiles)
  )
  update reservations set status = 'completed'
  where id in (select id from verifier_reservations) and status in ('held', 'confirmed', 'checked_in')
`);
await client.query(`
  with verifier_profiles as (
    select mp.id from member_profiles mp join people pe on pe.id = mp.person_id where pe.email like 'fairway-vs1%@example.com'
  ), verifier_reservations as (
    select id from reservations where member_profile_id in (select id from verifier_profiles)
  )
  update access_grants set status = 'expired', revoked_at = coalesce(revoked_at, now())
  where reservation_id in (select id from verifier_reservations) and status = 'active'
`);
await client.query(`
  with verifier_profiles as (
    select mp.id from member_profiles mp join people pe on pe.id = mp.person_id where pe.email like 'fairway-vs1%@example.com'
  ), verifier_reservations as (
    select id from reservations where member_profile_id in (select id from verifier_profiles)
  )
  update sessions set ended_at = coalesce(ended_at, now())
  where reservation_id in (select id from verifier_reservations)
`);
await client.query("update facility_tasks set status = 'completed', completed_at = coalesce(completed_at, now()) where source_session_id in (select s.id from sessions s join reservations r on r.id = s.reservation_id join member_profiles mp on mp.id = r.member_profile_id join people pe on pe.id = mp.person_id where pe.email like 'fairway-vs1%@example.com') and status in ('open', 'claimed', 'in_progress')");
await client.query("update suites set status = 'available' where location_id = '00000000-0000-0000-0000-000000000001'");
log("PRIOR_VERIFICATION_RESIDUE_RETIRED");
let browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });

try {
  const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const hostPage = await hostContext.newPage();
  await login(hostPage, hostEmail, "/");
  await hostPage.getByRole("heading", { name: /Ready to play/i }).waitFor({ timeout: 45000 });

  const hostStart = new Date(Date.now() + (10 + (stamp % 3)) * 60_000);
  const hostEnd = new Date(hostStart.getTime() + 30 * 60_000);
  const hostSuite = await client.query("select s.id from suites s where not exists (select 1 from reservations r where r.suite_id = s.id and r.status in ('held', 'confirmed', 'checked_in') and tstzrange(r.start_at, r.end_at, '[)') && tstzrange($1::timestamptz, $2::timestamptz, '[)')) order by s.name limit 1", [hostStart.toISOString(), hostEnd.toISOString()]);
  if (hostSuite.rowCount !== 1) throw new Error("NO_CONFLICT_FREE_SUITE_FOR_HOST_GUEST_TEST");
  await client.query("update suites set status = 'available' where id = $1", [hostSuite.rows[0].id]);
  const playNow = await hostPage.evaluate(async ({ stamp, suiteId, startAt, endAt }) => {
    const response = await fetch("/api/member/reservations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "ADVANCE", suiteId, startAt, endAt, creditCost: 1, idempotencyKey: `vs1f-host-advance-${stamp}` }) });
    return { status: response.status, body: await response.json() };
  }, { stamp, suiteId: hostSuite.rows[0].id, startAt: hostStart.toISOString(), endAt: hostEnd.toISOString() });
  assertEqual(playNow.status, 200, "host near-future advance status");
  const reservationId = playNow.body.reservation.id;

  const firstGuest = await hostPage.evaluate(async ({ reservationId, stamp }) => {
    const response = await fetch(`/api/member/reservations/${reservationId}/guests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ guestName: "Casey Guest", guestEmail: `casey-${stamp}@example.com`, idempotencyKey: `vs1f-guest-add-${stamp}` }) });
    return { status: response.status, body: await response.json() };
  }, { reservationId, stamp });
  assertEqual(firstGuest.status, 200, "guest add status");
  const reservationGuestId = firstGuest.body.reservationGuest.id;

  const retryGuest = await hostPage.evaluate(async ({ reservationId, stamp }) => {
    const response = await fetch(`/api/member/reservations/${reservationId}/guests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ guestName: "Casey Guest", guestEmail: `casey-${stamp}@example.com`, idempotencyKey: `vs1f-guest-add-${stamp}` }) });
    return { status: response.status, body: await response.json() };
  }, { reservationId, stamp });
  assertEqual(retryGuest.status, 200, "idempotent guest retry status");
  assertEqual(retryGuest.body.idempotent, true, "idempotent guest retry flag");

  const overLimit = await hostPage.evaluate(async ({ reservationId, stamp }) => {
    const response = await fetch(`/api/member/reservations/${reservationId}/guests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ guestName: "Second Guest", guestEmail: `second-${stamp}@example.com`, idempotencyKey: `vs1f-guest-over-limit-${stamp}` }) });
    return { status: response.status, body: await response.json() };
  }, { reservationId, stamp });
  assertEqual(overLimit.status, 409, "over-limit guest rejected");
  assert(String(overLimit.body.error).includes("GUEST_ALLOWANCE_EXCEEDED"), "over-limit rejection reason");
  log("GUEST_ASSOCIATION_ALLOWANCE_AND_IDEMPOTENCY_VERIFIED");

  const blocked = await hostPage.evaluate(async ({ reservationId, reservationGuestId }) => {
    const response = await fetch(`/api/member/reservations/${reservationId}/guests/${reservationGuestId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "check_eligibility", idempotencyKey: `vs1f-eligibility-blocked-${reservationGuestId}` }) });
    return { status: response.status, body: await response.json() };
  }, { reservationId, reservationGuestId });
  assertEqual(blocked.status, 200, "blocked eligibility status");
  assertEqual(blocked.body.ready, false, "guest not ready before waiver");
  assertEqual(blocked.body.blockedReason, "WAIVER_ACCEPTANCE_REQUIRED", "missing waiver blocks access");

  const waiverRequested = await hostPage.evaluate(async ({ reservationId, reservationGuestId }) => {
    const response = await fetch(`/api/member/reservations/${reservationId}/guests/${reservationGuestId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "request_waiver", idempotencyKey: `vs1f-waiver-request-${reservationGuestId}` }) });
    return { status: response.status, body: await response.json() };
  }, { reservationId, reservationGuestId });
  assertEqual(waiverRequested.status, 200, "waiver request status");
  assertEqual(waiverRequested.body.acceptance.status, "requested", "waiver requested acceptance status");

  const waiverCompleted = await hostPage.evaluate(async ({ reservationId, reservationGuestId }) => {
    const response = await fetch(`/api/member/reservations/${reservationId}/guests/${reservationGuestId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "complete_waiver", idempotencyKey: `vs1f-waiver-complete-${reservationGuestId}` }) });
    return { status: response.status, body: await response.json() };
  }, { reservationId, reservationGuestId });
  assertEqual(waiverCompleted.status, 200, "waiver complete status");
  assertEqual(waiverCompleted.body.ready, true, "guest ready after waiver");
  assert(waiverCompleted.body.acceptance.evidenceReference?.startsWith("fake-waiver-evidence-"), "fake waiver evidence reference recorded");

  const eligible = await hostPage.evaluate(async ({ reservationId, reservationGuestId }) => {
    const response = await fetch(`/api/member/reservations/${reservationId}/guests/${reservationGuestId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "check_eligibility", idempotencyKey: `vs1f-eligibility-ready-${reservationGuestId}` }) });
    return { status: response.status, body: await response.json() };
  }, { reservationId, reservationGuestId });
  assertEqual(eligible.status, 200, "ready eligibility status");
  assertEqual(eligible.body.ready, true, "guest ready after waiver eligibility check");
  assertEqual(eligible.body.accessEligible, true, "guest access eligible in active access window");
  log("WAIVER_EVIDENCE_AND_ACCESS_ELIGIBILITY_VERIFIED");

  const unauthorizedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const unauthorizedPage = await unauthorizedContext.newPage();
  await login(unauthorizedPage, unauthorizedEmail, "/");
  const unauthorizedAdd = await unauthorizedPage.evaluate(async ({ reservationId, stamp }) => {
    const response = await fetch(`/api/member/reservations/${reservationId}/guests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ guestName: "Wrong Host", guestEmail: `wrong-${stamp}@example.com`, idempotencyKey: `vs1f-wrong-host-${stamp}` }) });
    return { status: response.status, body: await response.json() };
  }, { reservationId, stamp });
  assertEqual(unauthorizedAdd.status, 409, "unauthorized host mutation rejected");
  await unauthorizedContext.close();
  log("HOST_OWNERSHIP_ENFORCED");

  const concurrentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const concurrentPage = await concurrentContext.newPage();
  await login(concurrentPage, concurrentHostEmail, "/");
  await concurrentPage.getByRole("heading", { name: /Ready to play/i }).waitFor({ timeout: 45000 });
  const concurrentStart = new Date(Date.now() + (48 * 60 + (stamp % 180)) * 60_000);
  const concurrentEnd = new Date(concurrentStart.getTime() + 30 * 60_000);
  const concurrentSuite = await client.query("select s.id from suites s where not exists (select 1 from reservations r where r.suite_id = s.id and r.status in ('held', 'confirmed', 'checked_in') and tstzrange(r.start_at, r.end_at, '[)') && tstzrange($1::timestamptz, $2::timestamptz, '[)')) order by s.name limit 1", [concurrentStart.toISOString(), concurrentEnd.toISOString()]);
  if (concurrentSuite.rowCount !== 1) throw new Error("NO_CONFLICT_FREE_SUITE_FOR_CONCURRENT_GUEST_TEST");
  await client.query("update suites set status = 'available' where id = $1", [concurrentSuite.rows[0].id]);
  const concurrentReservation = await concurrentPage.evaluate(async ({ stamp, suiteId, startAt, endAt }) => {
    const response = await fetch("/api/member/reservations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "ADVANCE", suiteId, startAt, endAt, creditCost: 1, idempotencyKey: `vs1f-concurrent-advance-${stamp}` }) });
    return { status: response.status, body: await response.json() };
  }, { stamp, suiteId: concurrentSuite.rows[0].id, startAt: concurrentStart.toISOString(), endAt: concurrentEnd.toISOString() });
  assertEqual(concurrentReservation.status, 200, "concurrent host advance reservation status");
  const concurrentAttempts = await concurrentPage.evaluate(async ({ reservationId, stamp }) => Promise.all([
    fetch(`/api/member/reservations/${reservationId}/guests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ guestName: "Concurrent A", guestEmail: `concurrent-a-${stamp}@example.com`, idempotencyKey: `vs1f-concurrent-a-${stamp}` }) }).then(async (response) => ({ status: response.status, body: await response.json() })),
    fetch(`/api/member/reservations/${reservationId}/guests`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ guestName: "Concurrent B", guestEmail: `concurrent-b-${stamp}@example.com`, idempotencyKey: `vs1f-concurrent-b-${stamp}` }) }).then(async (response) => ({ status: response.status, body: await response.json() })),
  ]), { reservationId: concurrentReservation.body.reservation.id, stamp });
  assertEqual(concurrentAttempts.filter((item) => item.status === 200).length, 1, "one successful concurrent guest add");
  assertEqual(concurrentAttempts.filter((item) => item.status === 409).length, 1, "one rejected concurrent guest add");
  await concurrentContext.close();
  log("CONCURRENT_ALLOWANCE_PROTECTION_VERIFIED");

  const facilitiesContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const facilitiesPage = await facilitiesContext.newPage();
  await login(facilitiesPage, facilitiesEmail, "/");
  await facilitiesPage.getByRole("heading", { name: /Ready to play/i }).waitFor({ timeout: 45000 });
  const facilitiesProfile = await memberProfileForEmail(client, facilitiesEmail);
  await client.query("select fairway_grant_development_facilities($1, $2, $3)", [facilitiesProfile.id, facilitiesProfile.home_location_id, "Vertical Slice 1F runtime verification facilities grant"]);
  const facilitiesState = await facilitiesPage.evaluate(async () => {
    const response = await fetch("/api/facilities/state");
    return { status: response.status, text: await response.text() };
  });
  assertEqual(facilitiesState.status, 200, "facilities state status");
  assert(!facilitiesState.text.includes("Casey Guest"), "facilities state does not expose guest name");
  assert(!facilitiesState.text.includes(`casey-${stamp}@example.com`), "facilities state does not expose guest email");
  await facilitiesContext.close();
  log("FACILITIES_GUEST_PRIVACY_VERIFIED");

  const removeGuest = await hostPage.evaluate(async ({ reservationId, reservationGuestId }) => {
    const response = await fetch(`/api/member/reservations/${reservationId}/guests/${reservationGuestId}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: `vs1f-remove-${reservationGuestId}` }) });
    return { status: response.status, body: await response.json() };
  }, { reservationId, reservationGuestId });
  assertEqual(removeGuest.status, 200, "guest remove status");
  const retryRemove = await hostPage.evaluate(async ({ reservationId, reservationGuestId }) => {
    const response = await fetch(`/api/member/reservations/${reservationId}/guests/${reservationGuestId}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: `vs1f-remove-${reservationGuestId}` }) });
    return { status: response.status, body: await response.json() };
  }, { reservationId, reservationGuestId });
  assertEqual(retryRemove.status, 200, "idempotent guest remove status");
  assertEqual(retryRemove.body.idempotent, true, "idempotent guest remove flag");

  await hostPage.reload({ waitUntil: "domcontentloaded" });
  await hostPage.getByRole("heading", { name: /Ready to play/i }).waitFor({ timeout: 45000 });
  restartDevServer();
  await waitForServer();
  await hostPage.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await hostPage.getByRole("heading", { name: /Ready to play/i }).waitFor({ timeout: 45000 });
  const persisted = await hostPage.evaluate(async () => {
    const response = await fetch("/api/member/availability", { cache: "no-store" });
    return { status: response.status, body: await response.json() };
  });
  assertEqual(persisted.status, 200, "member availability after restart");
  const persistedReservation = persisted.body.reservations.find((reservation) => reservation.id === reservationId);
  assert(persistedReservation?.guests.some((guest) => guest.id === reservationGuestId && guest.status === "removed"), "removed guest association persists after restart");
  log("PERSISTENCE_REFRESH_AND_RESTART_VERIFIED");

  const snapshot = await guestSnapshot(client, hostEmail);
  assertEqual(snapshot.people, 1, "one Fairway person for host");
  assertEqual(snapshot.profiles, 1, "one Fairway profile for host");
  assert(snapshot.reservationGuests.length === 1, "one host guest association after rejected/idempotent retries");
  assert(snapshot.agreementAcceptances.length === 1, "one guest waiver acceptance");
  assertEqual(snapshot.agreementAcceptances[0].status, "completed", "waiver acceptance persisted completed");
  assertEqual(snapshot.agreementAcceptances[0].verificationState, "verified", "waiver acceptance persisted verified");
  for (const eventName of ["guest.invited", "guest.associated", "guest.allowance_rejected", "guest.waiver_requested", "guest.waiver_completed", "guest.access_blocked", "guest.access_eligible", "guest.removed"]) {
    assert(snapshot.domainEvents[eventName] >= 1, `domain event recorded: ${eventName}`);
  }
  const piiCheck = await client.query("select count(*)::int as count from domain_events where dimensions::text ilike $1 or payload::text ilike $1", [`%casey-${stamp}@example.com%`]);
  assertEqual(piiCheck.rows[0].count, 0, "domain events do not include guest email");
  log("DATABASE_AUDIT_EVENT_AND_PRIVACY_ASSERTIONS_VERIFIED");

  console.log("Vertical Slice 1F verification passed. Details in .verification-1f.log");
} finally {
  await client.end().catch(() => undefined);
  await browser.close().catch(() => undefined);
}
