import { test, expect } from "@playwright/test";
import { assertDevelopmentEnv, loadHarnessEnv } from "./support/env";
import { bootstrapPersona, connectDb, ensureTourPlanForProfile, PERSONAS, resetHarnessFacilityState, setAllSuitesStatus, setCreditTarget } from "./support/personas";
import { captureScreen, expectResponsiveBasics, flushQualityCapture, runA11y, startQualityCapture } from "./support/evidence";

const env = loadHarnessEnv();
assertDevelopmentEnv(env);

test.describe("VS1G.2 persona state gallery", () => {
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
      await page.getByRole("button", { name: /Book/i }).first().click();
      await page.getByText(/next safe slot is booked/i).waitFor({ timeout: 45_000 });
      await page.getByLabel("Guest name").fill("Casey Guest");
      await page.getByLabel("Guest email optional").fill("casey-ux@example.com");
      await page.getByRole("button", { name: /Add guest/i }).click();
      await page.getByText(/waiver needs/i).waitFor({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: /Request waiver/i }).first()).toBeVisible();
      await captureScreen(page, testInfo, {
        order: 13,
        screen: "guest-waiver-pending",
        route: "/",
        persona: guestHost.key,
        state: "guest-added-waiver-pending",
        prdRequirementIds: ["FR-GST-001", "FR-GST-006", "FR-UX-013"],
        principles: ["human-state-language", "clear-system-status"],
        capability: "Guest workflow distinguishes added, waiver pending, and readiness status.",
      });
      await page.getByRole("button", { name: /Request waiver/i }).first().click();
      await page.getByText(/Waiver request recorded/i).waitFor({ timeout: 30_000 });
      await page.getByRole("button", { name: /Mark complete/i }).first().click();
      await page.getByText(/Waiver complete/i).waitFor({ timeout: 30_000 });
      await captureScreen(page, testInfo, {
        order: 14,
        screen: "guest-ready",
        route: "/",
        persona: guestHost.key,
        state: "guest-waiver-completed-ready-when-access-opens",
        prdRequirementIds: ["FR-GST-006", "FR-ACC-005"],
        principles: ["human-state-language", "clear-system-status"],
        capability: "Guest readiness is visible after versioned waiver completion.",
      });
      await page.getByLabel("Guest name").fill("Second Guest");
      await page.getByRole("button", { name: /Add guest/i }).click({ trial: true }).catch(() => undefined);
      await expect(page.getByText("Guest limit reached for this membership.")).toBeVisible();
      await captureScreen(page, testInfo, {
        order: 15,
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
      await setCreditTarget(client, constrainedProfile.memberProfileId, 0, "Experience QA constrained no-credit state");
      await setAllSuitesStatus(client, "administrative_hold");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(page.getByText("0 credits")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Reserve the next safe slot" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Play Now" }).first()).toBeDisabled();
      await runA11y(page, testInfo, "Constrained Play", constrained.key);
      await captureScreen(page, testInfo, {
        order: 16,
        screen: "constrained-play-blocked",
        route: "/",
        persona: constrained.key,
        state: "insufficient-credits-and-no-immediate-availability",
        prdRequirementIds: ["FR-RES-003", "FR-CRD-003", "FR-UX-013"],
        principles: ["clear-system-status", "recovery-without-raw-errors"],
        capability: "Blocked Play Now state communicates no ready suite and zero credits without exposing raw errors.",
      });
      await flushQualityCapture(`${testInfo.project.name}-persona-gallery`, quality);
      await context.close();
    } finally {
      await setAllSuitesStatus(client, "available").catch(() => undefined);
      await client.end().catch(() => undefined);
    }
  });
});
