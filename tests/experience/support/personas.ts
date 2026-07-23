import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { Client } from "pg";
import type { Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import type { HarnessEnv } from "./env";

export type PersonaKey = "demo-active-birdie" | "new-golfer" | "power-tour-member" | "guest-host-member" | "constrained-member" | "facilities-user";

export type ExperiencePersona = {
  key: PersonaKey;
  email: string;
  firstName: string;
  lastName: string;
  description: string;
};

export const PERSONAS: Record<PersonaKey, ExperiencePersona> = {
  "demo-active-birdie": { key: "demo-active-birdie", email: "fairway-ux-demo-active-birdie@example.com", firstName: "Tom", lastName: "DemoGolfer", description: "Primary Golden Demo golfer with active Birdie membership and established demo baselines." },
  "new-golfer": { key: "new-golfer", email: "fairway-ux-new-golfer@example.com", firstName: "Nora", lastName: "NewGolfer", description: "Early lifecycle golfer with no established Fairway performance baselines." },
  "power-tour-member": { key: "power-tour-member", email: "fairway-ux-power-tour-member@example.com", firstName: "Maya", lastName: "PowerTour", description: "High-engagement golfer with richer demo performance history and higher-tier test entitlements." },
  "guest-host-member": { key: "guest-host-member", email: "fairway-ux-guest-host-member@example.com", firstName: "Gabe", lastName: "GuestHost", description: "Member used to exercise hosted guest and waiver readiness states." },
  "constrained-member": { key: "constrained-member", email: "fairway-ux-constrained-member@example.com", firstName: "Connie", lastName: "Constrained", description: "Member used for insufficient-credit and blocked-availability states." },
  "facilities-user": { key: "facilities-user", email: "fairway-ux-facilities-user@example.com", firstName: "Fran", lastName: "Facilities", description: "Restricted Facilities/Cleaning persona, separate from golfers." },
};

export const LOCATION_ONE_ID = "00000000-0000-0000-0000-000000000001";

export async function clerkApi(env: HarnessEnv, path: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(`https://api.clerk.com/v1${path}`, { ...init, headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`CLERK_${path}_FAILED ${response.status} ${JSON.stringify(body).slice(0, 500)}`);
  return body;
}

export async function ensureClerkPersonas(env: HarnessEnv): Promise<void> {
  try {
    for (const persona of Object.values(PERSONAS)) await ensureClerkUser(env, persona);
  } catch (error) {
    if (!String(error).includes("user_quota_exceeded")) throw error;
    await deleteHarnessOwnedClerkUsers(env);
    for (const persona of Object.values(PERSONAS)) await ensureClerkUser(env, persona);
  }
}

async function ensureClerkUser(env: HarnessEnv, persona: ExperiencePersona): Promise<void> {
  const existing = await clerkApi(env, `/users?limit=10&query=${encodeURIComponent(persona.email)}`);
  const users = Array.isArray(existing) ? existing : (existing.data ?? []);
  if (users.some((user: any) => user.email_addresses?.some((entry: any) => entry.email_address?.toLowerCase() === persona.email))) return;
  await clerkApi(env, "/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [persona.email],
      first_name: persona.firstName,
      last_name: persona.lastName,
      skip_password_requirement: true,
      public_metadata: { fairwayExperienceQa: true, persona: persona.key },
    }),
  });
}

async function deleteHarnessOwnedClerkUsers(env: HarnessEnv): Promise<void> {
  const result = await clerkApi(env, "/users?limit=100&query=fairway-ux-");
  const users = Array.isArray(result) ? result : (result.data ?? []);
  for (const user of users) {
    const emails = user.email_addresses?.map((entry: any) => entry.email_address?.toLowerCase()) ?? [];
    const isHarnessOwned = Boolean(user.public_metadata?.fairwayExperienceQa) || emails.some((email: string) => email.startsWith("fairway-ux-") && email.endsWith("@example.com"));
    if (isHarnessOwned) await clerkApi(env, `/users/${user.id}`, { method: "DELETE" });
  }
}

