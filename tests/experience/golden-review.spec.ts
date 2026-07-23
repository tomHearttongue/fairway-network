import { test, expect } from "@playwright/test";
import { assertDevelopmentEnv, loadHarnessEnv } from "./support/env";
import { bootstrapPersona, connectDb, grantFacilitiesRole, loginPersona, memberProfileForEmail, PERSONAS, resetHarnessFacilityState, setCreditTarget } from "./support/personas";
import { captureScreen, expectMobilePlayStructure, expectResponsiveBasics, flushQualityCapture, runA11y, startQualityCapture, writeReviewNote } from "./support/evidence";

const env = loadHarnessEnv();
assertDevelopmentEnv(env);

test.describe("VS1G.4 Golden Demo experience", () => {
  test("member golden demo and facilities turnover restoration", async ({ browser }, testInfo) => {
    const memberContext = await browser.newContext();
    const page = await memberContext.newPage();
    const quality = startQualityCapture(page);
    const client = await connectDb(env);
    try {
      await resetHarnessFacilityState(client);
      const active = PERSONAS["demo-active-birdie"];
      const activeProfile = await bootstrapPersona(page, client, active);
      await setCreditTarget(client, activeProfile.memberProfileId, 24, "Experience QA target for demo-active-birdie");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: /Ready to play/ }).waitFor();
      await expect(page.getByText("24 credits")).toBeVisible();
      await expect(page.getByRole("button", { name: "Confirm Play Now" }).first()).toBeEnabled();
      await expectResponsiveBasics(page, "member home");
      await runA11y(page, testInfo, "Member Home", active.key);
      await captureScreen(page, testInfo, {
        order: 1,
        screen: "member-home",
        route: "/",
        persona: active.key,
        state: "populated-primary-home",
        prdRequirementIds: ["FR-UX-011", "FR-UX-012", "NFR-011"],
        principles: ["golf-before-administration", "action-before-navigation", "calm-confidence"],
        capability: "Member can see Play Now hierarchy, credits, next activity, and My Golf preview.",
      });

      await page.getByRole("button", { name: "Play", exact: true }).click();
      await page.getByText("Suite details").waitFor();
      await expectResponsiveBasics(page, "play now surface");
      await expectMobilePlayStructure(page, "play now surface");
      await runA11y(page, testInfo, "Play Now", active.key);
      await captureScreen(page, testInfo, {
        order: 2,
        screen: "play-now",
        route: "/",
        persona: active.key,
        state: "eligible-before-booking",
        prdRequirementIds: ["FR-UX-013", "FR-RES-001", "FR-ACC-001"],
        principles: ["action-before-navigation", "human-state-language", "clear-system-status"],
        capability: "Member can understand duration, credit prerequisites, suite availability, and turnover protection.",
      });

      await page.getByRole("button", { name: "Confirm Play Now" }).first().click();
      await page.getByText(/is ready|You are ready/i).first().waitFor({ timeout: 45_000 });
      await expectMobilePlayStructure(page, "play now confirmation");
      await expect(page.getByRole("button", { name: /Start Session/i })).toHaveCount(1);
      await captureScreen(page, testInfo, {
        order: 3,
        screen: "play-now-confirmation",
        route: "/",
        persona: active.key,
        state: "reservation-confirmed-access-scheduled",
        prdRequirementIds: ["FR-RES-003", "FR-ACC-003", "FR-UX-013"],
        principles: ["clear-system-status", "calm-confidence"],
        capability: "Reservation, suite assignment, credit commit, and access timing is visible after Play Now.",
      });

      await page.getByRole("button", { name: /Start Session/i }).first().click();
      await page.getByText(/Session started/i).waitFor({ timeout: 45_000 });
      await page.getByText("Session active").last().waitFor();
      await expectMobilePlayStructure(page, "active session");
      await expect(page.getByRole("button", { name: /Finish Session/i })).toHaveCount(1);
      await runA11y(page, testInfo, "Active Session", active.key);
      await captureScreen(page, testInfo, {
        order: 4,
        screen: "active-session",
        route: "/",
        persona: active.key,
        state: "checked-in-active-session",
        prdRequirementIds: ["FR-UX-014", "FR-SES-001", "FR-ACC-003"],
        principles: ["human-state-language", "clear-system-status"],
        capability: "Member sees current suite, session timing, access state, guest readiness, and finish action.",
      });

      await page.getByRole("button", { name: "My Golf", exact: true }).click();
      await page.getByText("Golfer Passport").waitFor();
      await expect(page.getByText("Session started. Enjoy your Practice Suite.")).toHaveCount(0);
      await expect(page.getByText("Demo official handicap")).toBeVisible();
      await expect(page.getByText("Driver", { exact: true })).toBeVisible();
      await expect(page.getByText("264 yd").first()).toBeVisible();
      await runA11y(page, testInfo, "My Golf", active.key);
      await captureScreen(page, testInfo, {
        order: 5,
        screen: "my-golf",
        route: "/",
        persona: active.key,
        state: "established-demo-baselines",
        prdRequirementIds: ["FR-CMP-010", "FR-CMP-011", "FR-CMP-012"],
        principles: ["data-with-meaning", "progressive-disclosure"],
        capability: "Golfer Passport presents official-golf provenance and Fairway performance baselines.",
      });

      await page.getByRole("button", { name: "Play", exact: true }).click();
      await page.getByRole("button", { name: /Finish Session/i }).first().click();
      await page.getByRole("status").filter({ hasText: /Nice work, Tom/i }).waitFor({ timeout: 45_000 });
      await expect(page.getByText("Your Fairway activity has been saved.")).toBeVisible();
      await expectMobilePlayStructure(page, "session completion summary");
      await captureScreen(page, testInfo, {
        order: 6,
        screen: "session-summary",
        route: "/",
        persona: active.key,
        state: "member-centered-session-summary",
        prdRequirementIds: ["FR-UX-014", "FR-FAC-006"],
        principles: ["clear-system-status", "calm-confidence"],
        capability: "Session completion gives member-centered summary language while lifecycle and turnover remain correct underneath.",
      });

      const lifecycle = await getLatestCompletedLifecycle(client, active.email);
      expect(lifecycle.reservationStatus).toBe("completed");
      expect(lifecycle.accessStatus).toBe("expired");
      expect(lifecycle.taskStatus).toBe("open");
      expect(lifecycle.suiteStatus).toBe("turnover");
      writeReviewNote("golden-demo-lifecycle", lifecycle);

      const facilitiesContext = await browser.newContext();
      const facilitiesPage = await facilitiesContext.newPage();
      const facilitiesQuality = startQualityCapture(facilitiesPage);
      const facilities = PERSONAS["facilities-user"];
      await loginPersona(facilitiesPage, facilities, "/");
      await facilitiesPage.getByRole("heading", { name: "Practice Suite Availability" }).waitFor({ timeout: 45_000 });
      const facilitiesProfile = await memberProfileForEmail(client, facilities.email);
      await grantFacilitiesRole(client, facilitiesProfile.memberProfileId, facilitiesProfile.locationId);
      await facilitiesPage.goto("/facilities", { waitUntil: "domcontentloaded" });
      await facilitiesPage.getByRole("heading", { name: "What should I service now?" }).waitFor({ timeout: 45_000 });
      await facilitiesPage.getByText("Next Best Action").waitFor();
      await expectResponsiveBasics(facilitiesPage, "facilities queue");
      await runA11y(facilitiesPage, testInfo, "Facilities Queue", facilities.key);
      await captureScreen(facilitiesPage, testInfo, {
        order: 7,
        screen: "facilities-queue",
        route: "/facilities",
        persona: facilities.key,
        state: "turnover-task-open",
        prdRequirementIds: ["FR-FAC-006", "FR-FAC-007", "NFR-011"],
        principles: ["operational-clarity", "least-privilege", "clear-system-status"],
        capability: "Facilities persona sees reservation-aware suite turnover work without unnecessary member PII.",
      });

      const nextTask = facilitiesPage.getByLabel("Next service task");
      await nextTask.getByRole("button", { name: /Claim/i }).click();
      await facilitiesPage.getByText(/claimed/i).first().waitFor({ timeout: 30_000 });
      await nextTask.getByRole("button", { name: /Start/i }).click();
      await facilitiesPage.getByText(/started/i).first().waitFor({ timeout: 30_000 });
      await captureScreen(facilitiesPage, testInfo, {
        order: 8,
        screen: "turnover-task",
        route: "/facilities",
        persona: facilities.key,
        state: "turnover-in-progress",
        prdRequirementIds: ["FR-FAC-006", "FR-FAC-007"],
        principles: ["operational-clarity", "clear-system-status"],
        capability: "Facilities task can be claimed and started with obvious status feedback.",
      });

      await nextTask.getByRole("button", { name: /Mark ready/i }).click();
      await facilitiesPage.getByText("All suites are ready").first().waitFor({ timeout: 30_000 });
      await captureScreen(facilitiesPage, testInfo, {
        order: 9,
        screen: "suite-ready",
        route: "/facilities",
        persona: facilities.key,
        state: "turnover-complete-suite-ready",
        prdRequirementIds: ["FR-FAC-006", "FR-FAC-007"],
        principles: ["operational-clarity", "clear-system-status"],
        capability: "Completed turnover restores the suite to ready inventory when no other block remains.",
      });
      const restored = await getSuiteStatus(client, lifecycle.suiteId);
      expect(restored).toBe("available");
      flushQualityCapture(`${testInfo.project.name}-facilities`, facilitiesQuality);
      await facilitiesContext.close();
      flushQualityCapture(`${testInfo.project.name}-golden-demo`, quality);
      await memberContext.close();
    } finally {
      await client.query("update suites set status = 'available' where location_id = '00000000-0000-0000-0000-000000000001'").catch(() => undefined);
      await client.end().catch(() => undefined);
    }
  });
});

