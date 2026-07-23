import { test, expect } from "@playwright/test";
import { assertDevelopmentEnv, loadHarnessEnv } from "./support/env";
import { bootstrapPersona, connectDb, ensureTourPlanForProfile, PERSONAS, resetHarnessFacilityState, setAllSuitesStatus, setCreditTarget } from "./support/personas";
import { captureScreen, expectMobilePlayStructure, expectResponsiveBasics, flushQualityCapture, runA11y, startQualityCapture } from "./support/evidence";

const env = loadHarnessEnv();
assertDevelopmentEnv(env);

test.describe("VS1G.4 persona state gallery", () => {
  test("captures member experience states across coherent personae", async ({ browser }, testInfo) => {
    let context = await browser.newContext();
    let page = await context.newPage();
    const quality = startQualityCapture(page);
    const client = await connectDb(env);
    try {
      await resetHarnessFacilityState(client);

      const newGolfer = PERSONAS["new-golfer"];
      const newProfile = await bootstrapPersona(page, client, newGolfer);
      await setCreditTarget(client, newProfile.memberProfileId, 24, "Experience QA target for new-golfer");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "My Golf", exact: true }).click();
      await expect(page.getByText("No Fairway baseline yet")).toBeVisible();
      await expect(page.getByText("No Fairway activity yet")).toBeVisible();
      await expectResponsiveBasics(page, "new golfer My Golf");
      await runA11y(page, testInfo, "New Golfer My Golf", newGolfer.key);
      await captureScreen(page, testInfo, {
        order: 11,
        screen: "new-golfer-my-golf-empty",
        route: "/",
        persona: newGolfer.key,
        state: "no-baseline-no-activity",
        prdRequirementIds: ["FR-CMP-010", "FR-UX-012", "NFR-011"],
        principles: ["progressive-disclosure", "data-with-meaning", "empty-state-quality"],
        capability: "My Golf remains useful and honest when no Fairway baselines exist yet.",
      });

      await context.close();
      context = await browser.newContext();
      page = await context.newPage();
      startQualityCapture(page);

      const power = PERSONAS["power-tour-member"];
      const powerProfile = await bootstrapPersona(page, client, power);
      await ensureTourPlanForProfile(client, powerProfile.memberProfileId);
      await setCreditTarget(client, powerProfile.memberProfileId, 240, "Experience QA target for power-tour-member");
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText("240 credits")).toBeVisible();
      await page.getByRole("button", { name: "My Golf", exact: true }).click();
      await expect(page.getByText("281 yd")).toBeVisible();
      await expect(page.getByText("118 swings", { exact: true })).toBeVisible();
      await expectResponsiveBasics(page, "power tour My Golf");
      await captureScreen(page, testInfo, {
        order: 12,
        screen: "power-tour-my-golf-rich",
        route: "/",
        persona: power.key,
        state: "rich-baselines-high-engagement",
        prdRequirementIds: ["FR-CMP-010", "FR-CMP-012", "FR-UX-012"],
        principles: ["data-with-meaning", "calm-confidence"],
        capability: "Dense performance history remains scannable without becoming a generic metrics dashboard.",
      });

      await context.close();
      context = await browser.newContext();
      page = await context.newPage();
      startQualityCapture(page);

      const guestHost = PERSONAS["guest-host-member"];
      await bootstrapPersona(page, client, guestHost);
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await page.getByRole("button", { name: "Confirm Play Now" }).first().click();
      await page.getByText(/is ready|You are ready/i).first().waitFor({ timeout: 45_000 });
      await expectMobilePlayStructure(page, "guest add empty state");
      await captureScreen(page, testInfo, {
        order: 13,
        screen: "guest-add-empty",
        route: "/",
        persona: guestHost.key,
        state: "no-guest-add-available",
        prdRequirementIds: ["FR-GST-001", "FR-GST-006", "FR-UX-013"],
        principles: ["human-state-language", "clear-system-status"],
        capability: "Guest workflow begins with a usable add state scoped to the selected reservation.",
      });
      await page.getByLabel("Guest name").fill("Casey Guest");
      await page.getByLabel("Guest email optional").fill("casey-ux@example.com");
      await page.getByRole("button", { name: /Add guest/i }).click();
      await page.getByText(/Send their waiver/i).waitFor({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: /Send waiver/i }).first()).toBeVisible();
      await expectMobilePlayStructure(page, "guest waiver not requested");
      await captureScreen(page, testInfo, {
        order: 14,
        screen: "guest-waiver-not-requested",
        route: "/",
        persona: guestHost.key,
        state: "guest-added-waiver-not-requested",
        prdRequirementIds: ["FR-GST-001", "FR-GST-006", "FR-UX-013"],
        principles: ["human-state-language", "clear-system-status"],
        capability: "Guest workflow distinguishes added, waiver required, and readiness status.",
      });
      await page.getByRole("button", { name: /Send waiver/i }).first().click();
      await page.getByText(/Waiver sent/i).waitFor({ timeout: 30_000 });
      await expect(page.getByText(/Waiting for waiver completion/i)).toBeVisible();
      await expectMobilePlayStructure(page, "guest waiver pending");
      await captureScreen(page, testInfo, {
        order: 15,
        screen: "guest-waiver-pending",
        route: "/",
        persona: guestHost.key,
        state: "guest-waiver-pending",
        prdRequirementIds: ["FR-GST-006", "FR-ACC-005"],
        principles: ["human-state-language", "clear-system-status"],
        capability: "Pending guest waiver state is visible without fake adapter controls.",
      });
      const guestRecord = await latestGuestAssociation(client, guestHost.email, "Casey Guest");
      await page.evaluate(async ({ reservationId, reservationGuestId }) => {
        const response = await fetch(`/api/member/reservations/${reservationId}/guests/${reservationGuestId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "complete_waiver", idempotencyKey: `ux-complete-waiver-${reservationGuestId}` }) });
        if (!response.ok) throw new Error(`complete waiver failed ${response.status}`);
      }, guestRecord);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(page.locator(".guest-tile").getByText(/Ready when access opens|Ready now/i).first()).toBeVisible();
      await expectMobilePlayStructure(page, "guest ready");
      await captureScreen(page, testInfo, {
        order: 16,
        screen: "guest-ready",
        route: "/",
        persona: guestHost.key,
        state: "guest-waiver-completed-ready-when-access-opens",
        prdRequirementIds: ["FR-GST-006", "FR-ACC-005"],
        principles: ["human-state-language", "clear-system-status"],
        capability: "Guest readiness is visible after versioned waiver completion.",
      });
      await expect(page.getByText("1/1 guest added. Remove a guest before adding another.")).toBeVisible();
      await captureScreen(page, testInfo, {
        order: 16,
        screen: "guest-limit-reached",
        route: "/",
        persona: guestHost.key,
        state: "guest-allowance-consumed",
        prdRequirementIds: ["FR-GST-004", "FR-GST-006"],
        principles: ["clear-system-status", "recovery-without-raw-errors"],
        capability: "Guest allowance limit is explained without raw backend states.",
      });

      await context.close();
      context = await browser.newContext();
      page = await context.newPage();
      startQualityCapture(page);

      const constrained = PERSONAS["constrained-member"];
      const constrainedProfile = await bootstrapPersona(page, client, constrained);
      await resetHarnessFacilityState(client);
      await setAllSuitesStatus(client, "available");
      await setCreditTarget(client, constrainedProfile.memberProfileId, 0, "Experience QA constrained insufficient-credit state");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(page.getByText("0 credits")).toBeVisible();
      await expect(page.getByText(/This session needs .* credits\. You have 0\./)).toBeVisible();
      await expect(page.getByRole("button", { name: "Confirm Play Now" }).first()).toBeDisabled();
      await expectMobilePlayStructure(page, "insufficient credits play");
      await runA11y(page, testInfo, "Insufficient Credits Play", constrained.key);
      await captureScreen(page, testInfo, {
        order: 18,
        screen: "insufficient-credits-play-blocked",
        route: "/",
        persona: constrained.key,
        state: "insufficient-credits-with-inventory",
        prdRequirementIds: ["FR-RES-003", "FR-CRD-003", "FR-UX-013"],
        principles: ["clear-system-status", "recovery-without-raw-errors"],
        capability: "Blocked Play Now state communicates required credits and current credits while inventory is available.",
      });

      await setCreditTarget(client, constrainedProfile.memberProfileId, 24, "Experience QA constrained no-availability state");
      await setAllSuitesStatus(client, "administrative_hold");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(page.getByText("24 credits")).toBeVisible();
      await expect(page.getByText("No suite ready right now")).toBeVisible();
      await expect(page.getByRole("button", { name: "Confirm Play Now" }).first()).toBeDisabled();
      await expectMobilePlayStructure(page, "no immediate availability play");
      await runA11y(page, testInfo, "No Immediate Availability Play", constrained.key);
      await captureScreen(page, testInfo, {
        order: 19,
        screen: "no-immediate-availability-play-blocked",
        route: "/",
        persona: constrained.key,
        state: "no-immediate-availability-with-credits",
        prdRequirementIds: ["FR-RES-003", "FR-UX-013"],
        principles: ["clear-system-status", "recovery-without-raw-errors"],
        capability: "Blocked Play Now state communicates inventory is unavailable without making credits the problem.",
      });
      await flushQualityCapture(`${testInfo.project.name}-persona-gallery`, quality);
      await context.close();
    } finally {
      await setAllSuitesStatus(client, "available").catch(() => undefined);
      await client.end().catch(() => undefined);
    }
  });
});

async function latestGuestAssociation(client: Awaited<ReturnType<typeof connectDb>>, hostEmail: string, guestName: string): Promise<{ reservationId: string; reservationGuestId: string }> {
  const result = await client.query(`
    select rg.id as reservation_guest_id, rg.reservation_id
    from reservation_guests rg
    join member_profiles mp on mp.id = rg.host_member_profile_id
    join people pe on pe.id = mp.person_id
    join guests g on g.id = rg.guest_id
    where pe.email = $1 and g.full_name = $2
    order by rg.created_at desc
    limit 1
  `, [hostEmail, guestName]);
  if (result.rowCount !== 1) throw new Error(`expected one guest association for ${hostEmail} / ${guestName}`);
  return { reservationId: result.rows[0].reservation_id, reservationGuestId: result.rows[0].reservation_guest_id };
}