export async function connectDb(env: HarnessEnv): Promise<Client> {
  const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

export async function loginPersona(page: Page, persona: ExperiencePersona, path = "/"): Promise<void> {
  await safeGoto(page, path);
  await page.evaluate(async () => {
    const clerkInstance = (window as any).Clerk;
    if (clerkInstance?.user) await clerkInstance.signOut();
  }).catch(() => undefined);
  await clerk.signIn({ page, emailAddress: persona.email });
  await safeGoto(page, path);
}

async function safeGoto(page: Page, path: string): Promise<void> {
  try {
    await page.goto(path, { waitUntil: "domcontentloaded" });
  } catch (error) {
    if (!String(error).includes("NS_BINDING_ABORTED")) throw error;
    await page.goto(path, { waitUntil: "domcontentloaded" });
  }
}
export async function bootstrapPersona(page: Page, client: Client, persona: ExperiencePersona): Promise<{ memberProfileId: string; locationId: string }> {
  await loginPersona(page, persona, "/");
  await page.getByRole("heading", { name: "Practice Suite Availability" }).waitFor({ timeout: 45_000 });
  return memberProfileForEmail(client, persona.email);
}

export async function memberProfileForEmail(client: Client, email: string): Promise<{ memberProfileId: string; locationId: string }> {
  const result = await client.query("select mp.id, mp.home_location_id from member_profiles mp join people pe on pe.id = mp.person_id where pe.email = $1", [email]);
  if (result.rowCount !== 1) throw new Error(`expected one member profile for ${email}, got ${result.rowCount}`);
  return { memberProfileId: result.rows[0].id, locationId: result.rows[0].home_location_id };
}

export async function resetHarnessFacilityState(client: Client): Promise<void> {
  await client.query("delete from reservation_guests where host_member_profile_id in (select mp.id from member_profiles mp join people pe on pe.id = mp.person_id where pe.email like 'fairway-ux-%@example.com') or guest_id in (select id from guests where email like '%-ux@example.com')");
  await client.query("delete from agreement_acceptances where guest_id in (select id from guests where email like '%-ux@example.com')");
  await client.query("delete from guests where email like '%-ux@example.com'");
  await client.query("delete from facility_tasks where source_reservation_id in (select r.id from reservations r join member_profiles mp on mp.id = r.member_profile_id join people pe on pe.id = mp.person_id where pe.email like 'fairway-ux-%@example.com') or source_session_id in (select s.id from sessions s join member_profiles mp on mp.id = s.member_profile_id join people pe on pe.id = mp.person_id where pe.email like 'fairway-ux-%@example.com')");
  await client.query("delete from access_grants where reservation_id in (select r.id from reservations r join member_profiles mp on mp.id = r.member_profile_id join people pe on pe.id = mp.person_id where pe.email like 'fairway-ux-%@example.com')");
  await client.query("delete from sessions where reservation_id in (select r.id from reservations r join member_profiles mp on mp.id = r.member_profile_id join people pe on pe.id = mp.person_id where pe.email like 'fairway-ux-%@example.com')");
  await client.query("delete from reservations where member_profile_id in (select mp.id from member_profiles mp join people pe on pe.id = mp.person_id where pe.email like 'fairway-ux-%@example.com')");
  await client.query("update access_grants set status = 'expired', revoked_at = coalesce(revoked_at, now()) where member_profile_id in (select mp.id from member_profiles mp join people pe on pe.id = mp.person_id where pe.email like 'fairway-ux-%@example.com') and status = 'active'");
  await client.query("update sessions set ended_at = coalesce(ended_at, now()) where member_profile_id in (select mp.id from member_profiles mp join people pe on pe.id = mp.person_id where pe.email like 'fairway-ux-%@example.com') and ended_at is null");
  await client.query("update reservations set status = 'completed' where member_profile_id in (select mp.id from member_profiles mp join people pe on pe.id = mp.person_id where pe.email like 'fairway-ux-%@example.com') and status in ('held', 'confirmed', 'checked_in')");
  await client.query("update facility_tasks set status = 'completed', completed_at = coalesce(completed_at, now()) where source_session_id in (select s.id from sessions s join member_profiles mp on mp.id = s.member_profile_id join people pe on pe.id = mp.person_id where pe.email like 'fairway-ux-%@example.com') and status in ('open', 'claimed', 'in_progress')");
  await client.query("update suites set status = 'available' where location_id = $1", [LOCATION_ONE_ID]);
}

export async function grantFacilitiesRole(client: Client, memberProfileId: string, locationId: string): Promise<void> {
  await client.query("select fairway_grant_development_facilities($1, $2, $3)", [memberProfileId, locationId, "Experience QA harness facilities persona"]);
}

export async function setCreditTarget(client: Client, memberProfileId: string, targetCredits: number, reason: string): Promise<void> {
  const targetUnits = targetCredits * 2;
  if (!Number.isInteger(targetUnits)) throw new Error(`Experience QA credit target must align to half-credit units: ${targetCredits}`);
  const current = await client.query("select fairway_available_credit_units($1)::int as units", [memberProfileId]);
  const deltaUnits = targetUnits - Number(current.rows[0].units);
  if (deltaUnits === 0) return;
  await client.query(
    "insert into credit_ledger_entries (member_profile_id, entry_type, amount, balance_delta, idempotency_key, reason, actor_id) values ($1, 'adjustment', $2, $3, $4, $5, 'experience-qa')",
    [memberProfileId, Math.abs(deltaUnits), deltaUnits, `experience-qa:${memberProfileId}:credit-target:${targetCredits}:${Date.now()}`, reason],
  );
}

export async function ensureTourPlanForProfile(client: Client, memberProfileId: string): Promise<void> {
  await client.query(`
    insert into membership_plans (id, code, name, monthly_credits, booking_window_days, max_active_future_reservations, play_now_enabled, guest_allowance)
    values ('00000000-0000-0000-0000-000000000104', 'TEST_TOUR', 'Test Tour', 96, 14, 4, true, 3)
    on conflict (code) do update set monthly_credits = excluded.monthly_credits, booking_window_days = excluded.booking_window_days, max_active_future_reservations = excluded.max_active_future_reservations, play_now_enabled = excluded.play_now_enabled, guest_allowance = excluded.guest_allowance
  `);
  await client.query("update memberships set membership_plan_id = (select id from membership_plans where code = 'TEST_TOUR') where member_profile_id = $1 and status = 'active' and ended_at is null", [memberProfileId]);
}

export async function setAllSuitesStatus(client: Client, status: string): Promise<void> {
  await client.query("update suites set status = $1 where location_id = $2", [status, LOCATION_ONE_ID]);
}

export function cleanExperienceArtifacts(): void {
  rmSync("artifacts/ux-review", { recursive: true, force: true });
  mkdirSync("artifacts/ux-review/screenshots", { recursive: true });
  mkdirSync("artifacts/ux-review/evidence", { recursive: true });
  writeFileSync("artifacts/ux-review/evidence/personas.json", JSON.stringify(Object.values(PERSONAS), null, 2));
}
