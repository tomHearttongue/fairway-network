import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Client } from "pg";
import { buildDemoUniverse, deriveDemoGolfProfile, FAIRWAY_DEMO_CLOCK_ISO } from "@/demo-universe/universe";
import { assertDevelopmentEnv, loadHarnessEnv } from "../experience/support/env";
import { connectDb, ensureClerkPersonas, loginPersona, memberProfileForEmail, PERSONAS, setCreditTarget } from "../experience/support/personas";
import {
  captureDu1Screen,
  flushQuality,
  resetEvidenceFiles,
  runDu1A11y,
  startQualityCapture,
  type StructuredAssertion,
  writeReconciliation,
} from "./support/du1-evidence";

const env = loadHarnessEnv();
assertDevelopmentEnv(env);
const artifactRoot = path.join(process.cwd(), "artifacts", "du1-remediation-r2-review");

test.beforeAll(async () => {
  if (test.info().project.name === "mobile-primary") resetEvidenceFiles();
  await ensureClerkPersonas(env);
});

test("proves the persisted DU1 Golden Demo and review states", async ({ browser }, testInfo) => {
  if (testInfo.project.name === "mobile-primary") {
    await runMobileGoldenDemo(browser, testInfo);
    await runMobileStateGallery(browser, testInfo);
    return;
  }
  await runLargeViewportGoldenDemo(browser, testInfo);
});

