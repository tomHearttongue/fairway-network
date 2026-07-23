import { test, expect } from "@playwright/test";
import { assertDevelopmentEnv, loadHarnessEnv } from "./support/env";
import { bootstrapPersona, connectDb, PERSONAS, resetHarnessFacilityState } from "./support/personas";
import { expectResponsiveBasics, flushQualityCapture, startQualityCapture, writeReviewNote } from "./support/evidence";

const env = loadHarnessEnv();
assertDevelopmentEnv(env);

test.describe("VS1G.2 cross-browser smoke", () => {
  test("member IA and My Golf render across browser engines", async ({ page, browserName }, testInfo) => {
    const quality = startQualityCapture(page);
    const client = await connectDb(env);
    try {
      if (browserName === "chromium") await resetHarnessFacilityState(client);
      await bootstrapPersona(page, client, PERSONAS["demo-active-birdie"]);
      await page.getByRole("heading", { name: /Ready to play/ }).waitFor();
      await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "My Golf", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "My Golf", exact: true }).click();
      await expect(page.getByText("Golfer Passport")).toBeVisible();
      await expect(page.getByText("Demo official handicap")).toBeVisible();
      await expectResponsiveBasics(page, `${browserName} member smoke`);
      writeReviewNote(`cross-browser-smoke-${testInfo.project.name}`, { project: testInfo.project.name, browserName, result: "passed", checks: ["member-home", "member-navigation", "my-golf-provenance", "responsive-basics"] });
      flushQualityCapture(`${testInfo.project.name}-cross-browser-smoke`, quality);
    } finally {
      await client.end().catch(() => undefined);
    }
  });
});