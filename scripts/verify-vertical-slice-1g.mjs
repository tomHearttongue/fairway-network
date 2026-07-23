import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { chromium } from "playwright-core";
import { clerk, clerkSetup } from "@clerk/testing/playwright";

const repoRoot = process.cwd();
const logPath = `${repoRoot}\\.verification-1g.log`;
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

async function deleteRuntimeVerificationUsers(env) {
  const result = await clerkApi(env, "/users?limit=100&query=fairway-vs1");
  const users = Array.isArray(result) ? result : (result.data ?? []);
  let deleted = 0;
  for (const user of users) {
    const emails = user.email_addresses?.map((entry) => entry.email_address) ?? [];
    const isRuntimeUser = Boolean(user.public_metadata?.fairwayRuntimeVerification) || emails.some((email) => /^fairway-vs1[a-z-]*-.*@example\.com$/i.test(email));
    if (!isRuntimeUser) continue;
    await clerkApi(env, `/users/${user.id}`, { method: "DELETE" });
    deleted += 1;
  }
  log(`CLERK_RUNTIME_USERS_DELETED ${deleted}`);
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

async function assertMemberExperienceBasics(page, label) {
  const basics = await page.evaluate(() => {
    const isVisible = (element) => Boolean((element.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? (element.offsetWidth || element.offsetHeight || element.getClientRects().length)));
    const isThirdPartyAuthControl = (element) => Boolean(element.closest(".cl-rootBox, .cl-userButtonBox, [class*=\"cl-\"], [data-clerk-element], [data-clerk-component]"));
    const hasAccessibleName = (element) => Boolean(element.innerText.trim() || element.textContent?.trim() || element.getAttribute("aria-label") || element.getAttribute("title") || element.getAttribute("aria-labelledby") || element.querySelector("img[alt]")?.getAttribute("alt") || element.querySelector("svg title")?.textContent?.trim());
    const buttons = Array.from(document.querySelectorAll("main button, nav button"));
    const inputs = Array.from(document.querySelectorAll("input"));
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      unlabeledButtons: buttons.filter((button) => isVisible(button) && !isThirdPartyAuthControl(button) && !hasAccessibleName(button)).length,
      unlabeledInputs: inputs.filter((input) => isVisible(input) && !(input.labels?.length || input.getAttribute("aria-label") || input.getAttribute("placeholder"))).length,
      statusRegions: document.querySelectorAll('[role="status"]').length,
    };
  });
  assert(basics.overflow <= 2, `${label} has horizontal overflow ${basics.overflow}`);
  assertEqual(basics.unlabeledButtons, 0, `${label} unlabeled Fairway-owned buttons`);
  assertEqual(basics.unlabeledInputs, 0, `${label} unlabeled inputs`);
}

async function suiteStatus(client, suiteId) {
  const result = await client.query("select status from suites where id = $1", [suiteId]);
  if (result.rowCount !== 1) throw new Error(`suite ${suiteId} not found`);
  return result.rows[0].status;
}