async function runMobileGoldenDemo(browser: Browser, testInfo: TestInfo) {
  const receipt = resetScenario("normal");
  const flowExecutionId = `golden-mobile-${randomUUID()}`;
  const client = await connectDb(env);
  const context = await browser.newContext({ viewport: viewportFor(testInfo.project.name) });
  const page = await context.newPage();
  try {
    await loginPersona(page, PERSONAS["demo-active-birdie"], "/");
    await expect(page.getByRole("heading", { name: /Ready to play, Tom/i })).toBeVisible();
    const tomProfile = await memberProfileForEmail(client, PERSONAS["demo-active-birdie"].email);
    const future = await futureReservation(client, tomProfile.memberProfileId);
    expect(future.start_at.toISOString()).toBe("2026-07-23T21:30:00.000Z");
    expect(future.access_starts_at.toISOString()).toBe("2026-07-23T21:15:00.000Z");

    const mutationBefore = await sessionMutationCounts(client, future.id);
    const earlyResponse = await page.evaluate(async (reservationId) => {
      const response = await fetch("/api/member/session/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reservationId, idempotencyKey: `du1-r2-early-${reservationId}` }),
      });
      return { status: response.status, body: await response.json() };
    }, future.id);
    expect(earlyResponse.status).toBe(409);
    expect(String(earlyResponse.body.error)).toContain("SESSION_ACCESS_WINDOW_NOT_OPEN");
    expect(await sessionMutationCounts(client, future.id)).toEqual(mutationBefore);
    await expect(page.getByText(/access opens at 4:15 PM/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Start Session/i })).toHaveCount(0);

    const quality = startQualityCapture(page, `${flowExecutionId}:member`);
    await captureMemberState(page, client, testInfo, receipt, {
      order: 1,
      step: 1,
      screen: "Member Home",
      state: "future-reservation-protected-play-now-ready",
      flowExecutionId,
      personaKey: "demo-active-birdie",
      qualityId: quality.id,
      assertions: async (snapshot) => [
        await containsText(page.getByRole("heading", { name: /Ready to play/i }), "member.displayName", snapshot.member.displayName),
        await containsText(page.getByText(/access opens at/i).first(), "futureReservation.accessOpensLabel", snapshot.futureReservation!.accessOpensLabel),
        await countAssertion(page.getByRole("button", { name: /Start Session/i }), "futureReservation.startableNow", 0),
      ],
    });

    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByText("Suite details")).toBeVisible();
    await captureMemberState(page, client, testInfo, receipt, {
      order: 2,
      step: 2,
      screen: "Play Now Quote",
      state: "server-priced-duration-options",
      flowExecutionId,
      personaKey: "demo-active-birdie",
      qualityId: quality.id,
      assertions: async (snapshot) => [
        await containsText(page.getByRole("heading", { name: "Play", exact: true }), "screen.title", "Play"),
        await containsText(page.getByRole("button", { name: /60 min/i }), "playNowQuote.sixtyMinuteCostLabel", snapshot.playNowQuote.sixtyMinuteCostLabel),
        await countAssertion(page.getByRole("button", { name: /Start session/i }), "futureReservation.startableNow", 0),
      ],
    });

    await page.getByRole("button", { name: /60 min/i }).click();
    await page.getByRole("button", { name: "Confirm Play Now" }).click();
    await expect(page.getByText("You are ready")).toBeVisible({ timeout: 45_000 });
    await captureMemberState(page, client, testInfo, receipt, {
      order: 3,
      step: 3,
      screen: "Play Now Confirmation",
      state: "confirmed-assigned-suite-access-open",
      flowExecutionId,
      personaKey: "demo-active-birdie",
      qualityId: quality.id,
      assertions: async (snapshot) => [
        await containsText(page.locator(".ready-card h2"), "currentReservation.suiteName", snapshot.currentReservation!.suiteName),
        await containsText(page.locator(".ready-card"), "currentReservation.accessLabel", snapshot.currentReservation!.accessLabel),
        await countAssertion(page.getByRole("button", { name: /Start Session/i }), "currentReservation.startableNow", 1),
      ],
    });

    await page.getByRole("button", { name: /Start Session/i }).click();
    await expect(page.locator(".ready-card").getByText("Session active")).toBeVisible({ timeout: 45_000 });
    await captureMemberState(page, client, testInfo, receipt, {
      order: 4,
      step: 4,
      screen: "Active Session",
      state: "checked-in-access-open-finish-ready",
      flowExecutionId,
      personaKey: "demo-active-birdie",
      qualityId: quality.id,
      assertions: async (snapshot) => [
        await containsText(page.locator(".ready-card"), "currentReservation.statusLabel", snapshot.currentReservation!.statusLabel),
        await containsText(page.locator(".ready-card h2"), "currentReservation.suiteName", snapshot.currentReservation!.suiteName),
        await countAssertion(page.getByRole("button", { name: /Finish Session/i }), "currentReservation.canFinish", 1),
      ],
    });

    await page.getByRole("button", { name: "My Golf", exact: true }).click();
    await expect(page.getByText("Golfer Passport")).toBeVisible();
    await captureMemberState(page, client, testInfo, receipt, {
      order: 5,
      step: 5,
      screen: "My Golf",
      state: "canonical-golf-profile-and-baselines",
      flowExecutionId,
      personaKey: "demo-active-birdie",
      qualityId: quality.id,
      assertions: async (snapshot) => [
        await containsText(page.locator(".passport-hero"), "golfProfile.handicapLabel", snapshot.golfProfile.handicapLabel),
        await containsText(page.locator(".club-metric").filter({ hasText: "Driver" }), "golfProfile.driverCarryLabel", snapshot.golfProfile.driverCarryLabel),
        await containsText(page.locator(".club-metric").filter({ hasText: "Driver" }), "golfProfile.driverSampleLabel", snapshot.golfProfile.driverSampleLabel),
      ],
    });

    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("button", { name: /Finish Session/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /Nice work, Tom/i })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("Session active")).toHaveCount(0);
    await expect(page.getByText("Access open")).toHaveCount(0);
    await captureMemberState(page, client, testInfo, receipt, {
      order: 6,
      step: 6,
      screen: "Session Completion",
      state: "member-centered-completion-summary",
      flowExecutionId,
      personaKey: "demo-active-birdie",
      qualityId: quality.id,
      assertions: async (snapshot) => [
        await containsText(page.getByRole("status"), "member.firstName", snapshot.member.firstName),
        await containsText(page.getByRole("status"), "completedLifecycle.suiteName", snapshot.completedLifecycle!.suiteName),
        await countAssertion(page.getByText("Session active"), "completedLifecycle.activeSessionVisible", 0),
      ],
    });

    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("heading", { name: /Ready to play, Tom/i })).toBeVisible();
    await captureMemberState(page, client, testInfo, receipt, {
      order: 7,
      step: 7,
      screen: "Completed Lifecycle",
      state: "reservation-session-access-complete-turnover-open",
      flowExecutionId,
      personaKey: "demo-active-birdie",
      qualityId: quality.id,
      assertions: async (snapshot) => [
        assertion("completedLifecycle.reservationStatus", snapshot.completedLifecycle!.reservationStatus, "completed"),
        assertion("completedLifecycle.accessStatus", snapshot.completedLifecycle!.accessStatus, "expired"),
        assertion("completedLifecycle.turnoverTaskStatus", snapshot.completedLifecycle!.turnoverTaskStatus, "open"),
      ],
    });
    flushQuality(`${testInfo.project.name}-${flowExecutionId}-member`, quality);
    await context.close();

    const facilitiesContext = await browser.newContext({ viewport: viewportFor(testInfo.project.name) });
    const facilitiesPage = await facilitiesContext.newPage();
    const facilitiesQuality = startQualityCapture(facilitiesPage, `${flowExecutionId}:facilities`);
    await loginPersona(facilitiesPage, PERSONAS["facilities-user"], "/facilities");
    await expect(facilitiesPage.getByRole("heading", { name: "What should I service now?" })).toBeVisible({ timeout: 45_000 });
    await captureFacilitiesState(facilitiesPage, client, testInfo, receipt, {
      order: 8,
      step: 8,
      screen: "Facilities Queue",
      state: "same-suite-turnover-task-open",
      flowExecutionId,
      qualityId: facilitiesQuality.id,
      assertions: async (snapshot) => [
        await containsText(facilitiesPage.getByLabel("Next service task"), "topTask.suiteName", snapshot.topTask!.suiteName),
        await containsText(facilitiesPage.getByLabel("Next service task"), "topTask.statusLabel", snapshot.topTask!.statusLabel),
        assertion("topTask.sourceReservationId", snapshot.topTask!.sourceReservationId, snapshot.completedLifecycle!.reservationId),
      ],
    });

    const nextTask = facilitiesPage.getByLabel("Next service task");
    await nextTask.getByRole("button", { name: /Claim/i }).click();
    await expect(nextTask.getByRole("button", { name: /Start service/i })).toBeVisible({ timeout: 30_000 });
    await nextTask.getByRole("button", { name: /Start service/i }).click();
    await expect(nextTask.getByRole("button", { name: /Mark ready/i })).toBeVisible({ timeout: 30_000 });
    await captureFacilitiesState(facilitiesPage, client, testInfo, receipt, {
      order: 9,
      step: 9,
      screen: "Facilities Service",
      state: "same-task-claimed-and-in-progress",
      flowExecutionId,
      qualityId: facilitiesQuality.id,
      assertions: async (snapshot) => [
        await containsText(nextTask, "topTask.suiteName", snapshot.topTask!.suiteName),
        await containsText(nextTask, "topTask.statusLabel", snapshot.topTask!.statusLabel),
        await countAssertion(nextTask.getByRole("button", { name: /Mark ready/i }), "topTask.canComplete", 1),
      ],
    });

    await nextTask.getByRole("button", { name: /Mark ready/i }).click();
    await expect(facilitiesPage.getByText(/marked ready/i)).toBeVisible({ timeout: 30_000 });
    await captureFacilitiesState(facilitiesPage, client, testInfo, receipt, {
      order: 10,
      step: 10,
      screen: "Suite Ready",
      state: "turnover-complete-safe-inventory-restored",
      flowExecutionId,
      qualityId: facilitiesQuality.id,
      assertions: async (snapshot) => [
        assertion("completedLifecycle.turnoverTaskStatus", snapshot.completedLifecycle!.turnoverTaskStatus, "completed"),
        assertion("completedLifecycle.suiteOperationalStatus", snapshot.completedLifecycle!.suiteOperationalStatus, "available"),
        assertion("completedLifecycle.safeToAssignNow", snapshot.completedLifecycle!.safeToAssignNow, true),
      ],
    });
    flushQuality(`${testInfo.project.name}-${flowExecutionId}-facilities`, facilitiesQuality);
    await facilitiesContext.close();
  } finally {
    await client.end().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}

