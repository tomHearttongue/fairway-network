import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { assertDevelopmentEnv, loadHarnessEnv } from "../experience/support/env";
import { ensureClerkPersonas, loginPersona, PERSONAS } from "../experience/support/personas";
import { captureDu1Screen, flushQuality, resetEvidenceFiles, runDu1A11y, startQualityCapture } from "./support/du1-evidence";

const env = loadHarnessEnv();
assertDevelopmentEnv(env);
const artifacts = path.join(process.cwd(), "artifacts", "du1-remediation-review");

test.beforeAll(async () => {
  if (test.info().project.name === "mobile-primary") resetEvidenceFiles();
  await ensureClerkPersonas(env);
});

test("captures exact-world DU1 review surfaces", async ({ browser }, testInfo) => {
  const project = testInfo.project.name;
  let context = await browser.newContext({ viewport: viewportFor(project) });
  let page = await context.newPage();
  let quality = startQualityCapture(page);
  try {
    const normal = resetScenario("normal");
    await loginPersona(page, PERSONAS["demo-active-birdie"], "/");
    await expect(page.getByRole("heading", { name: /Ready to play, Tom/i })).toBeVisible();
    await capture(page, testInfo, normal, 1, "Demo Tom Home", "demo-active-birdie", "canonical-populated-home", ["Tom identity visible", "credits reconcile", "Play Now hierarchy visible"]);

    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByText("Suite details")).toBeVisible();
    await runDu1A11y(page, testInfo, "Demo Tom Play", "demo-active-birdie", "normal");
    await capture(page, testInfo, normal, 2, "Demo Tom Play", "demo-active-birdie", "normal-availability-and-reservations", ["server quote visible", "canonical upcoming reservation visible"]);

    await page.getByRole("button", { name: "My Golf", exact: true }).click();
    await expect(page.getByText("264 yd").first()).toBeVisible();
    await expect(page.getByText("43 swings", { exact: true })).toBeVisible();
    await runDu1A11y(page, testInfo, "Demo Tom My Golf", "demo-active-birdie", "normal");
    await capture(page, testInfo, normal, 3, "Demo Tom My Golf", "demo-active-birdie", "derived-golfer-passport", ["Handicap 8.4 visible", "Driver 264 yd / 43 swings visible", "activity derives from canonical sessions"]);

    if (project === "mobile-primary") {
      flushQuality(`${project}-normal`, quality);
      await context.close();

      const newer = resetScenario("new-member");
      context = await browser.newContext({ viewport: viewportFor(project) });
      page = await context.newPage();
      quality = startQualityCapture(page);
      await loginPersona(page, PERSONAS["new-golfer"], "/");
      await page.getByRole("button", { name: "My Golf", exact: true }).click();
      await expect(page.getByText("No Fairway baseline yet")).toBeVisible();
      await capture(page, testInfo, newer, 4, "Nora New Member My Golf", "new-golfer", "no-mature-history", ["no baseline", "no activity", "canonical zero-shot persona"]);
      flushQuality(`${project}-new-member`, quality);
      await context.close();

      const busy = resetScenario("busy-prime");
      context = await browser.newContext({ viewport: viewportFor(project) });
      page = await context.newPage();
      quality = startQualityCapture(page);
      await loginPersona(page, PERSONAS["demo-active-birdie"], "/");
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await revealSuiteDetails(page);
      await capture(page, testInfo, busy, 5, "Busy Prime Play", "demo-active-birdie", "coherent-high-demand", ["six active suites", "four protected near-future suites", "two ready suites"]);
      flushQuality(`${project}-busy-prime`, quality);
      await context.close();

      const low = resetScenario("low-inventory");
      context = await browser.newContext({ viewport: viewportFor(project) });
      page = await context.newPage();
      quality = startQualityCapture(page);
      await loginPersona(page, PERSONAS["demo-active-birdie"], "/");
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect(page.getByText("48 credits")).toBeVisible();
      await revealSuiteDetails(page);
      await capture(page, testInfo, low, 6, "Low Inventory Play", "demo-active-birdie", "inventory-not-credits-constrained", ["48 credits available", "exactly two ready-now suites", "inventory is declared constraint"]);
      flushQuality(`${project}-low-inventory`, quality);
      await context.close();

      const incident = resetScenario("facility-incident");
      context = await browser.newContext({ viewport: viewportFor(project) });
      page = await context.newPage();
      quality = startQualityCapture(page);
      await loginPersona(page, PERSONAS["facilities-user"], "/facilities");
      await expect(page.getByRole("heading", { name: "What should I service now?" })).toBeVisible();
      await expect(page.getByText("Next Best Action")).toBeVisible();
      await runDu1A11y(page, testInfo, "Facility Incident", "facilities-user", "facility-incident");
      await capture(page, testInfo, incident, 7, "Facility Incident Cleaning Mode", "facilities-user", "inspection-and-turnover-impact-availability", ["facilities-only persona", "inspection task visible", "incident suites unavailable"]);
      flushQuality(`${project}-facility-incident`, quality);
    } else {
      flushQuality(`${project}-normal`, quality);
    }
  } finally {
    await context.close().catch(() => undefined);
  }
});

function resetScenario(scenario: string) {
  const result = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "demo-reset.mjs"), `--scenario=${scenario}`, "--yes"], {
    cwd: process.cwd(),
    env: { ...process.env, ...env, FAIRWAY_DEMO_RESET_CONFIRM: "RESET_FAIRWAY_DEMO" },
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`DU1 reset failed for ${scenario}: ${result.stderr}`);
  const receiptPath = path.join(artifacts, "runtime", scenario, "reset-execution.json");
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  expect(receipt.reconciliation.ok).toBe(true);
  const immutableReceiptPath = path.join(artifacts, "runtime", scenario, "executions", `${receipt.resetExecutionId}.json`);
  return { scenario, fingerprint: receipt.fingerprint, resetExecutionId: receipt.resetExecutionId, reconciliationPath: path.relative(process.cwd(), immutableReceiptPath).replaceAll("\\", "/") };
}

async function capture(page: Parameters<typeof captureDu1Screen>[0], testInfo: Parameters<typeof captureDu1Screen>[1], receipt: ReturnType<typeof resetScenario>, order: number, screen: string, persona: string, state: string, assertions: string[]) {
  await captureDu1Screen(page, testInfo, { order, screen, persona, state, assertions, ...receipt });
}

function viewportFor(project: string) {
  if (project === "mobile-primary") return { width: 390, height: 844 };
  if (project === "presentation") return { width: 1600, height: 900 };
  return { width: 1440, height: 1000 };
}

async function revealSuiteDetails(page: Parameters<typeof captureDu1Screen>[0]) {
  const details = page.locator("details").filter({ hasText: "Suite details" }).first();
  if (!(await details.getAttribute("open"))) await details.locator("summary").click();
  await details.scrollIntoViewIfNeeded();
}
