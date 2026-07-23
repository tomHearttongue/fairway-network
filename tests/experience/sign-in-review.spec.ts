import { test } from "@playwright/test";
import { captureScreen, expectResponsiveBasics, flushQualityCapture, runA11y, startQualityCapture } from "./support/evidence";

test.describe("VS1G.2 sign-in review evidence", () => {
  test("captures sign-in surface for Product Acceptance", async ({ page }, testInfo) => {
    const quality = startQualityCapture(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Golf when you want to golf." }).waitFor();
    await expectResponsiveBasics(page, "sign-in");
    await runA11y(page, testInfo, "Sign In", "unauthenticated");
    await captureScreen(page, testInfo, {
      order: 0,
      screen: "sign-in",
      route: "/",
      persona: "unauthenticated",
      state: "signed-out-entry",
      prdRequirementIds: ["FR-UX-011", "NFR-011"],
      principles: ["golf-before-administration", "calm-confidence", "accessibility"],
      capability: "Signed-out member entry is available for human Product Acceptance review.",
    });
    flushQualityCapture(`${testInfo.project.name}-sign-in`, quality);
  });
});