async function runLargeViewportGoldenDemo(browser: Browser, testInfo: TestInfo) {
  const receipt = resetScenario("normal");
  const flowExecutionId = `golden-${testInfo.project.name}-${randomUUID()}`;
  const client = await connectDb(env);
  const memberContext = await browser.newContext({ viewport: viewportFor(testInfo.project.name) });
  const page = await memberContext.newPage();
  const quality = startQualityCapture(page, `${flowExecutionId}:member`);
  try {
    await loginPersona(page, PERSONAS["demo-active-birdie"], "/");
    await expect(page.getByRole("heading", { name: /Ready to play, Tom/i })).toBeVisible();
    await captureMemberState(page, client, testInfo, receipt, {
      order: 1, step: null, screen: "Member Home", state: "large-viewport-home", flowExecutionId, personaKey: "demo-active-birdie", qualityId: quality.id,
      assertions: async (snapshot) => [
        await containsText(page.getByRole("heading", { name: /Ready to play/i }), "member.displayName", snapshot.member.displayName),
        await containsText(page.getByText(/credits/).first(), "member.availableCredits", snapshot.member.availableCredits),
      ],
    });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("button", { name: /60 min/i }).click();
    await page.getByRole("button", { name: "Confirm Play Now" }).click();
    await expect(page.getByText("You are ready")).toBeVisible({ timeout: 45_000 });
    await captureMemberState(page, client, testInfo, receipt, {
      order: 2, step: null, screen: "Play Now Confirmation", state: "large-viewport-confirmation", flowExecutionId, personaKey: "demo-active-birdie", qualityId: quality.id,
      assertions: async (snapshot) => [
        await containsText(page.locator(".ready-card h2"), "currentReservation.suiteName", snapshot.currentReservation!.suiteName),
        await countAssertion(page.getByRole("button", { name: /Start Session/i }), "currentReservation.startableNow", 1),
      ],
    });
    await page.getByRole("button", { name: /Start Session/i }).click();
    await expect(page.locator(".ready-card").getByText("Session active")).toBeVisible({ timeout: 45_000 });
    await captureMemberState(page, client, testInfo, receipt, {
      order: 3, step: null, screen: "Active Session", state: "large-viewport-active-session", flowExecutionId, personaKey: "demo-active-birdie", qualityId: quality.id,
      assertions: async (snapshot) => [
        await containsText(page.locator(".ready-card"), "currentReservation.statusLabel", snapshot.currentReservation!.statusLabel),
        await countAssertion(page.getByRole("button", { name: /Finish Session/i }), "currentReservation.canFinish", 1),
      ],
    });
    await page.getByRole("button", { name: "My Golf", exact: true }).click();
    await expect(page.getByText("Golfer Passport")).toBeVisible();
    await captureMemberState(page, client, testInfo, receipt, {
      order: 4, step: null, screen: "My Golf", state: "large-viewport-my-golf", flowExecutionId, personaKey: "demo-active-birdie", qualityId: quality.id,
      assertions: async (snapshot) => [
        await containsText(page.locator(".club-metric").filter({ hasText: "Driver" }), "golfProfile.driverCarryLabel", snapshot.golfProfile.driverCarryLabel),
        await containsText(page.locator(".club-metric").filter({ hasText: "Driver" }), "golfProfile.driverSampleLabel", snapshot.golfProfile.driverSampleLabel),
      ],
    });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("button", { name: /Finish Session/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /Nice work, Tom/i })).toBeVisible({ timeout: 45_000 });
    flushQuality(`${testInfo.project.name}-${flowExecutionId}-member`, quality);
    await memberContext.close();

    const facilitiesContext = await browser.newContext({ viewport: viewportFor(testInfo.project.name) });
    const facilitiesPage = await facilitiesContext.newPage();
    const facilitiesQuality = startQualityCapture(facilitiesPage, `${flowExecutionId}:facilities`);
    await loginPersona(facilitiesPage, PERSONAS["facilities-user"], "/facilities");
    await expect(facilitiesPage.getByRole("heading", { name: "What should I service now?" })).toBeVisible({ timeout: 45_000 });
    await captureFacilitiesState(facilitiesPage, client, testInfo, receipt, {
      order: 5, step: null, screen: "Facilities Queue", state: "large-viewport-turnover-open", flowExecutionId, qualityId: facilitiesQuality.id,
      assertions: async (snapshot) => [
        await containsText(facilitiesPage.getByLabel("Next service task"), "topTask.suiteName", snapshot.topTask!.suiteName),
        await containsText(facilitiesPage.getByLabel("Next service task"), "topTask.statusLabel", snapshot.topTask!.statusLabel),
      ],
    });
    const task = facilitiesPage.getByLabel("Next service task");
    await task.getByRole("button", { name: /Claim/i }).click();
    await task.getByRole("button", { name: /Start service/i }).click();
    await task.getByRole("button", { name: /Mark ready/i }).click();
    await expect(facilitiesPage.getByText(/marked ready/i)).toBeVisible({ timeout: 30_000 });
    await captureFacilitiesState(facilitiesPage, client, testInfo, receipt, {
      order: 6, step: null, screen: "Suite Ready", state: "large-viewport-suite-ready", flowExecutionId, qualityId: facilitiesQuality.id,
      assertions: async (snapshot) => [
        assertion("completedLifecycle.turnoverTaskStatus", snapshot.completedLifecycle!.turnoverTaskStatus, "completed"),
        assertion("completedLifecycle.suiteOperationalStatus", snapshot.completedLifecycle!.suiteOperationalStatus, "available"),
      ],
    });
    flushQuality(`${testInfo.project.name}-${flowExecutionId}-facilities`, facilitiesQuality);
    await facilitiesContext.close();
  } finally {
    await client.end().catch(() => undefined);
    await memberContext.close().catch(() => undefined);
  }
}