async function goldenSnapshot(client, memberEmail) {
  const result = await client.query(`
    with target_profile as (select mp.* from member_profiles mp join people pe on pe.id = mp.person_id where pe.email = $1),
    target_reservations as (select * from reservations where member_profile_id in (select id from target_profile)),
    target_sessions as (select * from sessions where member_profile_id in (select id from target_profile))
    select jsonb_build_object(
      'people', (select count(*)::int from people where email = $1),
      'profiles', (select count(*)::int from target_profile),
      'reservations', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'suiteId', suite_id, 'mode', booking_mode, 'status', status) order by created_at) from target_reservations), '[]'::jsonb),
      'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'reservationId', reservation_id, 'suiteId', suite_id, 'endedAt', ended_at) order by created_at) from target_sessions), '[]'::jsonb),
      'accessGrants', coalesce((select jsonb_agg(jsonb_build_object('reservationId', reservation_id, 'status', status) order by created_at) from access_grants where member_profile_id in (select id from target_profile)), '[]'::jsonb),
      'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', ft.id, 'suiteId', ft.suite_id, 'type', ft.task_type, 'status', ft.status) order by ft.created_at) from facility_tasks ft where ft.source_session_id in (select id from target_sessions)), '[]'::jsonb),
      'auditByType', coalesce((select jsonb_object_agg(type, count) from (select type, count(*)::int from audit_events where actor_id in (select id::text from target_profile) group by type) typed), '{}'::jsonb)
    ) as snapshot
  `, [memberEmail]);
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
await deleteRuntimeVerificationUsers(env);
log("SERVER_AND_CLERK_TESTING_READY");

const stamp = Date.now();
const memberEmail = `fairway-vs1g-tom-${stamp}@example.com`;
const facilitiesEmail = `fairway-vs1g-facilities-${stamp}@example.com`;
for (const [email, lastName] of [[memberEmail, "DemoGolfer"], [facilitiesEmail, "Facilities"]]) {
  await clerkApi(env, "/users", { method: "POST", body: JSON.stringify({ email_address: [email], first_name: email === memberEmail ? "Tom" : "Fairway", last_name: lastName, skip_password_requirement: true, public_metadata: { fairwayRuntimeVerification: "vertical-slice-1g" } }) });
}
log("CLERK_USERS_CREATED");

const client = await connectDb(env);
await client.query(`
  with verifier_profiles as (
    select mp.id from member_profiles mp join people pe on pe.id = mp.person_id where pe.email like 'fairway-vs1g-%@example.com'
  ), verifier_reservations as (
    select id from reservations where member_profile_id in (select id from verifier_profiles)
  )
  update reservations set status = 'completed'
  where id in (select id from verifier_reservations) and status in ('held', 'confirmed', 'checked_in')
`);
await client.query(`
  with verifier_profiles as (
    select mp.id from member_profiles mp join people pe on pe.id = mp.person_id where pe.email like 'fairway-vs1g-%@example.com'
  ), verifier_reservations as (
    select id from reservations where member_profile_id in (select id from verifier_profiles)
  )
  update access_grants set status = 'expired', revoked_at = coalesce(revoked_at, now())
  where reservation_id in (select id from verifier_reservations) and status = 'active'
`);
await client.query("update facility_tasks set status = 'completed', completed_at = coalesce(completed_at, now()) where source_session_id in (select s.id from sessions s join reservations r on r.id = s.reservation_id join member_profiles mp on mp.id = r.member_profile_id join people pe on pe.id = mp.person_id where pe.email like 'fairway-vs1g-%@example.com') and status in ('open', 'claimed', 'in_progress')");
await client.query("update suites set status = 'available' where location_id = '00000000-0000-0000-0000-000000000001'");
log("PRIOR_VS1G_RESIDUE_RETIRED");

let browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
try {
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const memberPage = await mobileContext.newPage();
  await login(memberPage, memberEmail, "/");
  await memberPage.getByRole("heading", { name: /Ready to play/ }).waitFor({ timeout: 45000 });
  await memberPage.getByRole("navigation", { name: "Member navigation" }).waitFor({ timeout: 30000 });
  await memberPage.getByRole("button", { name: "Home", exact: true }).waitFor();
  await memberPage.getByRole("button", { name: "Play", exact: true }).waitFor();
  await memberPage.getByRole("button", { name: "My Golf", exact: true }).waitFor();
  await memberPage.getByText("credits").first().waitFor();
  await assertMemberExperienceBasics(memberPage, "mobile home");
  log("MEMBER_HOME_IA_AND_MOBILE_BASICS_VERIFIED");

  const availability = await memberPage.evaluate(async () => {
    const response = await fetch("/api/member/availability", { cache: "no-store" });
    return { status: response.status, body: await response.json() };
  });
  assertEqual(availability.status, 200, "availability status");
  assertEqual(availability.body.demoGolfProfile.id, "demo_tom_golfer", "demo golfer id");
  assertEqual(availability.body.demoGolfProfile.officialGolf.handicapIndex, 8.4, "demo handicap index");
  assert(availability.body.demoGolfProfile.officialGolf.source.includes("Demo"), "official golf source is clearly marked as demo");
  const driver = availability.body.demoGolfProfile.performance.find((club) => club.clubCode === "driver");
  assertEqual(driver.typicalCarryYards, 264, "driver demo carry");
  log("DETERMINISTIC_DEMO_GOLF_PROFILE_VERIFIED");

  await memberPage.getByRole("button", { name: "My Golf", exact: true }).click();
  await memberPage.getByText("Golfer Passport").waitFor();
  await memberPage.getByText("Handicap Index").waitFor();
  await memberPage.getByText("Demo official handicap").waitFor();
  await memberPage.getByText("Driver", { exact: true }).waitFor();
  await memberPage.getByText("264 yd").waitFor();
  await memberPage.getByText("7 Iron", { exact: true }).waitFor();
  await memberPage.getByText("PW", { exact: true }).waitFor();
  await assertMemberExperienceBasics(memberPage, "mobile my golf");
  log("GOLFER_PASSPORT_PRESENTATION_VERIFIED");

  await memberPage.getByRole("button", { name: "Play", exact: true }).click();
  await memberPage.getByText("Suite details").waitFor();
  await memberPage.getByText("Guests").waitFor();
  await assertMemberExperienceBasics(memberPage, "mobile play");

  const playNowButton = memberPage.getByRole("button", { name: "Confirm Play Now" }).first();
  assert(await playNowButton.isEnabled(), "Play Now button should be enabled for golden demo");
  await playNowButton.click();
  await memberPage.getByText(/is ready|You are ready/i).first().waitFor({ timeout: 45000 });
  await memberPage.getByRole("button", { name: /Start Session/i }).first().click();
  await memberPage.getByText("Session started", { exact: false }).waitFor({ timeout: 45000 });
  await memberPage.getByRole("button", { name: /Finish Session/i }).first().click();
  await memberPage.getByRole("status").filter({ hasText: "Session complete" }).waitFor({ timeout: 45000 });
  log("MEMBER_PLAY_NOW_SESSION_COMPLETION_UI_VERIFIED");

  const memberSnapshot = await retry("golden member snapshot", async () => {
    const snapshot = await goldenSnapshot(client, memberEmail);
    const completedReservation = snapshot.reservations.find((reservation) => reservation.status === "completed" && reservation.mode === "PLAY_NOW");
    assert(completedReservation, "completed Play Now reservation missing");
    assert(snapshot.sessions.some((session) => session.reservationId === completedReservation.id && session.endedAt), "completed session missing");
    assert(snapshot.accessGrants.some((grant) => grant.reservationId === completedReservation.id && grant.status === "expired"), "expired access grant missing");
    assert(snapshot.tasks.some((task) => task.suiteId === completedReservation.suiteId && task.type === "turnover" && task.status === "open"), "open turnover task missing");
    return { snapshot, reservation: completedReservation, task: snapshot.tasks.find((task) => task.suiteId === completedReservation.suiteId && task.type === "turnover" && task.status === "open") };
  }, 30000);
  assertEqual(await suiteStatus(client, memberSnapshot.reservation.suiteId), "turnover", "suite turnover status for golden demo");
  log("PERSISTED_GOLDEN_DEMO_LIFECYCLE_VERIFIED");

  await memberPage.reload({ waitUntil: "domcontentloaded" });
  await memberPage.getByRole("heading", { name: /Ready to play/ }).waitFor({ timeout: 45000 });
  await memberPage.getByRole("button", { name: "My Golf", exact: true }).click();
  await memberPage.getByText("Golfer Passport").waitFor();
  log("REFRESH_PERSISTENCE_VERIFIED");

  restartDevServer();
  await waitForServer();
  await memberPage.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await memberPage.getByRole("heading", { name: /Ready to play/ }).waitFor({ timeout: 45000 });
  log("SERVER_RESTART_RESILIENCE_VERIFIED");

  const facilitiesContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const facilitiesPage = await facilitiesContext.newPage();
  await login(facilitiesPage, facilitiesEmail, "/");
  await facilitiesPage.getByRole("heading", { name: /Ready to play/ }).waitFor({ timeout: 45000 });
  const facilitiesProfile = await memberProfileForEmail(client, facilitiesEmail);
  await client.query("select fairway_grant_development_facilities($1, $2, $3)", [facilitiesProfile.id, facilitiesProfile.home_location_id, "Vertical Slice 1G golden demo facilities grant"]);
  await facilitiesPage.goto("http://localhost:3000/facilities", { waitUntil: "domcontentloaded" });
  await facilitiesPage.getByRole("heading", { name: "What should I service now?" }).waitFor({ timeout: 45000 });
  await facilitiesPage.getByText("Next Best Action").waitFor({ timeout: 30000 });
  const facilitiesBasics = await facilitiesPage.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, unlabeledButtons: Array.from(document.querySelectorAll("main button, nav button")).filter((button) => !(button.innerText.trim() || button.getAttribute("aria-label") || button.getAttribute("title"))).length }));
  assert(facilitiesBasics.overflow <= 2, `facilities mobile overflow ${facilitiesBasics.overflow}`);
  assertEqual(facilitiesBasics.unlabeledButtons, 0, "facilities unlabeled buttons");

  const claimed = await facilitiesPage.evaluate(async (taskId) => {
    const response = await fetch(`/api/facilities/tasks/${taskId}/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: `vs1g-claim-${taskId}` }) });
    return { status: response.status, body: await response.json() };
  }, memberSnapshot.task.id);
  assertEqual(claimed.status, 200, "golden task claim status");
  const started = await facilitiesPage.evaluate(async (taskId) => {
    const response = await fetch(`/api/facilities/tasks/${taskId}/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: `vs1g-start-${taskId}` }) });
    return { status: response.status, body: await response.json() };
  }, memberSnapshot.task.id);
  assertEqual(started.status, 200, "golden task start status");
  const completed = await facilitiesPage.evaluate(async (taskId) => {
    const response = await fetch(`/api/facilities/tasks/${taskId}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ completionNotes: "Golden demo suite ready", idempotencyKey: `vs1g-complete-${taskId}` }) });
    return { status: response.status, body: await response.json() };
  }, memberSnapshot.task.id);
  assertEqual(completed.status, 200, "golden task complete status");
  assertEqual(completed.body.task.status, "completed", "golden turnover completed");
  assertEqual(await suiteStatus(client, memberSnapshot.reservation.suiteId), "available", "golden suite restored to available");
  await facilitiesContext.close();
  log("FACILITIES_PERSONA_TURNOVER_RESTORATION_VERIFIED");

  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const desktopPage = await desktopContext.newPage();
  await login(desktopPage, memberEmail, "/");
  await desktopPage.getByRole("heading", { name: /Ready to play/ }).waitFor({ timeout: 45000 });
  await desktopPage.getByRole("button", { name: "My Golf", exact: true }).click();
  await desktopPage.getByText("Golfer Passport").waitFor();
  await assertMemberExperienceBasics(desktopPage, "desktop member experience");
  await desktopContext.close();
  await mobileContext.close();
  log("DESKTOP_RESPONSIVE_BASICS_VERIFIED");

  const finalSnapshot = await goldenSnapshot(client, memberEmail);
  assertEqual(finalSnapshot.people, 1, "golden demo person count");
  assertEqual(finalSnapshot.profiles, 1, "golden demo member profile count");
  assert(finalSnapshot.reservations.some((reservation) => reservation.status === "completed"), "completed reservation persisted");
  assert(finalSnapshot.tasks.some((task) => task.status === "completed"), "completed turnover task persisted");
  log("FINAL_DATABASE_SNAPSHOT_VERIFIED");
  console.log("Vertical Slice 1G golden demo verification passed. Details: .verification-1g.log");
} finally {
  await browser.close().catch(() => {});
  await client.end().catch(() => {});
}