async function getLatestCompletedLifecycle(client: Awaited<ReturnType<typeof connectDb>>, email: string) {
  const result = await client.query(`
    select r.id as reservation_id, r.status as reservation_status, r.suite_id, s.status as suite_status,
      ag.status as access_status, ft.id as task_id, ft.status as task_status
    from reservations r
    join member_profiles mp on mp.id = r.member_profile_id
    join people pe on pe.id = mp.person_id
    join suites s on s.id = r.suite_id
    left join access_grants ag on ag.reservation_id = r.id
    left join sessions sess on sess.reservation_id = r.id
    left join facility_tasks ft on ft.source_session_id = sess.id and ft.task_type = 'turnover'
    where pe.email = $1 and r.booking_mode = 'PLAY_NOW'
    order by r.created_at desc
    limit 1
  `, [email]);
  if (result.rowCount !== 1) throw new Error("Golden Demo lifecycle row not found");
  return {
    reservationId: result.rows[0].reservation_id,
    reservationStatus: result.rows[0].reservation_status,
    suiteId: result.rows[0].suite_id,
    suiteStatus: result.rows[0].suite_status,
    accessStatus: result.rows[0].access_status,
    taskId: result.rows[0].task_id,
    taskStatus: result.rows[0].task_status,
  };
}

async function getSuiteStatus(client: Awaited<ReturnType<typeof connectDb>>, suiteId: string): Promise<string> {
  const result = await client.query("select status from suites where id = $1", [suiteId]);
  if (result.rowCount !== 1) throw new Error("Suite not found");
  return result.rows[0].status;
}