async function runMobileStateGallery(browser: Browser, testInfo: TestInfo) {
  await captureSimpleMemberScenario(browser, testInfo, "new-member", "new-golfer", 11, "New Member My Golf", "no-mature-history", async (page, snapshot) => {
    await page.getByRole("button", { name: "My Golf", exact: true }).click();
    await expect(page.getByText("No Fairway baseline yet")).toBeVisible();
    return [
      await containsText(page.locator(".empty-state").filter({ hasText: "No Fairway baseline yet" }), "golfProfile.performanceCount", "No Fairway baseline yet"),
      assertion("golfProfile.completedActivityCount", snapshot.golfProfile.completedActivityCount, 0),
    ];
  });
  await captureSimpleMemberScenario(browser, testInfo, "busy-prime", "demo-active-birdie", 12, "Busy Prime", "coherent-high-demand", async (page, snapshot) => {
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await revealSuiteDetails(page);
    return [
      await containsText(page.getByText(/ready now/).first(), "inventory.safeToAssignNowCount", snapshot.inventory.safeToAssignNowCount),
      assertion("inventory.activeSessionCount", snapshot.inventory.activeSessionCount, 6),
    ];
  });
  await captureSimpleMemberScenario(browser, testInfo, "low-inventory", "demo-active-birdie", 13, "Low Inventory", "inventory-not-credit-constrained", async (page, snapshot) => {
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await revealSuiteDetails(page);
    return [
      assertion("inventory.safeToAssignNowCount", snapshot.inventory.safeToAssignNowCount, 2),
      assertion("member.availableCreditsSufficient", snapshot.member.availableCredits >= 4, true),
    ];
  });
  await captureSimpleFacilitiesScenario(browser, testInfo, "facility-incident", 14, "Facility Incident", "inspection-and-turnover-affect-availability");
  await captureGuestStates(browser, testInfo);
  await captureInsufficientCredits(browser, testInfo);
}

async function captureSimpleMemberScenario(
  browser: Browser,
  testInfo: TestInfo,
  scenario: "normal" | "busy-prime" | "new-member" | "low-inventory",
  personaKey: "demo-active-birdie" | "new-golfer",
  order: number,
  screen: string,
  state: string,
  prepare: (page: Page, snapshot: Awaited<ReturnType<typeof memberSnapshot>>) => Promise<StructuredAssertion[]>,
) {
  const receipt = resetScenario(scenario);
  const flowExecutionId = `${scenario}-${randomUUID()}`;
  const client = await connectDb(env);
  const context = await browser.newContext({ viewport: viewportFor(testInfo.project.name) });
  const page = await context.newPage();
  const quality = startQualityCapture(page, `${flowExecutionId}:member`);
  try {
    await loginPersona(page, PERSONAS[personaKey], "/");
    await expect(page.getByRole("heading", { name: /Ready to play/i })).toBeVisible();
    const before = await memberSnapshot(client, PERSONAS[personaKey].email, scenario);
    const assertions = await prepare(page, before);
    await captureMemberState(page, client, testInfo, receipt, { order, step: null, screen, state, flowExecutionId, personaKey, qualityId: quality.id, assertions: async () => assertions });
    flushQuality(`${testInfo.project.name}-${flowExecutionId}`, quality);
  } finally {
    await context.close();
    await client.end();
  }
}

async function captureSimpleFacilitiesScenario(browser: Browser, testInfo: TestInfo, scenario: "facility-incident", order: number, screen: string, state: string) {
  const receipt = resetScenario(scenario);
  const flowExecutionId = `${scenario}-${randomUUID()}`;
  const client = await connectDb(env);
  const context = await browser.newContext({ viewport: viewportFor(testInfo.project.name) });
  const page = await context.newPage();
  const quality = startQualityCapture(page, `${flowExecutionId}:facilities`);
  try {
    await loginPersona(page, PERSONAS["facilities-user"], "/facilities");
    await expect(page.getByRole("heading", { name: "What should I service now?" })).toBeVisible();
    await captureFacilitiesState(page, client, testInfo, receipt, {
      order, step: null, screen, state, flowExecutionId, qualityId: quality.id,
      assertions: async (snapshot) => [
        assertion("inventory.inspectionRequiredCount", snapshot.inventory.inspectionRequiredCount, 1),
        assertion("inventory.safeToAssignNowCount", snapshot.inventory.safeToAssignNowCount, 9),
        await containsText(page.getByLabel("Next service task"), "topTask.taskTypeLabel", snapshot.topTask!.taskTypeLabel),
      ],
    });
    flushQuality(`${testInfo.project.name}-${flowExecutionId}`, quality);
  } finally {
    await context.close();
    await client.end();
  }
}

async function captureGuestStates(browser: Browser, testInfo: TestInfo) {
  const receipt = resetScenario("normal");
  const flowExecutionId = `guest-states-${randomUUID()}`;
  const client = await connectDb(env);
  const context = await browser.newContext({ viewport: viewportFor(testInfo.project.name) });
  const page = await context.newPage();
  const quality = startQualityCapture(page, `${flowExecutionId}:guest`);
  try {
    await loginPersona(page, PERSONAS["guest-host-member"], "/");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByText("Guests", { exact: true })).toBeVisible();

    await selectReservationBySuite(page, "Practice Suite 4");
    await expect(page.getByText("Waiting for waiver completion")).toBeVisible();
    await captureMemberState(page, client, testInfo, receipt, {
      order: 15, step: null, screen: "Guest Waiver Pending", state: "guest-waiver-pending", flowExecutionId, personaKey: "guest-host-member", qualityId: quality.id, selectedSuiteName: "Practice Suite 4",
      assertions: async (snapshot) => [
        await containsText(page.locator(".guest-flow"), "selectedReservation.guestStatus", snapshot.selectedReservation!.guestStatus),
        await containsText(page.locator(".guest-flow"), "selectedReservation.guestAllowanceLabel", snapshot.selectedReservation!.guestAllowanceLabel),
      ],
    });

    await selectReservationBySuite(page, "Practice Suite 5");
    await expect(page.getByText("Ready when access opens")).toBeVisible();
    await captureMemberState(page, client, testInfo, receipt, {
      order: 16, step: null, screen: "Guest Ready", state: "guest-ready-allowance-reached", flowExecutionId, personaKey: "guest-host-member", qualityId: quality.id, selectedSuiteName: "Practice Suite 5",
      assertions: async (snapshot) => [
        await containsText(page.locator(".guest-flow"), "selectedReservation.guestStatus", snapshot.selectedReservation!.guestStatus),
        await containsText(page.locator(".guest-flow"), "selectedReservation.guestAllowanceLabel", snapshot.selectedReservation!.guestAllowanceLabel),
      ],
    });

    await page.locator(".guest-flow").getByRole("button", { name: /Remove/i }).click();
    await expect(page.locator(".guest-flow").getByRole("button", { name: /Add guest/i })).toBeVisible({ timeout: 30_000 });
    await captureMemberState(page, client, testInfo, receipt, {
      order: 17, step: null, screen: "Guest Allowance Recovered", state: "guest-removed-add-capacity-restored", flowExecutionId, personaKey: "guest-host-member", qualityId: quality.id, selectedSuiteName: "Practice Suite 5",
      assertions: async (snapshot) => [
        assertion("selectedReservation.activeGuestCount", snapshot.selectedReservation!.activeGuestCount, 0),
        await countAssertion(page.locator(".guest-flow").getByRole("button", { name: /Add guest/i }), "selectedReservation.canAddGuest", 1),
      ],
    });
    flushQuality(`${testInfo.project.name}-${flowExecutionId}`, quality);
  } finally {
    await context.close();
    await client.end();
  }
}

async function captureInsufficientCredits(browser: Browser, testInfo: TestInfo) {
  const receipt = resetScenario("normal");
  const flowExecutionId = `insufficient-credits-${randomUUID()}`;
  const client = await connectDb(env);
  const context = await browser.newContext({ viewport: viewportFor(testInfo.project.name) });
  const page = await context.newPage();
  const quality = startQualityCapture(page, `${flowExecutionId}:blocked`);
  try {
    await loginPersona(page, PERSONAS["constrained-member"], "/");
    const profile = await memberProfileForEmail(client, PERSONAS["constrained-member"].email);
    await setCreditTarget(client, profile.memberProfileId, 0, "DU1 R2 explicit insufficient-credit review state");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByText(/You have 0/)).toBeVisible();
    await captureMemberState(page, client, testInfo, receipt, {
      order: 18, step: null, screen: "Insufficient Credits", state: "inventory-available-credit-confirmation-blocked", flowExecutionId, personaKey: "constrained-member", qualityId: quality.id,
      assertions: async (snapshot) => [
        assertion("member.availableCredits", snapshot.member.availableCredits, 0),
        assertion("playNowQuote.available", snapshot.playNowQuote.available, true),
        await countAssertion(page.getByRole("button", { name: "Confirm Play Now" }), "playNowQuote.confirmEnabled", 1, true),
      ],
    });
    flushQuality(`${testInfo.project.name}-${flowExecutionId}`, quality);
  } finally {
    await context.close();
    await client.end();
  }
}

type Receipt = ReturnType<typeof resetScenario>;
type PersonaKey = keyof typeof PERSONAS;

async function captureMemberState(page: Page, client: Client, testInfo: TestInfo, receipt: Receipt, input: {
  order: number;
  step: number | null;
  screen: string;
  state: string;
  flowExecutionId: string;
  personaKey: PersonaKey;
  qualityId: string;
  selectedSuiteName?: string;
  assertions: (snapshot: Awaited<ReturnType<typeof memberSnapshot>>) => Promise<StructuredAssertion[]>;
}) {
  const persona = PERSONAS[input.personaKey];
  const snapshot = await memberSnapshot(client, persona.email, receipt.scenario, input.selectedSuiteName);
  const assertions = await input.assertions(snapshot);
  const relative = `${receipt.scenario}/reconciliation/${input.flowExecutionId}-${String(input.order).padStart(2, "0")}.json`;
  const reconciliationPath = writeReconciliation(relative, {
    commitSha: process.env.FAIRWAY_DU1_REVIEW_COMMIT_SHA,
    resetExecutionId: receipt.resetExecutionId,
    flowExecutionId: input.flowExecutionId,
    scenario: receipt.scenario,
    fingerprint: receipt.fingerprint,
    capturedAt: new Date().toISOString(),
    snapshot,
    executedAssertions: assertions,
  });
  const accessibilityEvidenceId = await runDu1A11y(page, testInfo, input.screen, input.personaKey, receipt.scenario, input.state);
  await captureDu1Screen(page, testInfo, {
    ...input,
    persona: input.personaKey,
    personaDisplayName: persona.firstName + (persona.lastName ? ` ${persona.lastName}` : ""),
    personaEmail: persona.email,
    scenario: receipt.scenario,
    fingerprint: receipt.fingerprint,
    resetExecutionId: receipt.resetExecutionId,
    reconciliationPath,
    assertions,
    qualityCaptureId: input.qualityId,
    accessibilityEvidenceId,
  });
}

async function captureFacilitiesState(page: Page, client: Client, testInfo: TestInfo, receipt: Receipt, input: {
  order: number;
  step: number | null;
  screen: string;
  state: string;
  flowExecutionId: string;
  qualityId: string;
  assertions: (snapshot: Awaited<ReturnType<typeof facilitiesSnapshot>>) => Promise<StructuredAssertion[]>;
}) {
  const snapshot = await facilitiesSnapshot(client);
  const assertions = await input.assertions(snapshot);
  const relative = `${receipt.scenario}/reconciliation/${input.flowExecutionId}-${String(input.order).padStart(2, "0")}.json`;
  const reconciliationPath = writeReconciliation(relative, {
    commitSha: process.env.FAIRWAY_DU1_REVIEW_COMMIT_SHA,
    resetExecutionId: receipt.resetExecutionId,
    flowExecutionId: input.flowExecutionId,
    scenario: receipt.scenario,
    fingerprint: receipt.fingerprint,
    capturedAt: new Date().toISOString(),
    snapshot,
    executedAssertions: assertions,
  });
  const persona = PERSONAS["facilities-user"];
  const accessibilityEvidenceId = await runDu1A11y(page, testInfo, input.screen, persona.key, receipt.scenario, input.state);
  await captureDu1Screen(page, testInfo, {
    ...input,
    persona: persona.key,
    personaDisplayName: `${persona.firstName} ${persona.lastName}`,
    personaEmail: persona.email,
    scenario: receipt.scenario,
    fingerprint: receipt.fingerprint,
    resetExecutionId: receipt.resetExecutionId,
    reconciliationPath,
    assertions,
    qualityCaptureId: input.qualityId,
    accessibilityEvidenceId,
  });
}

async function memberSnapshot(client: Client, email: string, scenario: string, selectedSuiteName?: string) {
  const memberResult = await client.query(`
    select pe.display_name, mp.id member_profile_id, plan.code plan_code,
      fairway_available_credits(mp.id)::numeric available_credits, plan.guest_allowance
    from people pe
    join member_profiles mp on mp.person_id = pe.id
    left join memberships mem on mem.member_profile_id = mp.id and mem.status = 'active' and mem.ended_at is null
    left join membership_plans plan on plan.id = mem.membership_plan_id
    where pe.email = $1
  `, [email]);
  if (memberResult.rowCount !== 1) throw new Error(`Member snapshot missing for ${email}`);
  const member = memberResult.rows[0];
  const reservationResult = await client.query(`
    select r.id, r.booking_mode, r.status, r.start_at, r.end_at, s.name suite_name,
      ag.status access_status, ag.starts_at access_starts_at, ag.expires_at access_expires_at,
      sess.id session_id, sess.started_at session_started_at, sess.ended_at session_ended_at,
      ft.id turnover_task_id, ft.status turnover_task_status, s.status suite_operational_status,
      coalesce((select count(*)::int from reservation_guests rg where rg.reservation_id = r.id and rg.status = 'active'), 0) active_guest_count
    from reservations r
    join suites s on s.id = r.suite_id
    left join access_grants ag on ag.reservation_id = r.id
    left join sessions sess on sess.reservation_id = r.id
    left join facility_tasks ft on ft.source_session_id = sess.id and ft.task_type = 'turnover'
    where r.member_profile_id = $1
    order by r.created_at desc, r.start_at desc
  `, [member.member_profile_id]);
  const quoteResult = await client.query("select fairway_quote_play_now($1, null, $2) quote", [member.member_profile_id, FAIRWAY_DEMO_CLOCK_ISO]);
  const quote = quoteResult.rows[0].quote;
  const universe = buildDemoUniverse({ scenario: scenario as "normal" | "busy-prime" | "new-member" | "facility-incident" | "low-inventory" });
  const canonical = universe.members.find((item) => item.email === email);
  const profile = canonical ? deriveDemoGolfProfile(universe, canonical.memberProfileId) : null;
  const current = reservationResult.rows.find((row) => row.booking_mode === "PLAY_NOW" && ["confirmed", "checked_in"].includes(row.status));
  const future = reservationResult.rows.find((row) => row.status === "confirmed" && row.start_at.toISOString() > FAIRWAY_DEMO_CLOCK_ISO && row.booking_mode === "ADVANCE");
  const completed = reservationResult.rows.find((row) => row.status === "completed" && row.turnover_task_id);
  const selected = selectedSuiteName
    ? reservationResult.rows.find((row) => row.suite_name === selectedSuiteName)
    : reservationResult.rows[0];
  const selectedGuest = selected ? await selectedGuestSnapshot(client, selected.id, Number(member.guest_allowance ?? 0)) : null;
  const suiteResult = await client.query("select id, status from suites where location_id = '00000000-0000-0000-0000-000000000001'");
  const inventoryReservations = await client.query(`
    select suite_id, status, start_at, end_at
    from reservations
    where location_id = '00000000-0000-0000-0000-000000000001'
      and status in ('confirmed', 'checked_in')
  `);
  const locationResult = await client.query(`
    select minimum_session_minutes, turnover_buffer_minutes
    from locations
    where id = '00000000-0000-0000-0000-000000000001'
  `);
  const safeToAssignNowCount = safeSuiteCount(
    suiteResult.rows,
    inventoryReservations.rows,
    Number(locationResult.rows[0].minimum_session_minutes),
    Number(locationResult.rows[0].turnover_buffer_minutes),
  );
  const activeSessionCount = inventoryReservations.rows.filter((row) =>
    row.status === "checked_in"
    && row.start_at <= new Date(FAIRWAY_DEMO_CLOCK_ISO)
    && row.end_at > new Date(FAIRWAY_DEMO_CLOCK_ISO),
  ).length;
  return {
    member: {
      memberProfileId: member.member_profile_id,
      displayName: member.display_name,
      firstName: String(member.display_name).split(" ")[0],
      membershipPlanCode: member.plan_code,
      availableCredits: Number(member.available_credits),
      guestAllowance: Number(member.guest_allowance ?? 0),
    },
    playNowQuote: {
      available: Boolean(quote?.available),
      safeSuiteId: quote?.suiteId ?? null,
      maxDurationMinutes: quote?.maxDurationMinutes ?? null,
      sixtyMinuteCostLabel: `${quote?.options?.find((item: any) => Number(item.durationMinutes) === 60)?.creditCost ?? "missing"} credits`,
      options: quote?.options ?? [],
    },
    futureReservation: future ? {
      id: future.id,
      suiteName: future.suite_name,
      startAt: future.start_at,
      accessStartsAt: future.access_starts_at,
      accessOpensLabel: formatLocalTime(future.access_starts_at),
      startableNow: false,
    } : null,
    currentReservation: current ? {
      id: current.id,
      suiteName: current.suite_name,
      status: current.status,
      statusLabel: current.status === "checked_in" ? "Session active" : "You are ready",
      accessLabel: accessWindowLabel(current.access_status, current.access_starts_at, current.access_expires_at),
      canFinish: current.status === "checked_in" && !current.session_ended_at,
    } : null,
    selectedReservation: selected ? {
      id: selected.id,
      suiteName: selected.suite_name,
      activeGuestCount: Number(selected.active_guest_count),
      guestAllowanceLabel: `${Number(selected.active_guest_count)}/${Number(member.guest_allowance ?? 0)} allowed`,
      guestStatus: selectedGuest?.statusLabel ?? "No guests",
    } : null,
    completedLifecycle: completed ? {
      reservationId: completed.id,
      reservationStatus: completed.status,
      suiteName: completed.suite_name,
      accessStatus: completed.access_status,
      turnoverTaskStatus: completed.turnover_task_status,
      suiteOperationalStatus: completed.suite_operational_status,
    } : null,
    golfProfile: {
      handicapLabel: profile?.officialGolf.handicapIndex == null ? "No handicap connected" : profile.officialGolf.handicapIndex.toFixed(1),
      driverCarryLabel: profile?.performance.find((item) => item.clubCode === "driver") ? `${profile.performance.find((item) => item.clubCode === "driver")!.typicalCarryYards} yd` : "No Fairway baseline yet",
      driverSampleLabel: profile?.performance.find((item) => item.clubCode === "driver") ? `${profile.performance.find((item) => item.clubCode === "driver")!.sampleCount} swings` : "No sample",
      performanceCount: profile?.performance.length ?? 0,
      completedActivityCount: profile?.activity.length ?? 0,
    },
    inventory: {
      safeToAssignNowCount,
      activeSessionCount,
    },
  };
}

async function selectedGuestSnapshot(client: Client, reservationId: string, allowance: number) {
  const result = await client.query(`
    select rg.status, aa.status waiver_status, aa.verification_state
    from reservation_guests rg
    left join agreement_acceptances aa on aa.guest_id = rg.guest_id
    where rg.reservation_id = $1
    order by rg.created_at desc
    limit 1
  `, [reservationId]);
  if (result.rowCount !== 1 || result.rows[0].status !== "active") return { statusLabel: "No guests", allowance };
  const row = result.rows[0];
  if (row.verification_state === "verified") return { statusLabel: "Ready when access opens", allowance };
  if (row.waiver_status === "requested") return { statusLabel: "Waiting for waiver completion", allowance };
  return { statusLabel: "Waiver required", allowance };
}

async function facilitiesSnapshot(client: Client) {
  const taskResult = await client.query(`
    select ft.id, ft.status, ft.task_type, ft.source_reservation_id, ft.source_session_id, s.name suite_name
    from facility_tasks ft
    join suites s on s.id = ft.suite_id
    where ft.status in ('open', 'claimed', 'in_progress')
    order by ft.priority desc, ft.due_at, ft.created_at
  `);
  const latestCompleted = await client.query(`
    select ft.id, ft.status, ft.source_reservation_id, s.id suite_id, s.name suite_name, s.status suite_status
    from facility_tasks ft
    join suites s on s.id = ft.suite_id
    where ft.task_type = 'turnover'
    order by ft.created_at desc
    limit 1
  `);
  const suites = await client.query("select id, status from suites where location_id = '00000000-0000-0000-0000-000000000001'");
  const top = taskResult.rows[0];
  const completed = latestCompleted.rows[0];
  return {
    topTask: top ? {
      id: top.id,
      suiteName: top.suite_name,
      status: top.status,
      statusLabel: top.status === "in_progress" ? "In service" : titleCase(top.status),
      taskType: top.task_type,
      taskTypeLabel: titleCase(top.task_type),
      sourceReservationId: top.source_reservation_id,
    } : null,
    completedLifecycle: completed ? {
      turnoverTaskStatus: completed.status,
      reservationId: completed.source_reservation_id,
      suiteId: completed.suite_id,
      suiteName: completed.suite_name,
      suiteOperationalStatus: completed.suite_status,
      safeToAssignNow: completed.suite_status === "available",
    } : null,
    inventory: {
      safeToAssignNowCount: suites.rows.filter((row) => row.status === "available").length,
      inspectionRequiredCount: suites.rows.filter((row) => row.status === "inspection_required").length,
    },
  };
}

async function futureReservation(client: Client, memberProfileId: string) {
  const result = await client.query(`
    select r.id, r.start_at, ag.starts_at access_starts_at
    from reservations r
    join access_grants ag on ag.reservation_id = r.id
    where r.member_profile_id = $1 and r.booking_mode = 'ADVANCE' and r.status = 'confirmed'
    order by r.start_at
    limit 1
  `, [memberProfileId]);
  if (result.rowCount !== 1) throw new Error("Demo Tom future reservation missing");
  return result.rows[0];
}

async function sessionMutationCounts(client: Client, reservationId: string) {
  const result = await client.query(`
    select
      (select status from reservations where id = $1) reservation_status,
      (select count(*)::int from sessions where reservation_id = $1) sessions,
      (select count(*)::int from audit_events where resource_id in (select id::text from sessions where reservation_id = $1)) audits
  `, [reservationId]);
  return result.rows[0];
}

function resetScenario(scenario: string) {
  const reviewRoot = path.join("artifacts", "du1-remediation-r2-review");
  const result = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "demo-reset.mjs"), `--scenario=${scenario}`, "--yes"], {
    cwd: process.cwd(),
    env: { ...process.env, ...env, FAIRWAY_DEMO_RESET_CONFIRM: "RESET_FAIRWAY_DEMO", FAIRWAY_DU1_REVIEW_ROOT: reviewRoot },
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`DU1 reset failed for ${scenario}: ${result.stderr}`);
  const receiptPath = path.join(artifactRoot, "runtime", scenario, "reset-execution.json");
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  expect(receipt.reconciliation.ok).toBe(true);
  return {
    scenario,
    fingerprint: receipt.fingerprint,
    resetExecutionId: receipt.resetExecutionId,
    resetReceiptPath: path.join("runtime", scenario, "executions", `${receipt.resetExecutionId}.json`).replaceAll("\\", "/"),
  };
}

async function containsText(locator: ReturnType<Page["locator"]>, sourcePath: string, expected: string | number) {
  const text = String(expected);
  const actual = (await locator.innerText()).trim();
  expect(actual).toContain(text);
  return assertion(sourcePath, actual.includes(text), true, "contains", text, actual);
}

async function countAssertion(locator: ReturnType<Page["locator"]>, sourcePath: string, expected: number, disabled = false) {
  const actual = disabled ? await locator.evaluateAll((nodes) => nodes.filter((node) => (node as HTMLButtonElement).disabled).length) : await locator.count();
  expect(actual).toBe(expected);
  return assertion(sourcePath, actual, expected, "count");
}

function assertion(
  sourcePath: string,
  actual: string | number | boolean,
  expected: string | number | boolean,
  comparator: StructuredAssertion["comparator"] = "equals",
  recordedExpected = expected,
  recordedActual = actual,
): StructuredAssertion {
  expect(actual).toEqual(expected);
  return {
    id: `assert:${sourcePath}:${randomUUID()}`,
    sourcePath,
    comparator,
    expected: recordedExpected,
    actual: recordedActual,
    passed: true,
  };
}

async function selectReservationBySuite(page: Page, suiteName: string) {
  const tile = page.locator(".reservation-tile").filter({ hasText: suiteName }).first();
  await tile.getByRole("button").first().click();
  const guestPanel = page.locator(".guest-flow");
  await guestPanel.scrollIntoViewIfNeeded();
  await expect(guestPanel).toBeVisible();
}

async function revealSuiteDetails(page: Page) {
  const details = page.locator("details").filter({ hasText: "Suite details" }).first();
  if (!(await details.getAttribute("open"))) await details.locator("summary").click();
  await details.scrollIntoViewIfNeeded();
}

function accessWindowLabel(status: string, startsAt: Date, expiresAt: Date) {
  const now = new Date(FAIRWAY_DEMO_CLOCK_ISO);
  if (status !== "active" || now >= expiresAt) return "Access closed";
  if (now < startsAt) return `Access opens at ${formatLocalTime(startsAt)}.`;
  return "Access is open now.";
}

function formatLocalTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeSuiteCount(
  suites: Array<{ id: string; status: string }>,
  reservations: Array<{ suite_id: string; start_at: Date; end_at: Date }>,
  minimumSessionMinutes: number,
  turnoverBufferMinutes: number,
) {
  const now = new Date(FAIRWAY_DEMO_CLOCK_ISO).getTime();
  const minimumEnd = now + minimumSessionMinutes * 60_000;
  return suites.filter((suite) => {
    if (suite.status !== "available") return false;
    const suiteReservations = reservations.filter((reservation) => reservation.suite_id === suite.id);
    if (suiteReservations.some((reservation) => reservation.start_at.getTime() < minimumEnd && reservation.end_at.getTime() > now)) return false;
    const next = suiteReservations.filter((reservation) => reservation.start_at.getTime() > now).sort((a, b) => a.start_at.getTime() - b.start_at.getTime())[0];
    return !next || next.start_at.getTime() - turnoverBufferMinutes * 60_000 >= minimumEnd;
  }).length;
}

function viewportFor(project: string) {
  if (project === "mobile-primary") return { width: 390, height: 844 };
  if (project === "presentation") return { width: 1600, height: 900 };
  return { width: 1440, height: 1000 };
}
